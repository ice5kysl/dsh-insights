#!/usr/bin/env node
/**
 * Stage 3 — aggregate analysis over the authoritative set (+ deep sampling).
 *
 * Outputs:
 *   data/analysis.json — machine-readable aggregates
 *   data/report.md     — human-readable analysis report
 *
 * @module dsh-plugin-insights/stage-3
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scoreAll } from './08-score.mjs'

const ROOT = join(import.meta.dirname, '..')
const PLUGINS = process.argv[2] || join(ROOT, 'data', 'plugins.jsonl')

function readRows(f) {
  try { return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] }
}

function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10 }

function readDeep() {
  try {
    const rows = readFileSync(join(ROOT, 'data', 'deep.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    if (!rows.length) return null
    return {
      targets: rows.length,
      readonlyClean: rows.filter((r) => r.verdict === 'readonly-clean' || r.verdict === 'no-render-no-writes').length,
      withWrites: rows.filter((r) => (r.writeCount || 0) > 0).length,
      sanitized: rows.filter((r) => r.sanitized).length,
    }
  } catch { return null }
}

function analyze(rows) {
  const n = rows.length
  const byMonth = {}
  const publish = { published: 0, unpublished: 0, stale: 0 }
  const docs = { readme: 0, zhFile: 0, zh: 0, both: 0, none: 0 }
  const lib = { index: 0, client: 0, both: 0 }
  const topics = {}
  const stars = []
  for (const r of rows) {
    const m = (r.created_at || '').slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
    if (r.npm?.published) {
      publish.published++
      if (r.version && r.npm.latest && r.npm.latest !== r.version) publish.stale++
    } else publish.unpublished++
    const f = r.files || {}
    if (f.readme) docs.readme++
    if (f.readmeZh) docs.zhFile++
    if (r.metrics?.hasZhDocs) docs.zh++
    if (f.readme && r.metrics?.hasZhDocs) docs.both++
    if (!f.readme) docs.none++
    if (f.libIndex) lib.index++
    if (f.libClient) lib.client++
    if (f.libIndex && f.libClient) lib.both++
    for (const t of r.topics || []) topics[t] = (topics[t] || 0) + 1
    stars.push(r.stars || 0)
  }
  stars.sort((a, b) => b - a)
  const topStars = rows.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 10)
    .map((r) => ({ repo: r.full_name, stars: r.stars, published: Boolean(r.npm?.published), zh: Boolean(r.metrics?.hasZhDocs) }))
  const active = rows.filter((r) => r.metrics?.active30).length
  const ageOk = rows.filter((r) => r.metrics?.ageGate1).length
  const scored = scoreAll(rows)
  const { summary: health } = scored
  const healthBy = new Map(scored.out.map((r) => [r.full_name, r.health]))
  const topByHealth = rows
    .slice()
    .sort((a, b) => (healthBy.get(b.full_name)?.score ?? -1) - (healthBy.get(a.full_name)?.score ?? -1) || (b.stars || 0) - (a.stars || 0))
    .slice(0, 10)
    .map((r) => ({ repo: r.full_name, stars: r.stars, score: healthBy.get(r.full_name)?.score ?? null, grade: healthBy.get(r.full_name)?.grade ?? null }))
  const staleTop = rows
    .filter((r) => r.npm?.published && r.version && r.npm.latest && r.npm.latest !== r.version)
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 10)
    .map((r) => ({ repo: r.full_name, stars: r.stars, repoVersion: r.version, npmLatest: r.npm.latest }))
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      authoritative: n,
      active30: active, active30Pct: pct(active, n),
      ageGate1: ageOk, ageGate1Pct: pct(ageOk, n),
      byMonth,
    },
    distribution: { publish, docs, lib, publishPct: pct(publish.published, n), zhPct: pct(docs.both, n) },
    npmStaleTop: staleTop,
    topTopics: Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, c]) => ({ topic: t, count: c })),
    medianStars: n ? stars[Math.floor(n / 2)] : 0,
    topByStars: topStars,
    health: { ...health, ruleVersion: health.ruleVersion },
    topByHealth,
    deep: readDeep(),
  }
}

function render(a) {
  const L = []
  L.push('# dsh 插件生态快照分析报告')
  L.push('')
  L.push(`> 权威集 ${a.totals.authoritative} 个插件 · 生成于 ${(a.generatedAt || '').slice(0, 10)} · 由 dsh-plugin-insights 管线生成`)
  L.push('')
  L.push('## 总览')
  L.push(`- 权威集规模：**${a.totals.authoritative}**`)
  L.push(`- 近 30 天活跃：${a.totals.active30}（${a.totals.active30Pct}%）`)
  L.push(`- 仓库年龄 ≥ 1 天（可过收录门禁）：${a.totals.ageGate1}（${a.totals.ageGate1Pct}%）`)
  L.push('')
  L.push('## 发布与文档')
  L.push(`- npm 已发布 ${a.distribution.publish.published} / 未发布 ${a.distribution.publish.unpublished} / 已发布但版本滞后 ${a.distribution.publish.stale}`)
  L.push(`- 有 README ${a.distribution.docs.readme} · 中英双语/中文 ${a.distribution.docs.zh} · 中文 README 文件 ${a.distribution.docs.zhFile} · 无 README ${a.distribution.docs.none}`)
  L.push(`- lib/index.js ${a.distribution.lib.index} · lib/client.js ${a.distribution.lib.client} · 双产物 ${a.distribution.lib.both}`)
  L.push('')
  L.push('## 月度新增（按仓库创建）')
  for (const [m, c] of Object.entries(a.totals.byMonth).sort()) L.push(`- ${m || '(未知)'}：${c}`)
  L.push('')
  L.push('## Top topics')
  for (const t of a.topTopics) L.push(`- \`${t.topic}\` × ${t.count}`)
  L.push('')
  if (a.health && a.health.total) {
    const h = a.health
    L.push('## 健康分（' + h.ruleVersion + ' · 客观启发式，非安全审计）')
    L.push(`- 分布：A ${h.grades.A} · B ${h.grades.B} · C ${h.grades.C} · D ${h.grades.D}`)
    L.push(`- 平均 ${h.avg} · 中位 ${h.median}`)
    const topD = h.topDeductions || []
    if (topD.length) L.push('- 最常见扣分：' + topD.map((d) => `\`${d.code}\` ${d.pct}%`).join(' · '))
    L.push('')
    L.push('### 健康榜前 10')
    L.push('| repo | ★ | 健康 |')
    L.push('|---|---|---|')
    for (const t of a.topByHealth) L.push(`| ${t.repo} | ${t.stars} | ${t.grade}(${t.score}) |`)
    L.push('')
  }
  L.push('## Star 榜前 10')
  L.push('| repo | ★ | npm | 中文/双语 |')
  L.push('|---|---|---|---|')
  for (const t of a.topByStars) L.push(`| ${t.repo} | ${t.stars} | ${t.published ? '✅' : '—'} | ${t.zh ? '✅' : '—'} |`)
  L.push('')
  if (a.npmStaleTop.length) {
    L.push('## npm 版本滞后榜（仓库新于发布）')
    L.push('| repo | ★ | 仓库版本 → npm |')
    L.push('|---|---|---|')
    for (const t of a.npmStaleTop) L.push(`| ${t.repo} | ${t.stars} | ${t.repoVersion} → ${t.npmLatest} |`)
    L.push('')
  }
  if (a.deep) {
    L.push('## 深检抽样（写面 / 消毒）')
    L.push(`- 抽样 ${a.deep.targets} 个：只读/无写面 ${a.deep.readonlyClean} · 检出写面 ${a.deep.withWrites} · 渲染带消毒 ${a.deep.sanitized}`)
    L.push('')
  }
  return L.join('\n') + '\n'
}

function main() {
  const rows = readRows(PLUGINS)
  const a = analyze(rows)
  writeFileSync(join(ROOT, 'data', 'analysis.json'), JSON.stringify(a, null, 2) + '\n')
  writeFileSync(join(ROOT, 'data', 'report.md'), render(a))
  console.log(`[analyze] ${rows.length} plugins → data/analysis.json + data/report.md`)
}

main()
