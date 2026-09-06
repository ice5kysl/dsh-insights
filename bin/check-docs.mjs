#!/usr/bin/env node
/**
 * bin/check-docs — 文档数字对账（P0-8 根治；双语版）。
 *
 * 校验 README.md（EN，默认）与 README.zh-CN.md 中的权威集/分桶数字与 data/analysis.json 一致，
 * 不一致即非 0 退出（逼着快照后同步文档）。历史叙述（带时点标注）不受限。
 *
 * Run: node bin/check-docs.mjs
 */

import { readFileSync } from 'node:fs'
import { PATHS, readJson } from '../lib/data.mjs'

const a = readJson(PATHS.analysis)
const expected = a?.totals?.authoritative
const invalid = a?.coverage?.invalidUnique
if (!expected) { console.error('[check-docs] analysis.json 缺失或不含 totals.authoritative'); process.exit(1) }

const fmt = (n) => n.toLocaleString('en-US')
let fail = 0
for (const file of ['README.md', 'README.zh-CN.md']) {
  let txt
  try { txt = readFileSync(file, 'utf8') } catch { console.error(`[check-docs] ${file} 不存在（跳过）`); fail = 1; continue }
  const check = (label, want, re) => {
    const m = txt.match(re)
    if (!m) { console.error(`[check-docs] ${file} 未找到${label}锚点`); fail = 1; return }
    const got = m[1] || m[2]
    if (got !== fmt(want)) { console.error(`[check-docs] ${file} ${label}：README=${got} vs analysis.json=${fmt(want)}`); fail = 1 }
    else console.log(`[check-docs] ${file} ${label} ✓ ${fmt(want)}`)
  }
  check('权威集', expected, /\*\*(?:Authoritative set|权威集)\s*([\d,]+)\*\*/)
  if (invalid != null) check('分桶', invalid, /分桶\s*([\d,]+)|([\d,]+)\s*noise buckets/)
}

if (fail) { console.error('[check-docs] 不一致——请按 analysis.json 更新 README（数字带口径与时点）'); process.exit(1) }
console.log('[check-docs] README 数字与 analysis.json 一致')
