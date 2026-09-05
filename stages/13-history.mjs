#!/usr/bin/env node
/**
 * Stage 13 — snapshot history accumulator (D5, time-layer moat) → data/history.json
 *
 * Appends one dated entry per run containing the aggregate + every plugin's
 * score/grade. Format versioned, append-only, one entry per UTC day. The git
 * history of this file IS the long-term asset nobody else can backfill.
 *
 * @module dsh-plugin-insights/stage-13
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { scoreAll } from './08-score.mjs'

const ROOT = join(import.meta.dirname, '..')
const PLUGINS = join(ROOT, 'data', 'plugins.jsonl')
const OUT = join(ROOT, 'data', 'history.json')
const FORMAT = 'history-v1'

function readRows(f) {
  const rows = []
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { /* tolerate */ }
  }
  return rows
}

function main() {
  const rows = readRows(PLUGINS)
  const { out, summary } = scoreAll(rows)
  const date = new Date().toISOString().slice(0, 10)
  let history = { format: FORMAT, entries: [] }
  try { history = JSON.parse(readFileSync(OUT, 'utf8')) } catch { /* first run */ }
  if (history.entries.length && history.entries[history.entries.length - 1].date === date) {
    console.log(`[history] ${date} already recorded — skipping (${history.entries.length} entries)`)
    return
  }
  const plugins = {}
  for (const r of out) plugins[r.full_name] = { score: r.health.score, grade: r.health.grade }
  history.entries.push({
    date,
    total: summary.total,
    grades: summary.grades,
    avg: summary.avg,
    median: summary.median,
    plugins,
  })
  writeFileSync(OUT, JSON.stringify(history) + '\n')
  console.log(`[history] appended ${date} (total ${summary.total}) → ${history.entries.length} entries in data/history.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
