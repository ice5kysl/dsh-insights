#!/usr/bin/env node
/**
 * pipeline/analyze · history — snapshot history accumulator (D5, time-layer moat) → data/history.json
 *
 * Appends one dated entry per run containing the aggregate + every plugin's
 * score/grade. Format versioned, append-only, one entry per UTC day. The git
 * history of this file IS the long-term asset nobody else can backfill.
 *
 * @module dsh-insights/stage-13
 */

import { pathToFileURL } from 'node:url'
import { scoreAll } from './score.mjs'
import { PATHS, readJsonl, readJson, writeJson } from '../../lib/data.mjs'

const PLUGINS = PATHS.plugins
const OUT = PATHS.history
const FORMAT = 'history-v1'

function main() {
  const rows = readJsonl(PLUGINS)
  const { out, summary } = scoreAll(rows)
  const date = new Date().toISOString().slice(0, 10)
  const history = readJson(OUT, { format: FORMAT, entries: [] })
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
  writeJson(OUT, history)
  console.log(`[history] appended ${date} (total ${summary.total}) → ${history.entries.length} entries in data/history.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
