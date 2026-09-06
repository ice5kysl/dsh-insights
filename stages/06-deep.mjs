#!/usr/bin/env node
/**
 * Stage 6 — limited deep checks on selected plugins (clone + source scan).
 *
 * Heuristics (same spirit as dsh-plugin-health):
 *   - filesystem writes / subprocess spawn / HTTP write verbs in src
 *   - sanitizer presence for HTML/Markdown rendering (DOMPurify etc.)
 * Targets (first available of each):
 *   - env DEEP_REPOS="owner/repo,owner/repo" (default: none)
 *   - plus automatically: any plugin whose description contains read-only/只读
 * Output: data/deep.jsonl keyed by full_name.
 *
 * @module dsh-insights/stage-6
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { readFileSync as readRows } from 'node:fs'

const ROOT = join(import.meta.dirname, '..')
const CACHE = join('/tmp', 'dsh-deep-cache')
const LOCAL = process.env.DSH_WORKSPACE || join(ROOT, '..') // 深检目标目录：环境变量或仓库父目录（不再硬编码本机路径）
mkdirSync(CACHE, { recursive: true })

function scanDir(dir, fullName) {
  const hits = []
  const writePatterns = [
    [/fs\.(writeFile|appendFile|rename|unlink|rm|rmSync|copyFile|mkdir|chmod|createWriteStream)/g, 'filesystem-write'],
    [/exec(Sync)?\s*\(|spawn\(|child_process/g, 'subprocess'],
    [/\b(put|post|delete|patch)\s*\(|method:\s*['"](POST|PUT|DELETE|PATCH)['"]/g, 'http-write'],
  ]
  const sanitizeRe = /DOMPurify|sanitizeHtml|escape-html|marked\.parse|textContent|setHTML|dangerouslySetInnerHTML/g
  let srcFiles = 0
  let sanitized = false
  function walk(p) {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['node_modules', 'lib', 'dist', 'docs'].includes(e.name)) continue
      const full = join(p, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|mjs|jsx)$/.test(e.name)) {
        const text = readFileSync(full, 'utf8')
        srcFiles++
        if (sanitizeRe.test(text)) sanitized = true
        for (const [re, label] of writePatterns) {
          re.lastIndex = 0
          let m
          while ((m = re.exec(text))) hits.push(`${e.name}:${label}(${m[0].slice(0, 30)})`)
        }
      }
    }
  }
  if (existsSync(join(dir, 'src'))) dir = join(dir, 'src')
  walk(dir)
  return { srcFiles, sanitized, hits }
}

async function main() {
  const rows = readRows(join(ROOT, 'data', 'plugins.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const fromEnv = (process.env.DEEP_REPOS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const auto = rows.filter((r) => /read-?only|只读|readonly/i.test(r.description || '')).slice(0, 5).map((r) => r.full_name)
  const top = rows.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 3).map((r) => r.full_name)
  const targets = [...new Set([...fromEnv, ...auto, ...top])].slice(0, 8)
  console.log(`[deep] targets: ${targets.join(', ') || '(none yet — no snapshot rows?)'}`)

  const out = []
  for (const fullName of targets) {
    const [owner, repo] = fullName.split('/')
    let dir = join(LOCAL, repo)
    if (!existsSync(dir)) {
      dir = join(CACHE, repo)
      if (!existsSync(dir)) {
        console.log(`[deep] cloning ${fullName}…`)
        const sshEnv = { ...process.env, GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new' }
        const r = spawnSync('git', ['clone', '--depth', '1', `git@github.com:${fullName}.git`, dir], { stdio: 'ignore', timeout: 60_000, env: sshEnv })
        if (r.status !== 0) { console.error(`[deep] clone failed/skipped ${fullName}`); continue }
      }
    }
    try {
      const scan = scanDir(dir, fullName)
      const writes = scan.hits.length
      out.push({
        full_name: fullName, checkedAt: new Date().toISOString(),
        srcFiles: scan.srcFiles, sanitized: scan.sanitized,
        writeHits: scan.hits.slice(0, 15), writeCount: writes,
        verdict: writes === 0 && !scan.sanitized ? 'no-render-no-writes' : writes === 0 ? 'readonly-clean' : `writes:${writes}`,
      })
      console.log(`[deep] ${fullName}: ${scan.srcFiles} files, writes=${writes}, sanitized=${scan.sanitized}`)
    } catch (e) { console.error(`[deep] scan failed ${fullName}: ${e.message}`) }
  }
  writeFileSync(join(ROOT, 'data', 'deep.jsonl'), out.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`[deep] ${out.length} results → data/deep.jsonl`)
}

main().catch((e) => { console.error(e); process.exit(1) })
