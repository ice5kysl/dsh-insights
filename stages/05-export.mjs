#!/usr/bin/env node
/**
 * Stage 5 — export the authoritative set as CSV.
 * Output: data/plugins.csv
 *
 * @module dsh-plugin-insights/stage-5
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'data', 'plugins.jsonl')

const esc = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function main() {
  const rows = readFileSync(SRC, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
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
  writeFileSync(join(ROOT, 'data', 'plugins.csv'), lines.join('\n') + '\n')
  console.log(`[export] ${rows.length} rows → data/plugins.csv`)
}

main()
