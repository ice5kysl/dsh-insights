#!/usr/bin/env node
/**
 * bin/pipeline.mjs — 管线统一编排器（管线的单一事实来源）
 *
 *   node bin/pipeline.mjs <profile> [--only a,b] [--from step] [--dry]
 *
 * Profiles:
 *   daily     CI 每日轻量刷新（collect 增量的低成本部分 + 发布层）
 *   friday    daily + 内容层（信件 diff 驱动 + 生态周报）—— 每周五 CI
 *   snapshot  分析 + 发布全链（评分/导出/徽章/历史/重叠）
 *   full      全量：发现 → 校验 → snapshot
 *   content   只跑内容层（letters + weekly + pages）
 *
 * 层（pipeline/<layer>/）：
 *   collect 采集 → validate 校验（含校准回归）→ analyze 分析
 *   → publish 发布（站点/数据/徽章/diff）→ content 内容（信件/周报）
 *   L2 官方动态（M2）：collect/dynamics.mjs → publish /dynamics 页 → 周报双栏
 *
 * 手动/特殊（不进默认 profile，用 --only 调用）：
 *   regress（校准硬门禁）· deep（限量深检）· llm-tags（需 DEEPSEEK_API_KEY）· scenarios
 *
 * @module dsh-insights/pipeline
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

// 规范顺序即管线数据流顺序；profile 从中取子集。
const STEPS = [
  ['lists',       'pipeline/collect/lists.mjs'],
  ['discover',    'pipeline/collect/discover.mjs'],
  ['npm-map',     'pipeline/collect/npm-map.mjs'],
  ['downloads',   'pipeline/collect/downloads.mjs'],
  ['dynamics',    'pipeline/collect/dynamics.mjs'],
  ['author-graph', 'pipeline/collect/author-graph.mjs'],
  ['validate',    'pipeline/validate/validate.mjs'],
  ['regress',     'pipeline/validate/regress.mjs'],
  ['deep',        'pipeline/validate/deep.mjs'],
  ['analyze',     'pipeline/analyze/analyze.mjs'],
  ['score',       'pipeline/analyze/score.mjs'],
  ['compat',      'pipeline/analyze/compat.mjs'],
  ['history',     'pipeline/analyze/history.mjs'],
  ['overlap',     'pipeline/analyze/overlap.mjs'],
  ['llm-tags',    'pipeline/analyze/llm-tags.mjs'],
  ['scenarios',   'pipeline/analyze/scenarios.mjs'],
  ['metrics',     'pipeline/analyze/metrics.mjs'],
  ['export-csv',  'pipeline/publish/export-csv.mjs'],
  ['export-json', 'pipeline/publish/export-json.mjs'],
  ['badges',      'pipeline/publish/badges.mjs'],
  ['site',        'pipeline/publish/site.mjs'],
  ['diff',        'pipeline/publish/diff.mjs'],
  ['pages',       'pipeline/publish/pages.mjs'],
  ['letters',     'pipeline/content/letters.mjs'],
  ['weekly',      'pipeline/content/weekly.mjs'],
]

const DAILY = ['lists', 'downloads', 'dynamics', 'analyze', 'site', 'export-csv', 'diff', 'pages']
const SNAPSHOT = ['analyze', 'score', 'history', 'export-csv', 'export-json', 'overlap', 'scenarios', 'badges', 'site', 'pages']
const CONTENT = ['letters', 'weekly', 'pages']
const PROFILES = {
  daily: DAILY,
  friday: [...new Set(['author-graph', ...DAILY, 'metrics', ...CONTENT])],
  snapshot: SNAPSHOT,
  full: ['lists', 'discover', 'npm-map', 'downloads', 'validate', ...SNAPSHOT, 'diff'],
  content: CONTENT,
}

const args = process.argv.slice(2)
const profile = args.find((a) => !a.startsWith('--'))
const dry = args.includes('--dry')
const onlyIdx = args.indexOf('--only')
const fromIdx = args.indexOf('--from')
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',').filter(Boolean) : null
const from = fromIdx >= 0 ? args[fromIdx + 1] : null

const scriptOf = new Map(STEPS)
const canonicalOrder = STEPS.map(([n]) => n)

let steps
if (only) {
  const unknown = only.filter((s) => !scriptOf.has(s))
  if (unknown.length) { console.error(`unknown step(s): ${unknown.join(', ')}\navailable: ${canonicalOrder.join(', ')}`); process.exit(2) }
  steps = only
} else {
  if (!profile || !PROFILES[profile]) {
    console.error(`usage: node bin/pipeline.mjs <${Object.keys(PROFILES).join('|')}> [--only a,b] [--from step] [--dry]`)
    process.exit(2)
  }
  steps = PROFILES[profile].filter((s) => scriptOf.has(s))
}
if (from) {
  const i = steps.indexOf(from)
  if (i < 0) { console.error(`--from ${from} 不在本次步骤序列中: ${steps.join(', ')}`); process.exit(2) }
  steps = steps.slice(i)
}

console.log(`[pipeline] ${only ? '--only' : profile} → ${steps.join(' → ')}${dry ? '  (dry)' : ''}`)
if (dry) process.exit(0)

for (const name of steps) {
  console.log(`\n=== ${name} (${scriptOf.get(name)}) ===`)
  const r = spawnSync(process.execPath, [join(ROOT, scriptOf.get(name))], { stdio: 'inherit', env: { ...process.env } })
  if (r.status !== 0) { console.error(`[pipeline] step failed: ${name} (exit ${r.status})`); process.exit(r.status ?? 1) }
}
console.log('\n[pipeline] done')
