#!/usr/bin/env node
/**
 * pipeline/content · weekly — weekly DSH plugin-ecosystem report (for community / dsh official).
 * Outputs: data/weekly/YYYY-Www-dsh-周报.md + data/weekly/LATEST.md
 *
 * Reads current snapshot (analysis/enrich/downloads/llm/diff) and renders a
 * shareable zh-CN report with numbers, movers, signals, and calls to action.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, readJson, readJsonl } from '../../lib/data.mjs'

const W = PATHS.weeklyDir
mkdirSync(W, { recursive: true })

const analysis = readJson(PATHS.analysis)
const enrich = readJson(PATHS.enrich, [])
const invalid = readJsonl(PATHS.invalid).length
const llmCount = readJsonl(PATHS.llm).length
let diff = null
try { diff = readFileSync(PATHS.lastDiff, 'utf8') } catch { /* ok */ }
const reviews = readJsonl(PATHS.reviews).length

function isoWeek(d) {
  const date = new Date(d + 'T00:00:00Z')
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const year = date.getUTCFullYear()
  const week = 1 + Math.round(((date - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}
const stamp = new Date()
const wk = isoWeek(stamp.toISOString().slice(0, 10))
const t = analysis.totals || {}
const q = analysis.quality || {}
const ch = analysis.channels
const dl = analysis.downloads
const L = []
L.push(`# DSH 插件生态周报 · ${wk}`)
L.push('')
L.push(`> 数据快照 ${(analysis.generatedAt || '').slice(0, 10)} · 由 dsh-insights（DSH 插件洞察 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)`)
L.push('')
L.push('## 本期速览')
L.push('')
L.push(`- 权威插件 **${t.authoritative}** 个（通过 dsh.bundle manifest 校验；另有 ${invalid} 个被拒/噪声分桶）`)
L.push(`- 近 30 天活跃 ${t.active30Pct}% · 可过收录门禁（仓库≥1天）${t.ageGate1Pct}%`)
L.push(`- npm 发布率 ${analysis.distribution?.publishPct ?? 0}%（已发布 ${analysis.distribution?.publish?.published ?? 0} / 版本滞后 ${analysis.distribution?.publish?.stale ?? 0}）`)
L.push(`- 中英/双语文档率 ${analysis.distribution?.zhPct ?? 0}% · 平均质量分 ${q.avgScore ?? '—'}（A+B ${q.gradePct ?? 0}%）`)
L.push(`- curated 收录覆盖 ${ch ? ch.coveredPct + '%（' + ch.covered + ' 个已进 awesome/imsai）' : '—'}`)
if (dl) L.push(`- npm 周下载样本 ${dl.top.length ? 'Top ' + dl.top.length + ' 合计 ' + dl.sum : '暂无'}`)
L.push(`- LLM 能力标注进度：${llmCount}/${t.authoritative}`)
L.push('')
L.push('## 增长与榜单')
L.push('')
L.push('| 仓库 | ★ | npm | 中/双语 |')
L.push('|---|---|---|---|')
for (const s of (analysis.topByStars || []).slice(0, 8)) L.push(`| ${s.repo} | ${s.stars} | ${s.published ? '✅' : '—'} | ${s.zh ? '✅' : '—'} |`)
L.push('')
if (dl && dl.top.length) {
  L.push('### 周下载 Top 10（已发布样本）')
  L.push('')
  for (const s of dl.top.slice(0, 10)) L.push(`- ${s.full_name}：**${s.weekly}**/周`)
  L.push('')
}
if (analysis.npmStaleTop && analysis.npmStaleTop.length) {
  L.push('### npm 版本滞后（仓库领先于发布）Top 5')
  L.push('')
  for (const s of analysis.npmStaleTop.slice(0, 5)) L.push(`- ${s.repo}：仓库 ${s.repoVersion} → npm ${s.npmLatest}`)
  L.push('')
}
L.push('## 信号与观察（启发式）')
L.push('')
const obs = []
obs.push(`质量两级分化仍在：A 级 ${q.grades?.A ?? 0} 个 vs D 级 ${q.grades?.D ?? 0} 个（C 级是主体 ${q.grades?.C ?? 0}），生态"能跑但文档/发布不齐"的中段插件占比最高。`)
obs.push(`功能分类上「${(analysis.categories || [])[0]?.category}」最拥挤（${(analysis.categories || [])[0]?.count} 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。`)
obs.push(`${analysis.distribution?.docs?.none ?? 0} 个插件没有 README、${analysis.distribution?.publish?.unpublished ?? 0} 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。`)
obs.push(`curated 收录仍集中于少数头部（${ch ? ch.covered : '?'}/${t.authoritative}），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。`)
if (diff && diff.includes('新增')) obs.push('本期相对上期有新增/消失/star 变动，见下方 diff 摘要。')
for (const o of obs) L.push(`- ${o}`)
L.push('')
L.push('## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）')
L.push('')
for (const s of (analysis.suggested || []).slice(0, 8)) L.push(`- ${s.full_name}（${s.grade}，★${s.stars || 0}${s.weekly != null ? '，周下载 ' + s.weekly : ''}）`)
L.push('')
L.push('## 本期动作 & 社区行动')
L.push('')
L.push('- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 ' + reviews + ' 条待校对。')
L.push('- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。')
L.push('- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。')
L.push('')
if (diff) {
  L.push('---')
  L.push('')
  L.push(diff)
  L.push('')
}
L.push('---')
L.push('')
L.push('> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/')
L.push('> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。')
L.push('')

const file = join(W, `${wk}-dsh-生态周报.md`)
writeFileSync(file, L.join('\n'))
writeFileSync(join(W, 'LATEST.md'), L.join('\n'))
console.log(`[weekly] → ${file}`)
