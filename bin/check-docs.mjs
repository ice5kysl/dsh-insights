#!/usr/bin/env node
/**
 * bin/check-docs — 文档数字对账（P0-8 根治）。
 *
 * 校验 README 数据产出表中的权威集/分桶数字与 data/analysis.json 一致，
 * 不一致即非 0 退出（逼着快照后同步文档）。历史叙述（带时点标注）不受限。
 *
 * Run: node bin/check-docs.mjs   （npm run check:docs）
 */

import { readFileSync } from 'node:fs'
import { PATHS, readJson } from '../lib/data.mjs'

const a = readJson(PATHS.analysis)
const expected = a?.totals?.authoritative
const invalid = a?.coverage?.invalidUnique
if (!expected) { console.error('[check-docs] analysis.json 缺失或不含 totals.authoritative'); process.exit(1) }

const readme = readFileSync('README.md', 'utf8')
const fmt = (n) => n.toLocaleString('en-US')
let fail = 0
const check = (label, want, re) => {
  const m = readme.match(re)
  if (!m) { console.error(`[check-docs] README 未找到${label}数字锚点`); fail = 1; return }
  if (m[1] !== fmt(want)) { console.error(`[check-docs] ${label}：README=${m[1]} vs analysis.json=${fmt(want)}`); fail = 1 }
  else console.log(`[check-docs] ${label} ✓ ${fmt(want)}`)
}
check('权威集', expected, /\*\*权威集\s*([\d,]+)\*\*/)
if (invalid != null) check('分桶', invalid, /分桶\s*([\d,]+)/)

if (fail) { console.error('[check-docs] 不一致——请按 analysis.json 更新 README（数字带口径与时点）'); process.exit(1) }
console.log('[check-docs] README 数字与 analysis.json 一致')
