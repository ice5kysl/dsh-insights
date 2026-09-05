#!/usr/bin/env node
/**
 * dsh-plugin-insights · query CLI over the authoritative snapshot.
 *
 * Examples:
 *   node bin/query.mjs --sort stars --top 15
 *   node bin/query.mjs --npm stale --sort stars
 *   node bin/query.mjs --zh --active30
 *   node bin/query.mjs --search workspace
 *
 * @module dsh-plugin-insights/query
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE = join(import.meta.dirname, '..', 'data', 'plugins.jsonl')
const args = process.argv.slice(2)
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)

function main() {
  let rows
  try {
    rows = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  } catch { console.error('no snapshot yet: run the pipeline first'); process.exit(1) }

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
  const search = val('--search')
  if (search) rows = rows.filter((r) => (r.full_name + ' ' + (r.description || '')).toLowerCase().includes(search.toLowerCase()))

  const sortBy = val('--sort') || 'stars'
  rows = rows.slice().sort((a, b) => ((b[sortBy] ?? b.metrics?.[sortBy] ?? 0)) - ((a[sortBy] ?? a.metrics?.[sortBy] ?? 0)))
  const top = Number(val('--top') || 0)
  if (top) rows = rows.slice(0, top)

  console.log(`# ${rows.length} plugins`)
  console.log('repo | ★ | npm | 中文/双语 | 活跃30 | 描述')
  console.log('---|---|---|---|---|---')
  for (const r of rows) {
    const npm = r.npm?.published ? (r.npm.latest || '✅') : '—'
    console.log(`${r.full_name} | ${r.stars || 0} | ${npm} | ${r.metrics?.hasZhDocs ? '✅' : '—'} | ${r.metrics?.active30 ? '✅' : '—'} | ${(r.description || '').slice(0, 70)}`)
  }
}

main()
