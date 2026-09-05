#!/usr/bin/env node
/**
 * Stage 2 — validate candidates and build the authoritative set.
 *
 * Cost-optimized:
 *   - cheap signal filter first (no API calls for noise)
 *   - one repo meta call + one recursive git-tree call (file existence:
 *     patch, lib/, README, LICENSE) + one package.json call
 *   - npm registry status only for manifest-bearing candidates (registry is
 *     not GitHub-rate-limited)
 *   - per-row try/catch + retries; rows that fail are NOT marked done and
 *     are retried on the next run (resumable via data/state/done.ids)
 *
 * Outputs:
 *   data/plugins.jsonl   authoritative set
 *   data/invalid.jsonl   bucketed noise/rejects
 *
 * @module dsh-plugin-insights/stage-2
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { ghApi, ghContents, npmDoc, sleep } from '../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..')
const CAND = process.argv[2] || join(ROOT, 'data', 'candidates-all.jsonl')
const PLUGINS = join(ROOT, 'data', 'plugins.jsonl')
const INVALID = join(ROOT, 'data', 'invalid.jsonl')
const STATE = join(ROOT, 'data', 'state', 'done.ids')
const LIMIT = Number(process.env.LIMIT || 0)
const CONCURRENCY = Number(process.env.CONCURRENCY || 1)

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

async function repoTreeFiles(owner, repo, branch) {
  const r = await ghApi(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`)
  if (!r.ok) return null
  const set = new Set()
  for (const t of r.body?.tree || []) if (t.path) set.add(t.path)
  return set
}

async function validateOne(c) {
  if (!hasSignal(c)) return { ok: false, reason: 'no-signal' }
  if (c.fork) return { ok: false, reason: 'fork' }
  if (c.archived) return { ok: false, reason: 'archived' }

  const metaR = await ghApi(`/repos/${c.owner}/${c.name}`)
  if (!metaR.ok) return { ok: false, reason: metaR.status === 404 ? 'repo-gone' : `repo-http${metaR.status}` }
  const m = metaR.body
  if (m.fork) return { ok: false, reason: 'fork' }
  if (m.archived) return { ok: false, reason: 'archived' }
  const branch = m.default_branch || 'main'
  const record = {
    kind: 'repo', owner: c.owner, repo: c.name,
    full_name: m.full_name,
    html_url: m.html_url || `https://github.com/${m.full_name}`,
    stars: m.stargazers_count ?? 0, forks: m.forks_count ?? 0,
    created_at: m.created_at, pushed_at: m.pushed_at,
    archived: false, fork: false,
    default_branch: branch,
    topics: m.topics || [],
    description: m.description || '',
    license: m.license?.spdx_id || null,
    source: c.source || null,
  }

  const tree = await repoTreeFiles(record.owner, record.repo, branch)
  const hasFile = (p) => tree ? tree.has(p) : null
  record.files = {
    tree: Boolean(tree),
    cordisPatch: hasFile('cordis.patch.yml'),
    libIndex: hasFile('lib/index.js'),
    libClient: hasFile('lib/client.js'),
    readme: hasFile('README.md'),
    readmeZh: hasFile('README.zh-CN.md'),
    license: hasFile('LICENSE'),
  }
  if (!tree) return { ok: false, reason: 'tree-failed', record }

  const pkgRaw = await ghContents(record.owner, record.repo, 'package.json', branch)
  if (!pkgRaw) return { ok: false, reason: 'no-package.json', record }
  let pkg = null
  try { pkg = JSON.parse(pkgRaw) } catch { return { ok: false, reason: 'package-parse', record } }

  record.pkgName = pkg.name || record.repo
  record.version = pkg.version || null
  const patch = pkg.dsh?.bundle?.patch || (pkg.dsh?.bundle ? 'cordis.patch.yml' : null)
  if (!patch) return { ok: false, reason: 'no-dsh-bundle', record }
  record.dshPatch = patch
  const patchPath = patch.replace(/^\.\//, '')
  if (tree && !tree.has(patchPath)) return { ok: false, reason: 'patch-missing', record }
  const patchText = await ghContents(record.owner, record.repo, patchPath, branch)
  if (patchText == null) return { ok: false, reason: 'patch-fetch', record }
  record.patchHasName = /name:\s*\S/.test(patchText)

  record.eval = {
    hasClientExport: typeof pkg.exports?.['./client']?.default === 'string',
    mainIsLib: pkg.main === 'lib/index.js',
    licenseField: typeof pkg.license === 'string' ? pkg.license : null,
    filesWhitelist: Array.isArray(pkg.files) ? pkg.files : null,
    repoUrl: pkg.repository?.url || null,
    dshPlatform: pkg.dsh?.client?.platform || null,
    dshInject: Array.isArray(pkg.dsh?.client?.inject) ? pkg.dsh.client.inject : null,
  }
  const ageDays = (Date.now() - new Date(record.created_at).getTime()) / 86400000
  const idleDays = (Date.now() - new Date(record.pushed_at).getTime()) / 86400000
  record.metrics = {
    ageDays: Number(ageDays.toFixed(2)),
    idleDays: Number(idleDays.toFixed(2)),
    active30: idleDays <= 30,
    ageGate1: ageDays >= 1,
    hasZhDocs: record.files.readmeZh || (record.files.readme && (pkgRaw.match(/[\u4e00-\u9fff]/) !== null)),
  }

  try {
    const npm = await npmDoc(record.pkgName)
    record.npm = npm ? { published: true, latest: npm.latest, versions: npm.versions, latestTime: npm.latestTime } : { published: false }
  } catch { record.npm = { published: false } }
  return { ok: true, record }
}

async function main() {
  const lines = readFileSync(CAND, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const repos = lines.filter((c) => c.kind === 'repo' && c.id && !done.has(c.id))
  let processed = 0, valid = 0, transient = 0
  const conc = Math.max(1, CONCURRENCY)
  const queue = repos.slice()
  async function worker() {
    while (queue.length) {
      const c = queue.shift()
      if (!c) break
      if (LIMIT && processed >= LIMIT) break
      processed++
      try {
        const res = await validateOne(c)
        const row = res.record || { owner: c.owner, repo: c.name, source: c.source || null }
        if (res.ok) {
          appendFileSync(PLUGINS, JSON.stringify({ valid: true, checkedAt: new Date().toISOString(), ...row }) + "\n")
          valid++
        } else {
          appendFileSync(INVALID, JSON.stringify({ valid: false, reason: res.reason, checkedAt: new Date().toISOString(), ...row }) + "\n")
        }
        appendFileSync(STATE, c.id + "\n")
        done.add(c.id)
      } catch (e) {
        transient++
        console.error(`[validate] transient ${c.id}: ${e?.message}`)
        if (transient % 10 === 0) await sleep(5000)
      }
    }
  }
  await Promise.all(Array.from({ length: conc }, worker))
    if (LIMIT && processed >= LIMIT) break
    processed++
    try {
      const res = await validateOne(c)
      const row = res.record || { owner: c.owner, repo: c.name, source: c.source || null }
      if (res.ok) {
        appendFileSync(PLUGINS, JSON.stringify({ valid: true, checkedAt: new Date().toISOString(), ...row }) + '\n')
        valid++
      } else {
        appendFileSync(INVALID, JSON.stringify({ valid: false, reason: res.reason, checkedAt: new Date().toISOString(), ...row }) + '\n')
      }
      appendFileSync(STATE, c.id + '\n')
      done.add(c.id)
    } catch (e) {
      transient++
      console.error(`[validate] transient ${c.id}: ${e?.message}`)
      if (transient % 10 === 0) await sleep(5000)
    }
  }
  console.log(`[validate] processed ${processed} this run (${valid} valid, ${transient} transient) · total done ${done.size} · remaining ${repos.length - processed}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
