#!/usr/bin/env node
/**
 * pipeline/publish · export-csv — export the authoritative set as CSV.
 * Output: data/plugins.csv
 *
 * @module dsh-insights/stage-5
 */

import { writeFileSync } from 'node:fs'
import { PATHS, readJsonl } from '../../lib/data.mjs'

const SRC = PATHS.plugins

const esc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function main() {
  const rows = readJsonl(SRC)
  const cols = [
    'full_name', 'html_url', 'stars', 'forks', 'created_at', 'pushed_at',
    'license', 'pkgName', 'version', 'source',
    'files.libIndex', 'files.libClient', 'files.cordisPatch', 'files.readme', 'files.readmeZh',
    'eval.hasClientExport', 'eval.mainIsLib', 'eval.dshPlatform',
    'metrics.active30', 'metrics.ageGate1', 'metrics.hasZhDocs',
    'npm.published', 'npm.latest', 'topics', 'description',
  ]
  const get = (r, path) => {
    let o = r
    for (const k of path.split('.')) {
      if (o == null) return ''
      o = o[k]
    }
    return o == null ? '' : o
  }
  const lines = [cols.join(',')]
  for (const r of rows) {
    const topics = (r.topics || []).join('|')
    lines.push(cols.map((c) => esc(c === 'topics' ? topics : c === 'description' ? r.description : get(r, c))).join(','))
  }
  writeFileSync(PATHS.pluginsCsv, lines.join('\n') + '\n')
  console.log(`[export] ${rows.length} rows → data/plugins.csv`)
}

main()
