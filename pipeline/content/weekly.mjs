#!/usr/bin/env node
/**
 * pipeline/content · weekly — weekly DSH plugin-ecosystem report (for community / dsh official).
 * Outputs: data/weekly/YYYY-Www-dsh-周报.md + data/weekly/LATEST.md
 *
 * Reads current snapshot (analysis/enrich/downloads/llm/diff) and renders a
 * shareable zh-CN report with numbers, movers, signals, and calls to action.
 *
 * 周标签语义（2026-09 起，生成时机周五 → 周一）：覆盖「刚结束的完整 ISO 周」，
 * 见 lib/week.mjs 的 lastCompleteIsoWeek。--week YYYY-Www 可手动指定（补档/重跑）。
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, readJson, readJsonl, loadPlugins } from '../../lib/data.mjs'
import { weekLabel, lastCompleteIsoWeek } from '../../lib/week.mjs'

const W = PATHS.weeklyDir
mkdirSync(W, { recursive: true })

const analysis = readJson(PATHS.analysis)
const enrich = readJson(PATHS.enrich, [])
const dyn = readJson(PATHS.dynamics)
const invalid = readJsonl(PATHS.invalid).length
const llmCount = readJsonl(PATHS.llm).length
// P0-4/P2-20：不信任落盘的 last-diff.md（日滚基线会让周报失真），
// 现场用 history.json 重算「本周 diff」：基线 = 距今 ≥7 天中最近一条（无则最早一条并注明）。
const plugins = loadPlugins()
function weeklyDiff() {
  const entries = readJson(PATHS.history)?.entries || []
  if (!entries.length) return null
  const target = Date.now() - 7 * 86400000
  const older = entries.filter((e) => new Date(e.date).getTime() <= target)
  const base = older.length ? older[older.length - 1] : entries[0]
  const prev = base.plugins || {}
  const cur = new Map(plugins.map((r) => [r.full_name, r]))
  const added = [...cur.keys()].filter((k) => !(k in prev))
  const removed = Object.keys(prev).filter((k) => !cur.has(k))
  const risers = [...cur.entries()]
    .filter(([k, r]) => (k in prev) && prev[k].stars != null && (r.stars || 0) > prev[k].stars)
    .map(([k, r]) => ({ id: k, from: prev[k].stars || 0, to: r.stars || 0 }))
    .sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 10)
  const addedTop = added.map((id) => cur.get(id)).sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 15)
  const L = []
  L.push(`## 本周快照 Diff（基线 ${base.date}）`)
  L.push('')
  L.push(`- 当前权威插件：**${cur.size}**（基线 ${Object.keys(prev).length} · ${base.date}）`)
  L.push(`- 新增 ${added.length} · 消失 ${removed.length}`)
  if (added.length) { L.push(''); L.push(`### 新增（Top ${Math.min(15, added.length)}，按 ★）`)
    for (const id of addedTop) L.push(`- ${id.full_name} ★${id.stars || 0}${id.npm?.published ? ' (npm ✓)' : ''}`) }
  if (removed.length) { L.push(''); L.push(`### 消失（Top ${Math.min(10, removed.length)}）`)
    for (const id of removed.slice(0, 10)) L.push(`- ${id}`) }
  if (risers.length) { L.push(''); L.push('### star 涨幅榜（同基线）')
    for (const r of risers) L.push(`- ${r.id}：${r.from} → ${r.to}（+${r.to - r.from}）`) }
  return { md: L.join('\n'), added: added.length, removed: removed.length, addedTop: addedTop.slice(0, 8).map((r) => ({ id: r.full_name, stars: r.stars || 0, npm: !!r.npm?.published })), risers: risers.slice(0, 5) }
}
const diff = weeklyDiff()
const reviews = readJsonl(PATHS.reviews).length

// ---- LLM 小节（可选）：编者按 + 本周洞察 + 行动建议；缺 key/失败整体跳过，事实部分照常出报 ----
async function llmSections() {
  const key = process.env.DEEPSEEK_API_KEY || ''
  if (!key) return null
  const model = process.env.WEEKLY_LLM_MODEL || 'deepseek-v4-flash'
  // S 级低星宝藏插件（score ≥95 按 ★ 升序）：值得被看见的「高分冷门」
  const gems = enrich.filter((e) => (e.score ?? 0) >= 95).sort((a, b) => (a.stars || 0) - (b.stars || 0)).slice(0, 5)
    .map((e) => ({ id: e.full_name, stars: e.stars || 0, score: e.score, category: e.category }))
  // 崩溃语料 TOP 签名（dsh-why --share 上报聚合；文件缺失则不喂）
  const crash = readJson(PATHS.crashCorpus, null)
  const crashTop = (crash?.signatures || []).slice(0, 3).map((s) => ({ sig: s.sig, category: s.category, count: s.count, plugins: (s.plugins || []).slice(0, 3) }))
  const breaking = (dyn?.dsh?.releases || []).filter((r) => r.breaking).slice(0, 5)
    .map((r) => ({ tag: r.tag, at: (r.published_at || '').slice(0, 10), summary: (r.summary || '').slice(0, 60) }))
  const facts = {
    week: wk, range: weekLabel(wk),
    authoritative: (analysis.totals || {}).authoritative, grades: (analysis.quality || {}).grades, avgScore: (analysis.quality || {}).avgScore,
    publishPct: analysis.distribution?.publishPct, active7Pct: (analysis.totals || {}).active7Pct,
    diff: diff && { added: diff.added, removed: diff.removed, addedTop: diff.addedTop, risers: diff.risers },
    newAuthors: diff ? [...new Set(diff.addedTop.map((r) => r.id.split('/')[0]))].slice(0, 5) : [],
    topByStars: (analysis.topByStars || []).slice(0, 5),
    downloadsTop: (analysis.downloads?.top || []).slice(0, 5).map((s) => ({ id: s.full_name, weekly: s.weekly })),
    releases: (dyn?.dsh?.releases || []).slice(0, 3).map((r) => ({ tag: r.tag, at: (r.published_at || '').slice(0, 10), breaking: !!r.breaking })),
    breaking,
    gems,
    crashTop,
  }
  const prompt = `你是「DSH 插件生态周报」的编辑。基于以下本周事实（JSON），输出三个小节，严格返回 JSON（不要代码围栏）：
{
  "editorial": "编者按 markdown：3–5 条 bullet，每条一行：以一个**加粗的判断短语**开头（5–15 字，是具体的判断内容本身，严禁出现「一句话判断」这类占位字样），后接支撑（点名具体插件/作者/版本 + 数字）。禁止复述统计数字本身，要给编辑视角的判断（什么值得注意、为什么、意味着什么）。最后单独一行写一句「本周基调」收尾（一句话，不用 bullet）。",
  "insights": ["本周洞察：2–4 条数据驱动的判断，每条 1–2 句「事实 + 含义」（点名具体插件/版本/数字，说明对生态意味着什么）。优先使用 breaking / gems / crashTop / newAuthors / risers 这些增量信号，不要复述速览统计。"],
  "actions": {
    "users": ["给插件用户的行动建议 1–2 条，具体可执行（如某版本含 breaking 时提示升级前先用 dsh-why 诊断当前插件组合、关注某类高分替代）"],
    "authors": ["给插件作者的行动建议 1–2 条，具体可执行（如声明 engines.dsh、未发 npm 的尽快发布、参考 gems 的差异化方向）"]
  }
}
只许使用给定事实，禁止编造。中文。bullet 内不要标题、不要代码围栏。

事实：${JSON.stringify(facts)}`
  try {
    const r = await fetch(`${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 10000 }),
      signal: AbortSignal.timeout(120000),
    })
    if (!r.ok) { console.error(`[weekly] LLM HTTP ${r.status} —— 三个小节整体跳过`); return null }
    const doc = await r.json()
    const text = (doc.choices?.[0]?.message?.content || '').replace(/^```(?:json|markdown)?|```$/gm, '').trim()
    if (!text) { console.error('[weekly] LLM 返回空内容（推理模型可能吃光了 max_tokens）—— 三个小节整体跳过'); return null }
    let out
    try { out = JSON.parse(text) } catch { console.error('[weekly] LLM 输出非 JSON（跳过三个小节）'); return null }
    if (typeof out?.editorial !== 'string' || !out.editorial.trim()) { console.error('[weekly] LLM 输出缺 editorial（跳过三个小节）'); return null }
    return {
      editorial: out.editorial.trim(),
      insights: Array.isArray(out.insights) ? out.insights.filter((s) => typeof s === 'string' && s.trim()).slice(0, 4) : [],
      users: Array.isArray(out.actions?.users) ? out.actions.users.filter((s) => typeof s === 'string' && s.trim()).slice(0, 2) : [],
      authors: Array.isArray(out.actions?.authors) ? out.actions.authors.filter((s) => typeof s === 'string' && s.trim()).slice(0, 2) : [],
    }
  } catch (e) { console.error(`[weekly] LLM 失败（${e.message}）—— 三个小节整体跳过`); return null }
}

const stamp = new Date()
const wkArgIdx = process.argv.indexOf('--week')
const wk = wkArgIdx >= 0 && /^\d{4}-W\d{2}$/.test(process.argv[wkArgIdx + 1] || '')
  ? process.argv[wkArgIdx + 1]
  : lastCompleteIsoWeek(stamp)
const t = analysis.totals || {}
const q = analysis.quality || {}
const ch = analysis.channels
const dl = analysis.downloads
const llmMd = await llmSections()
const L = []
L.push(`# DSH 插件生态周报 · ${wk}（${weekLabel(wk)}）`)
L.push('')
L.push(`> 数据快照 ${(analysis.generatedAt || '').slice(0, 10)} · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)`)
L.push('')
if (llmMd) {
  L.push('## 编者按')
  L.push('')
  L.push(llmMd.editorial)
  L.push('')
  if (llmMd.insights.length) {
    L.push('## 本周洞察')
    L.push('')
    for (const s of llmMd.insights) L.push(`- ${s}`)
    L.push('')
  }
  if (llmMd.users.length || llmMd.authors.length) {
    L.push('## 行动建议')
    L.push('')
    for (const s of llmMd.users) L.push(`- **给插件用户**：${s}`)
    for (const s of llmMd.authors) L.push(`- **给插件作者**：${s}`)
    L.push('')
  }
  // 轻量三小节 ↔ 深度长报告分工：周报末尾链到 insights 报告索引页
  L.push('> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site')
  L.push('')
}
L.push('## 本期速览')
L.push('')
L.push(`- 权威插件 **${t.authoritative}** 个（通过 dsh.bundle manifest 校验；另有 ${invalid} 个被拒/噪声分桶）`)
L.push(`- 近 7 天活跃 ${t.active7Pct ?? '—'}%（30 天 ${t.active30Pct}%）· 可过收录门禁（仓库≥1天）${t.ageGate1Pct}%`)
L.push(`- npm 发布率 ${analysis.distribution?.publishPct ?? 0}%（已发布 ${analysis.distribution?.publish?.published ?? 0} / 版本滞后 ${analysis.distribution?.publish?.stale ?? 0}）`)
L.push(`- 中英/双语文档率 ${analysis.distribution?.zhPct ?? 0}% · 平均质量分 ${q.avgScore ?? '—'}（S+A ${q.gradePctSA ?? q.gradePct ?? 0}%）`)
L.push(`- curated 收录覆盖 ${ch ? ch.coveredPct + '%（' + ch.covered + ' 个已进 awesome/imsai）' : '—'}`)
if (dl) L.push(`- npm 周下载样本 ${dl.top.length ? 'Top ' + dl.top.length + ' 合计 ' + dl.sum : '暂无'}`)
L.push(`- LLM 能力标注进度：${llmCount}/${t.authoritative}`)
L.push('')
if (dyn) {
  const dn = dyn.dsh?.npm || {}
  const latestRel = (dyn.dsh?.releases || [])[0]
  L.push('## 官方动态（dsh × DeepSeek 平台）')
  L.push('')
  L.push(`- dsh 官方仓库 ★${(dyn.dsh?.stars || 0).toLocaleString()} · 最近 push ${(dyn.dsh?.pushed_at || '').slice(0, 10)}`)
  if (dn.distTags && Object.keys(dn.distTags).length) L.push(`- npm dist-tags：${Object.entries(dn.distTags).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  if (latestRel) L.push(`- 最新 release：${latestRel.tag}（${latestRel.prerelease ? 'pre-release' : 'release'} · ${(latestRel.published_at || '').slice(0, 10)}${latestRel.breaking ? ' · 含 breaking 说明' : ''}）`)
  const brk = (dyn.dsh?.releases || []).filter((r) => r.breaking).length
  if (brk > 1) L.push(`- 最近 ${dyn.dsh.releases.length} 个 release 中 ${brk} 个含 breaking/迁移关键词——升级前请核对 releases 说明`)
  const cs = dyn.compatSignal
  if (cs) L.push(`- rc 兼容信号：latest=${cs.distTags?.latest ?? '—'}；已探测 ${cs.pluginsProbed} 个 npm 插件，仅 ${cs.declaringEngines} 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）`)
  const plat = (dyn.platform || []).filter((p) => !p.error)
  if (plat.length) L.push(`- DeepSeek 平台：${plat.map((p) => `${p.repo.split('/')[1]} ★${(p.stars || 0).toLocaleString()}${p.latestRelease ? ' · ' + p.latestRelease.tag : ''}`).join('；')}`)
  L.push(`- 详见站点「动态」页：https://dsh-insights.com/dynamics/`)
  L.push('')
}
L.push('## 增长与榜单')
L.push('')
L.push('| 仓库 | ★ | npm | 中/双语 |')
L.push('|---|---|---|---|')
for (const s of (analysis.topByStars || []).slice(0, 8)) L.push(`| ${s.repo} | ${s.stars} | ${s.published ? '✓' : '—'} | ${s.zh ? '✓' : '—'} |`)
L.push('')
if (dl && dl.top.length) {
  L.push('### 周下载 Top 10（已发布样本）')
  L.push('')
  for (const s of dl.top.slice(0, 10)) L.push(`- ${s.full_name}：**${s.weekly}**/周`)
  L.push('')
}
// 「版本不一致」按方向分两节（2026-09-21 修）：旧实现只有一个标题「npm 版本滞后（仓库领先于发布）」，
// 但取数口径是「npm.latest !== r.version」——任意不等，而实际列出的几乎全是 npm 领先仓库，标题反了。
// 两个方向的含义完全不同：仓库领先=该发版（可行动）；npm 领先=发布已超前于默认分支的 package.json。
if (analysis.npmRepoAheadTop && analysis.npmRepoAheadTop.length) {
  L.push('### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）')
  L.push('')
  for (const s of analysis.npmRepoAheadTop.slice(0, 5)) L.push(`- ${s.repo}：仓库 ${s.repoVersion} → npm ${s.npmLatest}`)
  L.push('')
}
if (analysis.npmRegistryAheadTop && analysis.npmRegistryAheadTop.length) {
  L.push('### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）')
  L.push('')
  for (const s of analysis.npmRegistryAheadTop.slice(0, 5)) L.push(`- ${s.repo}：仓库 ${s.repoVersion} → npm ${s.npmLatest}`)
  L.push('')
}
// 兼容：analysis.json 尚未重算时（旧快照）退回原来的混合列表，至少标题不再说反方向
if (!analysis.npmRepoAheadTop && !analysis.npmRegistryAheadTop && analysis.npmStaleTop && analysis.npmStaleTop.length) {
  L.push('### npm 与仓库版本不一致 Top 5')
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
if (diff && (diff.added || diff.removed)) obs.push(`本周新增 ${diff.added} / 消失 ${diff.removed}，见文末「本周快照 Diff」。`)
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
  L.push(diff.md)
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
