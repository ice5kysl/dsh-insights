#!/usr/bin/env node
/**
 * pipeline/publish · readme-sync — README 数字与 analysis.json 自动对账（根治 P0-8 漂移）。
 *
 * 重写两份 README 的 <!-- stats:begin --> … <!-- stats:end --> 区间（data 表
 * plugins.jsonl 行的权威集/分桶数字 + 快照日），与 bin/check-docs.mjs 的锚点
 * 格式严格同构（check-docs 继续当校验关卡）。内容无变化不写盘——幂等，
 * 数字变了才产生 diff，bot 提交时自然带上。
 * 锚点缺失 → exit 1（模板被破坏，亮红灯而非静默跳过）。
 * Status 段等带时点标注的历史叙述不在同步范围。
 *
 * @module dsh-insights/stage-readme-sync
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, PATHS, readJson } from '../../lib/data.mjs'

const BEGIN = '<!-- stats:begin -->'
const END = '<!-- stats:end -->'

const a = readJson(PATHS.analysis)
const authoritative = a?.totals?.authoritative
const invalid = a?.coverage?.invalidUnique
if (authoritative == null || invalid == null) {
  console.error('[readme-sync] analysis.json 缺 totals.authoritative / coverage.invalidUnique')
  process.exit(1)
}
const fmt = (n) => n.toLocaleString('en-US')
const date = (a.generatedAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10)

// 与 check-docs 锚点同构：**Authoritative set N** / **权威集 N**、N noise buckets / 分桶 N
const SEG = {
  'README.md': `**Authoritative set ${fmt(authoritative)}** + ${fmt(invalid)} noise buckets (0 duplicates · hard gate · ${date} snapshot, validation still rolling)`,
  'README.zh-CN.md': `**权威集 ${fmt(authoritative)}** + 分桶 ${fmt(invalid)}（0 重复 · 硬门禁 · ${date} 快照，校验滚动扩大中）`,
}

let changed = 0
for (const [file, seg] of Object.entries(SEG)) {
  const p = join(ROOT, file)
  const txt = readFileSync(p, 'utf8')
  const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}`)
  if (!re.test(txt)) {
    console.error(`[readme-sync] ${file} 缺 ${BEGIN} … ${END} 锚点`)
    process.exit(1)
  }
  const next = txt.replace(re, `${BEGIN}${seg}${END}`)
  if (next === txt) { console.log(`[readme-sync] ${file} 无变化`); continue }
  writeFileSync(p, next)
  changed++
  console.log(`[readme-sync] ${file} 已更新（权威集 ${fmt(authoritative)} · 分桶 ${fmt(invalid)} · ${date}）`)
}
console.log(`[readme-sync] done（${changed} 个文件更新）`)
