#!/usr/bin/env node
/**
 * pipeline/analyze · analyze — aggregate analysis over the authoritative set (+ deep sampling).
 * Per-plugin health score comes from the single scoring source (analyze/score.mjs);
 * this stage adds the dimensions only it owns (functional category, curated-channel
 * coverage, weekly npm downloads) and persists data/enrich.json for the site & drawer.
 *
 * Outputs:
 *   data/analysis.json   aggregates (+ grades/categories distributions)
 *   data/report.md       human-readable report
 *   data/enrich.json     per-plugin { full_name, stars, score, grade, drops, category, inAwesome, inImsai, covered, weekly }
 *
 * @module dsh-insights/pipeline-analyze
 */

import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, PATHS, readJsonl, readJson, writeJson } from '../../lib/data.mjs'
import { scoreAll } from './score.mjs'

const PLUGINS = process.argv[2] || PATHS.plugins

function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10 }

function readChannels() {
  const l = readJson(PATHS.listed)
  return l
    ? { awesome: new Set(l.awesome || []), imsai: new Set(l.imsai || []), fetchedAt: l.fetchedAt || null }
    : { awesome: new Set(), imsai: new Set() }
}
function readDeep() {
  const rows = readJsonl(PATHS.deep)
  if (!rows.length) return null
  return {
    targets: rows.length,
    readonlyClean: rows.filter((r) => r.verdict === 'readonly-clean' || r.verdict === 'no-render-no-writes').length,
    withWrites: rows.filter((r) => (r.writeCount || 0) > 0).length,
    sanitized: rows.filter((r) => r.sanitized).length,
  }
}

// ---- functional classification (heuristic, priority-ordered) ----------
const CATS = [
  ['侧栏 / 工作区', /(workspace|sidebar|side ?bar|folder)/i],
  ['文件浏览 / 预览', /(file|explorer|preview|browser|viewer|files|tree|markdown|md-)/i],
  ['搜索 / 命令面板', /(spotlight|palette|command|search|fuzzy)/i],
  ['会话管理', /(session|archive|trash|history|turn|resume)/i],
  ['状态 / 监控 / 用量', /(status|monitor|activity|usage|spend|billing|meter|token|cost|watch|whale|report)/i],
  ['记忆 / 知识', /(memory|knowledge|graph|mind|recall|notes)/i],
  ['主题 / 视觉美化', /(theme|skin|style|color|glass|visual|icon|hud)/i],
  ['工具 / 效率', /(tool|clipboard|drag|drop|shortcut|hotkey|paste|rename|kit)/i],
  ['消息 / 协作集成', /(telegram|feishu|slack|discord|notion|git|webhook|im-|mail|calendar|bridge|tunnel)/i],
  ['模型 / 代理', /(model|agent|preset|codex|claude|provider|prompt)/i],
  ['开发 / 数据', /(dev|code|build|test|eval|db|sql|log|terminal|debug|audit)/i],
]
const OTHER = '其它'

function classify(name, desc) {
  const text = `${name} ${desc || ''}`.slice(0, 400)
  for (const [label, re] of CATS) if (re.test(text)) return label
  return OTHER
}

// ---- health score: single source is analyze/score.mjs (health-v2) -------

