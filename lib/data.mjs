/**
 * lib/data.mjs — 数据访问层：路径常量 + JSON/JSONL 读写 + 常用加载器。
 *
 * 单一事实来源：所有 data/ 文件的路径与"读 JSONL / 按 full_name 建 Map"
 * 的重复实现都收敛到这里（此前散落在 12+ 个 pipeline/bin 文件中）。
 *
 * @module dsh-insights/lib/data
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs'
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
  shellSeeds: join(DATA, 'shell-seeds.json'),
  shellRows: join(DATA, 'shell-rows.json'),
  compatObserved: join(DATA, 'compat-observed.json'),
  replay: join(DATA, 'replay.json'),
  replayHistory: join(DATA, 'replay-history.jsonl'),
  replayShotsDir: join(DATA, 'replay-shots'),
  downloads: join(DATA, 'downloads.json'),
  crashCorpus: join(DATA, 'crash-corpus.json'),
  listed: join(DATA, 'listed.json'),
  dynamics: join(DATA, 'dynamics.json'),
  knownModels: join(DATA, 'known-models.json'),
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

/** 读 JSONL；容忍文件缺失（返回 []）与尾部半行（断点续跑 append 特性），
 *  但丢弃半行时告警行数——静默丢数据曾掩盖截断写（P1-6）。 */
export function readJsonl(path) {
  let text
  try { text = readFileSync(path, 'utf8') } catch { return [] }
  const rows = []
  let dropped = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { dropped++ /* tolerate trailing partial appends */ }
  }
  if (dropped) console.warn(`[lib/data] readJsonl ${path}: 丢弃 ${dropped} 行无法解析的内容（疑似尾部半行/截断写）`)
  return rows
}

/** 原子写：临时文件 + rename，避免中途 crash 留下截断文件（P1-6）。 */
function writeAtomic(path, text) {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, path)
}

export function writeJsonl(path, rows) {
  writeAtomic(path, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''))
}

export function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return fallback }
}

export function writeJson(path, obj, pretty = false) {
  writeAtomic(path, JSON.stringify(obj, null, pretty ? 2 : 0) + '\n')
}

/**
 * 读权威集（带「0 重复」硬门禁，P0-3）：plugins.jsonl 一旦出现重复
 * full_name（大小写不敏感），宁可管线停也不产出污染数据 —— 先跑
 * node bin/compact.mjs 清理。（P0-1 的写入查重使此断言常态不触发。）
 */
export const loadPlugins = () => {
  const rows = readJsonl(PATHS.plugins)
  const seen = new Set()
  const dups = []
  for (const r of rows) {
    const k = (r.full_name || '').toLowerCase()
    if (!k) continue
    if (seen.has(k)) dups.push(k)
    seen.add(k)
  }
  if (dups.length) {
    console.error(`[lib/data] plugins.jsonl 含 ${dups.length} 组重复 full_name（${[...new Set(dups)].slice(0, 5).join(', ')}）——先跑 node bin/compact.mjs`)
    process.exit(1)
  }
  // owner/repo 以 full_name（GitHub API  canonical 大小写）为准：历史行里
  // owner 可能残留候选来源的大小写（validate 曾分两处取值），不统一会让
  // /p/ 页面路径在两种大小写间漂移，macOS 上形成同名撞路径。
  return rows.map((r) => {
    if (!r.full_name) return r
    const [owner, repo] = String(r.full_name).split('/')
    return r.owner === owner && r.repo === repo ? r : { ...r, owner, repo }
  })
}

export const byFullName = (rows) => new Map((rows || []).map((r) => [r.full_name, r]))

/**
 * 活跃度是**时间相关**指标，必须在使用时现算，不能读 plugins.jsonl 里那份
 * 冻结的 `metrics.active30/idleDays/ageDays/ageGate1`。
 *
 * 背景（2026-09-17 口径更正，health-v6）：validate 首次校验时用 `Date.now()`
 * 算完这几个字段就再也不重算，而 refresh 只刷新 stars/pushed_at 等原始字段
 * —— 于是「超过 30 天无提交」这条规则对 1,734 个已经停更的仓库从未生效，
 * 站点「30 天活跃」虚报 100%，S+A 被高估约一倍。
 *
 * `metrics.hasZhDocs` 与时间无关，仍然直接读持久化值。
 *
 * @returns {{idleDays:number, active30:boolean, ageDays:number|null, ageGate1:boolean|null}|null}
 *          缺少 pushed_at 时返回 null（= 活跃度不可知，调用方应记入 missing，不得当通过）。
 */
export function deriveActivity(r, now = Date.now()) {
  const pa = r?.pushed_at
  if (!pa) return null
  const t = new Date(pa).getTime()
  if (Number.isNaN(t)) return null
  const idleDays = (now - t) / 86400000
  const ca = r?.created_at
  const ageMs = ca ? now - new Date(ca).getTime() : NaN
  const ageDays = Number.isNaN(ageMs) ? null : Number((ageMs / 86400000).toFixed(2))
  return {
    idleDays: Number(idleDays.toFixed(2)),
    active30: idleDays <= 30,
    ageDays,
    ageGate1: ageDays == null ? null : ageDays >= 1,
  }
}

/** enrich.json（数组）→ Map by full_name；enrich 尚未生成时返回空 Map。 */
export const loadEnrichMap = () => byFullName(readJson(PATHS.enrich, []))
