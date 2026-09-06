#!/usr/bin/env node
/**
 * Export the "优质未收录 · 建议收录" list as shareable markdown + CSV.
 * Outputs: data/suggested.md · data/suggested.csv
 *
 * @module dsh-insights/bin/export-suggested
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, PATHS, readJson } from '../lib/data.mjs'

const analysis = readJson(PATHS.analysis)
const enrich = readJson(PATHS.enrich, [])
const catOf = new Map(enrich.map((x) => [x.full_name, x.category]))
const rows = (analysis.suggested || []).map((s) => ({
  repo: s.full_name,
  grade: s.grade,
  stars: s.stars || 0,
  score: s.score ?? '',
  weekly: s.weekly != null ? s.weekly : '',
  cat: catOf.get(s.full_name) || '',
}))
const esc = (v) => String(v ?? '').replace(/"/g, '""')

const md = ['# 优质未收录 · 建议收录（dsh 生态）', '',
  `> A/B 级 · 已发布 npm · 尚未进入 awesome/imsai 列表 · 按质量分排序（生成于 ${(analysis.generatedAt || '').slice(0, 10)}，共 ${rows.length}）`, '',
  '| repo | 质量 | ★ | 周下载 | 分类 |', '|---|---|---|---|---|',
  ...rows.map((r) => `| [${r.repo}](https://github.com/${r.repo}) | ${r.grade} | ${r.stars} | ${r.weekly || '—'} | ${r.cat} |`),
  ''].join('\n')

const csv = ['repo,grade,stars,score,weekly,category',
  ...rows.map((r) => [r.repo, r.grade, r.stars, r.score, r.weekly, r.cat].map(esc).join(',')),
].join('\n') + '\n'

writeFileSync(join(DATA, 'suggested.md'), md)
writeFileSync(join(DATA, 'suggested.csv'), csv)
console.log(`[suggested] ${rows.length} → data/suggested.md + data/suggested.csv`)
