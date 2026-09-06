/**
 * lib/data.mjs — 数据访问层：路径常量 + JSON/JSONL 读写 + 常用加载器。
 *
 * 单一事实来源：所有 data/ 文件的路径与"读 JSONL / 按 full_name 建 Map"
 * 的重复实现都收敛到这里（此前散落在 12+ 个 pipeline/bin 文件中）。
 *
 * @module dsh-insights/lib/data
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const ROOT = join(import.meta.dirname, '..')
export const DATA = join(ROOT, 'data')
export const SITE = join(ROOT, 'site')

/** data/ 文件路径（对外契约文件名只增不改，见 docs/SCHEMA.md） */
export const PATHS = {
  plugins: join(DATA, 'plugins.jsonl'),
  invalid: join(DATA, 'invalid.jsonl'),
  candidatesAll: join(DATA, 'candidates-all.jsonl'),
  enrich: join(DATA, 'enrich.json'),
  analysis: join(DATA, 'analysis.json'),
  insights: join(DATA, 'insights.json'),
  health: join(DATA, 'health.json'),
  compat: join(DATA, 'compat.json'),
  downloads: join(DATA, 'downloads.json'),
  listed: join(DATA, 'listed.json'),
  dynamics: join(DATA, 'dynamics.json'),
  metrics: join(DATA, 'metrics.jsonl'),
  authorsGraph: join(DATA, 'authors-graph.json'),
  deep: join(DATA, 'deep.jsonl'),
  llm: join(DATA, 'llm.jsonl'),
  overlap: join(DATA, 'overlap.json'),
  scenarios: join(DATA, 'scenarios.json'),
  history: join(DATA, 'history.json'),
  seeds: join(DATA, 'seeds.json'),
  reviews: join(DATA, 'reviews.jsonl'),
  prevIds: join(DATA, 'prev-plugin-ids.json'),
  lastDiff: join(DATA, 'last-diff.md'),
  reportMd: join(DATA, 'report.md'),
  pluginsCsv: join(DATA, 'plugins.csv'),
  doneIds: join(DATA, 'state', 'done.ids'),
  llmDone: join(DATA, 'state', 'llm.done'),
  weeklyDir: join(DATA, 'weekly'),
  reportsDir: join(DATA, 'reports'),
}

/** 读 JSONL；容忍文件缺失（返回 []）与尾部半行（断点续跑 append 特性）。 */
export function readJsonl(path) {
  let text
  try { text = readFileSync(path, 'utf8') } catch { return [] }
  const rows = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { /* tolerate trailing partial appends */ }
  }
  return rows
}

export function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''))
}

export function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return fallback }
}

export function writeJson(path, obj, pretty = false) {
  writeFileSync(path, JSON.stringify(obj, null, pretty ? 2 : 0) + '\n')
}

export const loadPlugins = () => readJsonl(PATHS.plugins)

export const byFullName = (rows) => new Map((rows || []).map((r) => [r.full_name, r]))

/** enrich.json（数组）→ Map by full_name；enrich 尚未生成时返回空 Map。 */
export const loadEnrichMap = () => byFullName(readJson(PATHS.enrich, []))
