#!/usr/bin/env node
/**
 * pipeline/validate · validate — validate candidates and build the authoritative set.
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
 * @module dsh-insights/stage-2
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ghApi, ghContents, npmDoc, sleep, lastRemaining } from '../../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const CAND = process.argv[2] || join(ROOT, 'data', 'candidates-all.jsonl')
const PLUGINS = join(ROOT, 'data', 'plugins.jsonl')
const INVALID = join(ROOT, 'data', 'invalid.jsonl')
const STATE = join(ROOT, 'data', 'state', 'done.ids')
const LIMIT = Number(process.env.LIMIT || 0)
const CONCURRENCY = Number(process.env.CONCURRENCY || 1)
const BUDGET_FLOOR = Number(process.env.BUDGET_FLOOR || 250)

mkdirSync(join(ROOT, 'data', 'state'), { recursive: true })

const done = new Set(existsSync(STATE) ? readFileSync(STATE, 'utf8').split('\n').filter(Boolean).map((s) => s.toLowerCase()) : [])
// 已落库行的 full_name 小写索引（valid+invalid 两侧）——append 前查重，防大小写/改名变体重复（P0-1）
const seenRows = new Set()
for (const f of [PLUGINS, INVALID]) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      const fn = r.full_name || (r.owner && r.repo ? `${r.owner}/${r.repo}` : null)
      if (fn) seenRows.add(fn.toLowerCase())
    } catch { /* tolerate trailing partial appends */ }
  }
}
const rowKey = (row) => (row.full_name || (row.owner && row.repo ? `${row.owner}/${row.repo}` : '') || '').toLowerCase()

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
  const sizeOf = new Map()
  for (const t of r.body?.tree || []) {
    if (!t.path) continue
    set.add(t.path)
    if (typeof t.size === 'number') sizeOf.set(t.path, t.size)
  }
  return { set, sizeOf, has: (p) => set.has(p) }
}