function analyze(rows) {
  const n = rows.length
  const healthBy = new Map(scoreAll(rows).out.map((r) => [r.full_name, r.health]))
  const byMonth = {}
  const byWeek = {}
  const publish = { published: 0, unpublished: 0, stale: 0 }
  const docs = { readme: 0, zhFile: 0, zh: 0, both: 0, none: 0 }
  const lib = { index: 0, client: 0, both: 0 }
  const topics = {}
  const stars = []
  const gradeWk = {}
  const channels = readChannels()
  const dlDoc = readJson(PATHS.downloads)
  const dlMap = dlDoc?.map || {}
  const enrich = []
  const gradeAgg = { A: 0, B: 0, C: 0, D: 0 }
  const catAgg = {}
  let scoreSum = 0
  for (const r of rows) {
    const m = (r.created_at || '').slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
    if (r.created_at) {
      const dt = new Date(r.created_at)
      if (!Number.isNaN(dt.getTime())) {
        const day = dt.getDay() // 0=Sun
        const monday = new Date(dt.getTime() - ((day + 6) % 7) * 86400000)
        const pad = (n) => String(n).padStart(2, '0')
        const wk = monday.getFullYear() + '-' + pad(monday.getMonth() + 1) + '-' + pad(monday.getDate())
        byWeek[wk] = (byWeek[wk] || 0) + 1
        const g = (healthBy.get(r.full_name) || {}).grade || 'D'
        ;(gradeWk[g] ??= {})[wk] = ((gradeWk[g] ??= {})[wk] || 0) + 1
      }
    }
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
    const h = healthBy.get(r.full_name) || { score: 0, grade: 'D', drops: [] }
    const cat = classify(r.repo || r.full_name || '', r.description || '')
    const inAwesome = channels.awesome.has(r.full_name)
    const inImsai = channels.imsai.has(r.full_name)
    const weekly = r.npm?.published && r.pkgName ? (dlMap[r.pkgName]?.d ?? null) : null
    enrich.push({ full_name: r.full_name, stars: r.stars || 0, score: h.score, grade: h.grade, dimScores: h.dimScores || {}, drops: h.drops.map((d) => ({ code: d.code, sev: d.sev, label: d.label })), missing: h.missing || [], category: cat, inAwesome, inImsai, covered: inAwesome || inImsai, weekly })
    gradeAgg[h.grade] = (gradeAgg[h.grade] || 0) + 1
    catAgg[cat] = (catAgg[cat] || 0) + 1
    scoreSum += h.score
  }
  stars.sort((a, b) => b - a)

  // ---- 作者维度（owner 聚合：谁是生态重要人物） ----------------------------
  const enBy = new Map(enrich.map((x) => [x.full_name, x]))
  const authorAgg = new Map()
  for (const r of rows) {
    const o = r.owner || (r.full_name || '').split('/')[0]
    if (!o) continue
    const h = healthBy.get(r.full_name) || { score: 0, grade: 'D' }
    const e = enBy.get(r.full_name) || {}
    let a0 = authorAgg.get(o)
    if (!a0) { a0 = { owner: o, plugins: 0, stars: 0, grades: { A: 0, B: 0, C: 0, D: 0 }, npm: 0, covered: 0, lastPush: '', topPlugin: null, topStars: -1, scoreSum: 0, cats: {} }; authorAgg.set(o, a0) }
    a0.plugins++
    a0.stars += r.stars || 0
    a0.grades[h.grade] = (a0.grades[h.grade] || 0) + 1
    a0.scoreSum += h.score
    if (r.npm?.published) a0.npm++
    if (e.covered) a0.covered++
    if ((r.pushed_at || '') > a0.lastPush) a0.lastPush = r.pushed_at || ''
    if ((r.stars || 0) > a0.topStars) { a0.topStars = r.stars || 0; a0.topPlugin = r.full_name }
    const c0 = e.category || '其它'
    a0.cats[c0] = (a0.cats[c0] || 0) + 1
  }
  const authors = [...authorAgg.values()].map((a0) => ({
    owner: a0.owner, plugins: a0.plugins, stars: a0.stars, grades: a0.grades,
    ab: (a0.grades.A || 0) + (a0.grades.B || 0),
    npm: a0.npm, covered: a0.covered, lastPush: (a0.lastPush || '').slice(0, 10),
    avg: Math.round((a0.scoreSum / Math.max(1, a0.plugins)) * 10) / 10,
    topPlugin: a0.topPlugin, topStars: a0.topStars,
    topCat: Object.entries(a0.cats).sort((x, y) => y[1] - x[1])[0]?.[0] || null,
  })).sort((x, y) => (y.ab - x.ab) || (y.stars - x.stars) || (y.plugins - x.plugins))
  const multi = authors.filter((a0) => a0.plugins >= 2).length
  const top10Plugins = authors.slice(0, 10).reduce((s2, a0) => s2 + a0.plugins, 0)
  const authorStats = { total: authors.length, multi, top10Share: pct(top10Plugins, n) }

  // ---- coverage funnel（口径透明：topic 宇宙 → 候选 → 校验 → 权威集 + 分桶）----
  const candRows = readJsonl(PATHS.candidatesAll).filter((c) => c.kind === 'repo')
  const candidates = candRows.length
  let validated = 0
  try {
    const candIds = new Set(candRows.map((c) => c.id))
    validated = readFileSync(PATHS.doneIds, 'utf8').split('\n').filter(Boolean).filter((id) => candIds.has(id)).length
  } catch { validated = n }
  const bucketAgg = {}
  for (const r of readJsonl(PATHS.invalid)) bucketAgg[r.reason || '?'] = (bucketAgg[r.reason || '?'] || 0) + 1
  const weekOf = (iso) => {
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) return null
    const day = dt.getDay()
    const monday = new Date(dt.getTime() - ((day + 6) % 7) * 86400000)
    const pad = (x) => String(x).padStart(2, '0')
    return monday.getFullYear() + '-' + pad(monday.getMonth() + 1) + '-' + pad(monday.getDate())
  }
  const candByWeek = {}
  for (const c of candRows) { const w = weekOf(c.created_at); if (w) candByWeek[w] = (candByWeek[w] || 0) + 1 }
  const coverage = {
    // topic 宇宙总量：GitHub search `topic:dsh-plugin` total_count（官方零门槛打标即入，含蹭标/无关/fork/子路径噪音）。
    // 数值定期由 discover 全量抓取时刷新（见 data/discover-meta.json）；缺省用 RESEARCH 2026-09-05 实测。
    topicUniverse: readJson(join(DATA, 'discover-meta.json'))?.topicTotal ?? { count: 13592, at: '2026-09-05' },
    candidates,
    candidatesByWeek: candByWeek,
    validated,
    authoritative: n,
    invalidBuckets: Object.entries(bucketAgg).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
  }

  const topStars = rows.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 10)
    .map((r) => ({ repo: r.full_name, stars: r.stars, published: Boolean(r.npm?.published), zh: Boolean(r.metrics?.hasZhDocs) }))
  const active = rows.filter((r) => r.metrics?.active30).length
  const ageOk = rows.filter((r) => r.metrics?.ageGate1).length
  const staleTop = rows
    .filter((r) => r.npm?.published && r.version && r.npm.latest && r.npm.latest !== r.version)
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 10)
    .map((r) => ({ repo: r.full_name, stars: r.stars, repoVersion: r.version, npmLatest: r.npm.latest }))
  const aw = enrich.filter((e) => e.inAwesome).length
  const im = enrich.filter((e) => e.inImsai).length
  const covered = enrich.filter((e) => e.covered).length
  const suggested = enrich.filter((e) => (e.grade === 'A' || e.grade === 'B') && !e.covered)
    .sort((x, y) => (y.score || 0) - (x.score || 0)).slice(0, 20)
  const dlTop = enrich.filter((e) => e.weekly != null).sort((x, y) => (y.weekly || 0) - (x.weekly || 0)).slice(0, 15)
  writeJson(PATHS.enrich, enrich)
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      authoritative: n,
      active30: active, active30Pct: pct(active, n),
      ageGate1: ageOk, ageGate1Pct: pct(ageOk, n),
      byMonth,
      byWeek,
      byWeekGrades: gradeWk,
    },
    distribution: { publish, docs, lib, publishPct: pct(publish.published, n), zhPct: pct(docs.both, n) },
    npmStaleTop: staleTop,
    topTopics: Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, c]) => ({ topic: t, count: c })),
    medianStars: n ? stars[Math.floor(n / 2)] : 0,
    topByStars: topStars,
    channels: { awesome: aw, imsai: im, covered, coveredPct: pct(covered, n), none: n - covered, fetchedAt: channels.fetchedAt },
    suggested,
    downloads: dlDoc ? { fetchedAt: dlDoc.fetchedAt, top: dlTop, sum: Object.values(dlMap).reduce((s2, v) => s2 + (v.d || 0), 0) } : null,
    deep: readDeep(),
    quality: {
      grades: gradeAgg,
      avgScore: n ? Math.round((scoreSum / n) * 10) / 10 : 0,
      gradePct: pct((gradeAgg.A || 0) + (gradeAgg.B || 0), n),
    },
    categories: Object.entries(catAgg).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([cat, count]) => ({ category: cat, count })),
    authors,
    authorStats,
    coverage,
    enrichCount: enrich.length,
  }
}

