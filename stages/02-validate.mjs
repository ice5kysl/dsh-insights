#!/usr/bin/env node
/**
 * Stage 2 — validate candidates and build the authoritative set.
 *
 * Tiering (to respect API budget over thousands of candidates):
 *   A. cheap signals from the search/candidate row (topics/name/description);
 *      rows with no plugin signal at all → invalid['no-signal'] without API calls
 *   B. plausible rows → fetch repo meta + package.json + dsh manifest checks;
 *      require: not fork, not archived, has package.json declaring
 *      `dsh.bundle.patch`, that patch file committed → VALID (authoritative).
 *
 * Outputs:
 *   data/plugins.jsonl     — the authoritative set (one valid plugin per line)
 *   data/invalid.jsonl     — bucketed non-plugins/noise (reason field)
 *   data/state/validated.ids — progress file for resumable runs
 *
 * @module dsh-plugin-insights/stage-2
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { ghApi, ghContents, npmDoc } from '../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..')
const CAND = process.argv[2] || join(ROOT, 'data', 'candidates.jsonl')
const PLUGINS = join(ROOT, 'data', 'plugins.jsonl')
const INVALID = join(ROOT, 'data', 'invalid.jsonl')
const STATE = join(ROOT, 'data', 'state', 'done.ids')
const LIMIT = Number(process.env.LIMIT || 0) // per-run cap (for pilots)

mkdirSync(join(ROOT, 'data', 'state'), { recursive: true })

const done = new Set(existsSync(STATE) ? readFileSync(STATE, 'utf8').split('\n').filter(Boolean) : [])

const hasSignal = (c) => {
  const t = (c.topics || []).join(' ')
  const desc = `${c.description || ''} ${c.name || ''}`
  if (/dsh-plugin|deepseek-harness|cordis-plugin|dsh-bundle/.test(t)) return true
  if (/^dsh[-_.]|^@[\w-]+\/dsh[-_.]/.test(c.name || '')) return true
  if (/deepseek harness|deepseek-harness|dsh web|dsh 插件|dsh plugin/i.test(desc)) return true
  return false
}

async function validateOne(c) {
  if (!hasSignal(c)) return { ok: false, reason: 'no-signal' }
  if (c.fork) return { ok: false, reason: 'fork' }
  if (c.archived) return { ok: false, reason: 'archived' }

  const metaR = await ghApi(`/repos/${c.owner}/${c.name}`)
  if (!metaR.ok) return { ok: false, reason: metaR.status === 404 ? 'repo-gone' : `repo-http${metaR.status}` }
  const m = metaR.body
  const record = {
    kind: 'repo', owner: c.owner, repo: c.name,
    full_name: m.full_name,
    html_url: m.html_url || `https://github.com/${m.full_name}`,
    stars: m.stargazers_count ?? 0, forks: m.forks_count ?? 0,
    created_at: m.created_at, pushed_at: m.pushed_at,
    archived: m.archived ?? false, fork: m.fork ?? false,
    default_branch: m.default_branch || 'main',
    topics: m.topics || [],
    description: m.description || '',
    license: m.license?.spdx_id || null,
  }
  if (m.fork) return { ok: false, reason: 'fork', record }
  if (m.archived) return { ok: false, reason: 'archived', record }

  const pkgRaw = await ghContents(record.owner, record.repo, 'package.json', record.default_branch)
  if (!pkgRaw) return { ok: false, reason: 'no-package.json', record }
  let pkg = null
  try { pkg = JSON.parse(pkgRaw) } catch { return { ok: false, reason: 'package-parse', record } }

  record.pkgName = pkg.name || record.repo
  record.version = pkg.version || null
  const patch = pkg.dsh?.bundle?.patch || (pkg.dsh?.bundle ? 'cordis.patch.yml' : null)
  if (!patch) return { ok: false, reason: 'no-dsh-bundle', record }
  record.dshPatch = patch

  const patchText = await ghContents(record.owner, record.repo, patch, record.default_branch)
  if (patchText == null) return { ok: false, reason: 'patch-missing', record }
  record.patchHasName = /name:\s*\S/.test(patchText)

  const hasLibIndex = (await ghContents(record.owner, record.repo, 'lib/index.js', record.default_branch)) != null
  const hasLibClient = (await ghContents(record.owner, record.repo, 'lib/client.js', record.default_branch)) != null
  record.lib = { index: hasLibIndex, client: hasLibClient }

  const readme = await ghContents(record.owner, record.repo, 'README.md', record.default_branch)
  const readmeZh = await ghContents(record.owner, record.repo, 'README.zh-CN.md', record.default_branch)
  record.docs = {
    readme: readme != null,
    readmeZh: readmeZh != null,
    zhSignal: readme != null && /[\u4e00-\u9fff]/.test(readme),
  }
  record.eval = {
    hasClientExport: typeof pkg.exports?.['./client']?.default === 'string',
    mainIsLib: pkg.main === 'lib/index.js',
    licenseField: typeof pkg.license === 'string' ? pkg.license : null,
    filesWhitelist: Array.isArray(pkg.files) ? pkg.files : null,
    repoUrl: pkg.repository?.url || null,
  }
  const ageDays = (Date.now() - new Date(record.created_at).getTime()) / 86400000
  const idleDays = (Date.now() - new Date(record.pushed_at).getTime()) / 86400000
  record.metrics = {
    ageDays: Number(ageDays.toFixed(2)),
    idleDays: Number(idleDays.toFixed(2)),
    active30: idleDays <= 30,
    ageGate1: ageDays >= 1,
    hasZhDocs: record.docs.readmeZh || record.docs.zhSignal,
  }

  // npm status only for plausible plugin names (budget)
  let npm = null
  const wantNpm = /^(@[\w-]+\/)?dsh[-_.@]|deepseek|harness/i.test(record.pkgName || '') || record.topics.includes('dsh-plugin')
  if (wantNpm) {
    try { npm = await npmDoc(record.pkgName) } catch { npm = null }
    record.npm = npm ? { published: true, latest: npm.latest, versions: npm.versions } : { published: false }
  }
  return { ok: true, record }
}

async function main() {
  const lines = readFileSync(CAND, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const repos = lines.filter((c) => c.kind === 'repo')
  let processed = 0, valid = 0
  for (const c of repos) {
    const id = `${c.owner}/${c.name}`
    if (done.has(id)) continue
    if (LIMIT && processed >= LIMIT) break
    processed++
    const res = await validateOne(c)
    const row = res.record || { owner: c.owner, repo: c.name }
    if (res.ok) {
      appendFileSync(PLUGINS, JSON.stringify({ valid: true, checkedAt: new Date().toISOString(), ...row }) + '\n')
      valid++
    } else {
      appendFileSync(INVALID, JSON.stringify({ valid: false, reason: res.reason, checkedAt: new Date().toISOString(), ...row }) + '\n')
    }
    appendFileSync(STATE, id + '\n')
    done.add(id)
  }
  console.log(`[validate] processed ${processed} this run (total done ${done.size}); valid ${valid}; → plugins.jsonl / invalid.jsonl`)
}

main().catch((e) => { console.error(e); process.exit(1) })