async function validateOne(c) {
  if (!hasSignal(c)) return { ok: false, reason: 'no-signal' }
  if (c.fork) return { ok: false, reason: 'fork' }
  if (c.archived) return { ok: false, reason: 'archived' }

  // ---- cost-optimised: probe the default branch tree BEFORE the meta call.
  // Search candidates already carry stars/dates/topics; we only need a branch
  // to read files. Meta is fetched only when fields are missing or probing
  // fails (renamed/deleted repo, npm-mapped rows).
  const needMeta = !(c.created_at && c.pushed_at) || !c.html_url
  let branch = c.default_branch || null
  let tree = null
  if (!needMeta) {
    for (const b of [branch, 'main', 'master'].filter(Boolean)) {
      const t = await repoTreeFiles(c.owner, c.name, b)
      if (t) { tree = t; branch = b; break }
    }
    if (!tree && !branch) { /* probing failed on candidate-supplied names */ }
  }

  let m = null
  if (!tree || needMeta) {
    const metaR = await ghApi(`/repos/${c.owner}/${c.name}`)
    if (!metaR.ok) return { ok: false, reason: metaR.status === 404 ? 'repo-gone' : `repo-http${metaR.status}` }
    m = metaR.body
    if (m.fork) return { ok: false, reason: 'fork' }
    if (m.archived) return { ok: false, reason: 'archived' }
    branch = m.default_branch || branch || 'main'
    if (!tree) tree = await repoTreeFiles(c.owner, c.name, branch)
    if (!tree) return { ok: false, reason: 'tree-failed', record: { owner: c.owner, repo: c.name } }
  }

  const meta = m || {
    full_name: `${c.owner}/${c.name}`,
    html_url: c.html_url || `https://github.com/${c.owner}/${c.name}`,
    stargazers_count: c.stars ?? 0, forks_count: c.forks ?? 0,
    created_at: c.created_at, pushed_at: c.pushed_at,
    topics: c.topics || [], description: c.description || '',
    license: c.license ?? null,
  }
  const record = {
    kind: 'repo', owner: c.owner, repo: c.name,
    full_name: meta.full_name || `${c.owner}/${c.name}`,
    html_url: meta.html_url || `https://github.com/${meta.full_name}`,
    stars: meta.stargazers_count ?? 0, forks: meta.forks_count ?? 0,
    created_at: meta.created_at, pushed_at: meta.pushed_at,
    archived: false, fork: false,
    default_branch: branch,
    topics: meta.topics || [],
    description: meta.description || '',
    license: meta.license?.spdx_id ?? meta.license ?? null,
    source: c.source || null,
  }

  const hasFile = (p) => tree ? tree.has(p) : null
  const treeHas = (re) => tree ? [...tree.set].some((p) => re.test(p)) : null
  record.files = {
    tree: Boolean(tree),
    cordisPatch: hasFile('cordis.patch.yml'),
    libIndex: hasFile('lib/index.js'),
    libClient: hasFile('lib/client.js'),
    readme: hasFile('README.md'),
    readmeZh: hasFile('README.zh-CN.md'),
    license: hasFile('LICENSE'),
    readmeBytes: tree?.sizeOf?.get('README.md') ?? null,
    hasTests: treeHas(/(^|\/)(__tests__|tests?|spec)(\/|\.)|(\.(test|spec)\.(m?js|ts)$)/i),
    hasCI: treeHas(/^\.github\/workflows\/.+\.ya?ml$/i),
    hasDocsDir: treeHas(/^docs\//i),
  }

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
  const repos = lines.filter((c) => c.kind === 'repo' && c.id && !done.has(String(c.id).toLowerCase()))
  let processed = 0, valid = 0, transient = 0, transConsec = 0
  const conc = Math.max(1, CONCURRENCY)
  const queue = repos.slice()
  async function worker() {
    while (queue.length) {
      const c = queue.shift()
      if (!c) break
      if (LIMIT && processed >= LIMIT) break
      if (lastRemaining >= 0 && lastRemaining < BUDGET_FLOOR) {
        console.error(`[validate] budget floor ${BUDGET_FLOOR} reached (remaining ${lastRemaining}); stopping cleanly — rerun later to resume`)
        queue.length = 0
        break
      }
      processed++
      try {
        const res = await validateOne(c)
        const row = res.record || { owner: c.owner, repo: c.name, source: c.source || null }
        const key = rowKey(row)
        const dup = key && seenRows.has(key)
        if (dup) console.error(`[validate] dup skipped ${key}`)
        if (res.ok) {
          if (!dup) {
            appendFileSync(PLUGINS, JSON.stringify({ valid: true, checkedAt: new Date().toISOString(), ...row }) + "\n")
            seenRows.add(key)
            valid++
          }
        } else if (!dup) {
          appendFileSync(INVALID, JSON.stringify({ valid: false, reason: res.reason, checkedAt: new Date().toISOString(), ...row }) + "\n")
          seenRows.add(key)
        }
        appendFileSync(STATE, String(c.id).toLowerCase() + "\n")
        done.add(String(c.id).toLowerCase())
        transConsec = 0
      } catch (e) {
        transient++
        transConsec++
        const msg = String(e?.message || '')
        if (/rate|403|abuse|secondary/i.test(msg) && transConsec >= 8) {
          console.error('[validate] persistent rate limiting — pausing cleanly; rerun later to resume (progress kept)')
          process.exit(0)
        }
        console.error(`[validate] transient ${c.id}: ${msg.slice(0, 120)}`)
        if (transient % 10 === 0) await sleep(5000)
      }
    }
  }
  await Promise.all(Array.from({ length: conc }, worker))
  console.log(`[validate] processed ${processed} this run (${valid} valid, ${transient} transient) · total done ${done.size} · remaining ${repos.length - processed}`)
}

export { hasSignal, validateOne }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