function render(a) {
  const L = []
  L.push('# dsh 插件生态快照分析报告')
  L.push('')
  L.push(`> 权威集 ${a.totals.authoritative} 个插件 · 生成于 ${(a.generatedAt || '').slice(0, 10)} · 由 DSH Insights 管线生成`)
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
  if (a.channels && a.totals.authoritative) {
    L.push('## 收录渠道（curated 覆盖）')
    L.push(`- awesome-dsh-plugin ${a.channels.awesome} · imsai ${a.channels.imsai} · 至少一个渠道 ${a.channels.covered}（${a.channels.coveredPct}%） · 未收录 ${a.channels.none}`)
    L.push('')
    L.push('## 优质未收录 · 建议收录（Top 15）')
    for (const e of a.suggested.slice(0, 15)) {
      const dl = e.weekly != null ? ' · 周下载 ' + e.weekly : ''
      L.push(`- ${e.full_name} ${e.grade}${dl}`)
    }
    L.push('')
  }
  if (a.downloads && a.downloads.top.length) {
    L.push('## npm 周下载 Top 10')
    for (const e of a.downloads.top.slice(0, 10)) L.push(`- ${e.full_name}：${e.weekly}`)
    L.push('')
  }
  L.push('## 质量评分（启发式）')
  L.push(`- 平均分 ${a.quality.avgScore} · A+B 占比 ${a.quality.gradePct}%`)
  L.push(`- A ${a.quality.grades.A} · B ${a.quality.grades.B} · C ${a.quality.grades.C} · D ${a.quality.grades.D}`)
  L.push('')
  L.push('## 功能分类（启发式 Top 12）')
  for (const c of a.categories) L.push(`- ${c.category}：${c.count}`)
  L.push('')
  L.push('## 月度新增（按仓库创建）')
  for (const [m, c] of Object.entries(a.totals.byMonth).sort()) L.push(`- ${m || '(未知)'}：${c}`)
  L.push('')
  L.push('## Top topics')
  for (const t of a.topTopics) L.push(`- \`${t.topic}\` × ${t.count}`)
  L.push('')
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
  const rows = readJsonl(PLUGINS)
  const a = analyze(rows)
  writeJson(PATHS.analysis, a, true)
  writeFileSync(PATHS.reportMd, render(a))
  console.log(`[analyze] ${rows.length} plugins → analysis.json + report.md + enrich.json (avg ${a.quality.avgScore} / A+B ${a.quality.gradePct}%)`)
}

main()
