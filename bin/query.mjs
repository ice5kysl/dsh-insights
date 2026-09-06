#!/usr/bin/env node
/**
 * dsh-insights · query CLI over the authoritative snapshot.
 *
 * Examples:
 *   node bin/query.mjs --sort stars --top 15
 *   node bin/query.mjs --npm stale --sort stars
 *   node bin/query.mjs --grade A --top 20          # 健康 A 级
 *   node bin/query.mjs --min-score 95
 *   node bin/query.mjs --zh --active30
 *   node bin/query.mjs --search workspace
 *
 * Health is scored inline with the same rule set as the snapshot (08-score),
 * so results are always consistent with data/insights.json.
 *
 * @module dsh-insights/query
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scoreAll } from '../pipeline/analyze/score.mjs'

const FILE = join(import.meta.dirname, '..', 'data', 'plugins.jsonl')
const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)

function main() {
  let rows
  try {
    rows = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  } catch { console.error('no snapshot yet: run the pipeline first'); process.exit(1) }

  const healthBy = new Map(scoreAll(rows).out.map((r) => [r.full_name, r.health]))

  if (has('--npm')) {
    const mode = val('--npm') || 'published'
    rows = rows.filter((r) => {
      if (mode === 'published') return r.npm?.published
      if (mode === 'unpublished') return !r.npm?.published
      if (mode === 'stale') return r.npm?.published && r.version && r.npm.latest && r.npm.latest !== r.version
      return true
    })
  }
  if (has('--zh')) rows = rows.filter((r) => r.metrics?.hasZhDocs)
  if (has('--active30')) rows = rows.filter((r) => r.metrics?.active30)
  const grade = val('--grade')
  if (grade) rows = rows.filter((r) => healthBy.get(r.full_name)?.grade === grade.toUpperCase())
  const minScore = Number(val('--min-score') || 0)
  if (minScore) rows = rows.filter((r) => (healthBy.get(r.full_name)?.score ?? -1) >= minScore)
  const search = val('--search')
  if (search) rows = rows.filter((r) => (r.full_name + ' ' + (r.description || '')).toLowerCase().includes(search.toLowerCase()))

  const sortBy = val('--sort') || 'stars'
  rows = rows.slice().sort((a, b) => {
    if (sortBy === 'health') {
      const hs = (x) => healthBy.get(x.full_name)?.score ?? -1
      return hs(b) - hs(a)
    }
    return ((b[sortBy] ?? b.metrics?.[sortBy] ?? 0)) - ((a[sortBy] ?? a.metrics?.[sortBy] ?? 0))
  })
  const top = Number(val('--top') || 0)
  if (top) rows = rows.slice(0, top)

  console.log(`# ${rows.length} plugins`)
  console.log('repo | 健康 | ★ | npm | 中文/双语 | 活跃30 | 描述')
  console.log('---|---|---|---|---|---|---')
  for (const r of rows) {
    const h = healthBy.get(r.full_name)
    const npm = r.npm?.published ? (r.npm.latest || '✅') : '—'
    const hs = h ? `${h.grade}(${h.score})` : '—'
    console.log(`${r.full_name} | ${hs} | ${r.stars || 0} | ${npm} | ${r.metrics?.hasZhDocs ? '✅' : '—'} | ${r.metrics?.active30 ? '✅' : '—'} | ${(r.description || '').slice(0, 70)}`)
  }
}

main()
