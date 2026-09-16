#!/usr/bin/env node
/**
 * pipeline/publish · export-csv — export the authoritative set as CSV.
 * Output: data/plugins.csv
 *
 * @module dsh-insights/stage-5
 */

import { writeFileSync } from 'node:fs'
import { PATHS, readJsonl, deriveActivity } from '../../lib/data.mjs'

const SRC = PATHS.plugins

const esc = (v) => {
  let s = v == null ? '' : String(v).replace(/\r/g, ' ')
  if (/^[=+\-@]/.test(s)) s = "'" + s // 公式注入防护（Excel/Sheets）
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
    // 活跃度列必须是现算值：持久化的 metrics.active30/ageGate1 是首次校验时冻结的（health-v6）。
    const act = deriveActivity(r)
    const val = (c) => {
      if (c === 'topics') return topics
      if (c === 'description') return r.description
      if (c === 'metrics.active30') return act ? act.active30 : ''
      if (c === 'metrics.ageGate1') return act ? act.ageGate1 : ''
      return get(r, c)
    }
    lines.push(cols.map((c) => esc(val(c))).join(','))
  }
  writeFileSync(PATHS.pluginsCsv, lines.join('\n') + '\n')
  console.log(`[export] ${rows.length} rows → data/plugins.csv`)
}

main()
