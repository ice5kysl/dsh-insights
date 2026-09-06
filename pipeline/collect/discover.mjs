#!/usr/bin/env node
/**
 * pipeline/collect · discover — discover candidate plugins from multiple sources.
 *
 * Sources (deduped by owner/repo, or by npm name):
 *   1. GitHub topic search: `topic:dsh-plugin`, `topic:deepseek-harness`
 *   2. Curated-list data directories: awesome-dsh-plugin/awesome-dsh-plugin
 *      `data/plugins`, imsai-sh catalog `catalog/plugins`
 *   3. Manual seeds (our own + reference plugins for calibration)
 *
 * Output: data/candidates.jsonl  (one candidate per line)
 *
 * @module dsh-insights/stage-1
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ghSearch, ghSearchAll, ghApi, NPM, raw } from '../../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const OUT = process.argv[2] || join(ROOT, 'data', 'candidates-all.jsonl')
const LIMIT_REPO_SOURCE = Number(process.env.LIMIT || 0)

const seen = new Set()
const rows = []
function pushRepo(repo, source, extra = {}) {
  const full = repo.full_name || `${repo.owner}/${repo.name}`
  if (!full.includes('/') || seen.has(full)) return
  seen.add(full)
  rows.push({
    kind: 'repo', id: full, source,
    name: full.split('/')[1], owner: full.split('/')[0],
    stars: repo.stargazers_count ?? 0,
    description: repo.description || '',
    topics: repo.topics || [],
    archived: repo.archived || false,
    fork: repo.fork || false,
    pushed_at: repo.pushed_at || null,
    created_at: repo.created_at || null,
    default_branch: repo.default_branch || null,
    html_url: repo.html_url || null,
    ...extra,
  })
}

/** List a repo directory (may paginate contents via API listing). */
async function listDir(owner, repo, path) {
  const out = []
  const r = await ghApi(`/repos/${owner}/${repo}/contents/${path}`)
  if (!r.ok) return out
  for (const it of r.body || []) if (typeof it.name === 'string') out.push(it.name)
  return out
}

async function main() {
  const t0 = Date.now()

  // 1) GitHub topic searches
  //    dsh-plugin (the official discovery channel, ~13.6k repos) is crawled in
  //    full via recursive created-window sharding (GitHub caps 1000/query).
  //    Secondary topics stay capped as supplementary sources (mostly overlap).
  const topicOrder = ['dsh-plugin', 'deepseek-harness', 'dsh-bundle', 'cordis-plugin']
  let topicTotal = null
  for (const topic of topicOrder) {
    if (topic === 'dsh-plugin') {
      const t0 = Date.now()
      const { items, warnings, total } = await ghSearchAll(`topic:${topic}`)
      if (total) topicTotal = { count: total, at: new Date().toISOString() }
      console.log(`[discover] topic:${topic} → ${items.length} (full crawl of ${total || '?'}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`)
      for (const w of warnings) console.warn(`[discover] ${w}`)
      for (const it of items) pushRepo(it, `topic:${topic}`)
    } else {
      const items = await ghSearch(`topic:${topic}`)
      console.log(`[discover] topic:${topic} → ${items.length} (capped 1000, supplementary)`)
      for (const it of items) pushRepo(it, `topic:${topic}`)
    }
  }

  // 2) curated data directories
  try {
    const a = await listDir('awesome-dsh-plugin', 'awesome-dsh-plugin', 'data/plugins')
    for (const f of a.filter((n) => n.endsWith('.yml'))) {
      const base = f.replace(/\.yml$/, '').split('__')
      if (base.length === 2) pushRepo({ full_name: `${base[0]}/${base[1]}`, owner: base[0], name: base[1] }, 'curated:awesome-dsh-plugin')
    }
    console.log(`[discover] curated awesome-dsh-plugin → ${a.length} entries`)
  } catch (e) { console.error('[discover] awesome-dsh-plugin dir failed', e.message) }
  try {
    const c = await listDir('imsai-sh', 'awesome-deepseek-harness-plugins', 'catalog/plugins')
    for (const f of c.filter((n) => n.endsWith('.json'))) {
      const base = f.replace(/\.json$/, '').split('--')
      if (base.length === 2) pushRepo({ full_name: `${base[0]}/${base[1]}`, owner: base[0], name: base[1] }, 'curated:imsai')
    }
    console.log(`[discover] curated imsai catalog → ${c.length} entries`)
  } catch (e) { console.error('[discover] imsai dir failed', e.message) }

  // 3) npm search (name/keyword signals)
  try {
    const q = encodeURIComponent('dsh deepseek-harness plugin')
    const r = await raw(`${NPM}/-/v1/search?text=${q}&size=250`)
    if (r.ok) {
      for (const o of r.body.objects || []) {
        const p = o.package || {}
        const name = p.name
        const key = `npm:${name}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({ kind: 'npm', id: key, source: 'npm-search', name, description: p.description || '', npmLink: p.links?.npm || null })
      }
      console.log(`[discover] npm search → ${r.body.objects.length}`)
    }
  } catch (e) { console.error('[discover] npm search failed', e.message) }

  // 4) seeds (calibration + ours)
  for (const repo of [
    { full_name: 'ice5kysl/dsh-workspace-kit', owner: 'ice5kysl', name: 'dsh-workspace-kit' },
    { full_name: 'ice5kysl/dsh-file-explorer-kit', owner: 'ice5kysl', name: 'dsh-file-explorer-kit' },
    { full_name: 'joejojoking-cloud/dsh-file-explorer', owner: 'joejojoking-cloud', name: 'dsh-file-explorer' },
    { full_name: 'omdsh-dev/DSH-better-sidebar', owner: 'omdsh-dev', name: 'DSH-better-sidebar' },
    { full_name: 'MichengAI/dsh-codex-ui', owner: 'MichengAI', name: 'dsh-codex-ui' },
    { full_name: '0xsline/dsh-spotlight', owner: '0xsline', name: 'dsh-spotlight' },
  ]) pushRepo(repo, 'seed')

  const limited = LIMIT_REPO_SOURCE ? rows.filter((r) => r.kind === 'repo').slice(0, LIMIT_REPO_SOURCE) : rows
  writeFileSync(OUT, limited.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(join(ROOT, 'data', 'discover-meta.json'), JSON.stringify({
    at: new Date().toISOString(),
    topicTotal,
    candidates: limited.length,
    repoCandidates: limited.filter((r) => r.kind === 'repo').length,
  }, null, 2) + '\n')
  console.log(`[discover] total candidates: ${limited.length} (source rows ${rows.length}) → ${OUT} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
