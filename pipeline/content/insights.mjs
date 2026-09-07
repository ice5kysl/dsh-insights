#!/usr/bin/env node
/**
 * pipeline/content · insights — LLM 阶段性生态洞察报告（DeepSeek）
 *
 * 与周报的分工：周报是事实编年（数字罗列），洞察是分析判断（结论/建议/异常应对）。
 * 方法：本脚本先用确定性规则算出「数据包 + 异常信号」，再交给 LLM 写成报告——
 * 所有数字来自落盘数据，LLM 只负责解释与判断，不允许编造数字。
 *
 * 输出（幂等，同周覆盖重写）：
 *   data/insight-reports/YYYY-Www.md      中文报告
 *   data/insight-reports/YYYY-Www.en.md   English edition
 *   data/insight-reports/YYYY-Www.json    meta + signals（页面/审计用）
 *
 * 环境：DEEPSEEK_API_KEY（必需，缺省则跳过不失败）· INSIGHTS_MODEL（默认
 * deepseek-v4-pro；deepseek-v4-flash 可降本）· DEEPSEEK_BASE_URL。
 *
 *   node pipeline/content/insights.mjs --dry   # 只看数据包与信号，不调 API
 *
 * @module dsh-insights/content/insights
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, PATHS, readJson, readJsonl } from '../../lib/data.mjs'

const DRY = process.argv.includes('--dry')
const wkArgIdx = process.argv.indexOf('--week')
const WK_OVERRIDE = wkArgIdx >= 0 && /^\d{4}-W\d{2}$/.test(process.argv[wkArgIdx + 1] || '') ? process.argv[wkArgIdx + 1] : null
const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || ''
const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const model = process.env.INSIGHTS_MODEL || 'deepseek-v4-pro'

const OUT = join(DATA, 'insight-reports')
mkdirSync(OUT, { recursive: true })

function isoWeek(d) {
  const date = new Date(d + 'T00:00:00Z')
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
function weekLabel(isoWk) {
  const m = isoWk.match(/^(\d{4})-W(\d{2})$/)
  const d = new Date(Date.UTC(+m[1], 0, 4))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1 + (+m[2] - 1) * 7)
  const fmt = (x) => `${x.getUTCFullYear()}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${String(x.getUTCDate()).padStart(2, '0')}`
  return `${fmt(d)}～${fmt(new Date(d.getTime() + 6 * 86400000))}`
}

const analysis = readJson(PATHS.analysis)
const dyn = readJson(PATHS.dynamics)
const scenarios = readJson(join(DATA, 'scenarios.json'), null)
// 内容层用宽松读法（last-wins 去重）：collect 层的瞬时重复不该阻塞报告生成；
// analyze/site 等正确性敏感环节仍走 loadPlugins 的 0 重复硬门禁。
const plugins = [...readJsonl(PATHS.plugins).reduce((m, r) => {
  const k = (r.full_name || '').toLowerCase()
  if (k) m.set(k, r)
  return m
}, new Map()).values()]
// 分数在 data/insights.json（score 步骤产物），plugins.jsonl 行不带 score
const scoreOf = new Map((readJson(join(DATA, 'insights.json'), {})?.plugins || [])
  .map((p) => [(p.full_name || '').toLowerCase(), p]))
for (const p of plugins) {
  const s = scoreOf.get((p.full_name || '').toLowerCase())
  if (s) { p.score = s.score ?? s.health?.score; p.grade = s.grade ?? s.health?.grade }
}
const history = readJson(PATHS.history)?.entries || []
const metricsRows = readJsonl(join(DATA, 'metrics.jsonl'))
const wk = WK_OVERRIDE || isoWeek(new Date().toISOString().slice(0, 10))

/* ------------------------------------------------------------------ *
 * 1) 确定性信号计算（规则化异常检测，LLM 的 grounding 事实源）
 * ------------------------------------------------------------------ */
const signals = []
const now = Date.now()
const dayMs = 86400000

// 周 diff（与周报同基线逻辑：距今 ≥7 天中最近一条 history）
const target = now - 7 * dayMs
const older = history.filter((e) => new Date(e.date).getTime() <= target)
const baseEntry = older.length ? older[older.length - 1] : history[0]
let diff = null
if (baseEntry?.plugins) {
  const prev = baseEntry.plugins
  const cur = new Map(plugins.map((r) => [r.full_name, r]))
  const added = [...cur.keys()].filter((k) => !(k in prev))
  const removed = Object.keys(prev).filter((k) => !cur.has(k))
  const risers = [...cur.entries()]
    .filter(([k, r]) => k in prev && prev[k].stars != null && (r.stars || 0) > prev[k].stars)
    .map(([k, r]) => ({ id: k, delta: (r.stars || 0) - (prev[k].stars || 0) }))
    .sort((a, b) => b.delta - a.delta).slice(0, 10)
  const downgrades = [...cur.entries()]
    .filter(([k, r]) => k in prev && prev[k].score != null && (r.score ?? 100) < prev[k].score - 10)
    .map(([k, r]) => ({ id: k, from: prev[k].score, to: r.score })).slice(0, 10)
  diff = { baseDate: baseEntry.date, added: added.length, removed: removed.length, risers, downgrades }
  const gapDays = Math.round((now - new Date(baseEntry.date).getTime()) / dayMs)
  if (gapDays < 5 || gapDays > 10) diff.caveat = `基线 ${baseEntry.date} 距今 ${gapDays} 天，非标准 7 天周 diff——added/removed 是相对该基线的累计变化，不得表述为「本周新增」`
  if (removed.length > added.length) signals.push({ kind: 'shrink', severity: 'high', fact: `本周权威集净减少（+${added} / −${removed}）——仓库删除/私有化或校验口径变化的信号`, factEn: `Authoritative set shrank this week (+${added} / −${removed}) — repos deleted/renamed or a gate change`, data: { added: added.length, removed: removed.length } })
}

// 增长异常：本周新增 vs metrics 历史的周新增均值
const prevMetrics = metricsRows.slice(-5, -1)
if (diff && prevMetrics.length >= 2) {
  const adds = prevMetrics.map((m, i, arr) => (i === 0 ? null : m.authoritative - arr[i - 1].authoritative)).filter((x) => x != null)
  const mean = adds.reduce((a, b) => a + b, 0) / adds.length
  if (mean > 0 && (diff.added > mean * 2.5 || diff.added < mean * 0.3)) {
    signals.push({ kind: 'growth-anomaly', severity: 'mid', fact: `本周新增 ${diff.added}，近 ${adds.length} 周均值 ${mean.toFixed(0)}——${diff.added > mean ? '突增，可能有批量导入/刷库' : '骤降，发现或收录链路需核查'}`, factEn: `${diff.added} new this week vs ${mean.toFixed(0)} weekly average — ${diff.added > mean ? 'a spike; possible batch import/farming' : 'a sharp drop; check discovery/intake'}`, data: { added: diff.added, mean } })
  }
}

// owner 集群：低质量批量账号（spam 刷库模式）
const byOwner = new Map()
for (const p of plugins) {
  const o = p.owner || p.full_name?.split('/')[0]
  if (!o) continue
  if (!byOwner.has(o)) byOwner.set(o, [])
  byOwner.get(o).push(p)
}
const clusters = [...byOwner.entries()]
  .filter(([, ps]) => ps.length >= 5)
  .map(([o, ps]) => {
    const scored = ps.filter((p) => p.score != null)
    return {
      owner: o, count: ps.length, scored: scored.length,
      avg: scored.length ? Math.round(scored.reduce((a, p) => a + p.score, 0) / scored.length) : null,
      noReadme: ps.filter((p) => !(p.files?.readmeBytes > 0)).length,
    }
  })
  .sort((a, b) => b.count - a.count)
for (const c of clusters.filter((c) => c.count >= 8 && ((c.avg != null && c.avg < 60) || c.noReadme / c.count > 0.8)).slice(0, 5)) {
  signals.push({ kind: 'owner-cluster', severity: 'mid', fact: `账号 ${c.owner} 有 ${c.count} 个插件${c.avg != null ? `、均分仅 ${c.avg}` : '（尚未评分）'}${c.noReadme ? `、${c.noReadme} 个无 README` : ''}——疑似批量刷库/模板复制`, factEn: `Account ${c.owner} holds ${c.count} plugins${c.avg != null ? `, avg score only ${c.avg}` : ' (unscored)'}${c.noReadme ? `, ${c.noReadme} without README` : ''} — suspected template farming`, data: c })
}

// 头部账号集中度：单一账号占比过高本身是生态结构风险（模板批量号）
const top1 = clusters[0]
if (top1 && top1.count / plugins.length >= 0.05) {
  signals.push({ kind: 'dominant-owner', severity: 'low', fact: `最大账号 ${top1.owner} 独占 ${top1.count} 个插件（占全生态 ${Math.round((top1.count / plugins.length) * 100)}%）${top1.avg != null ? `、均分 ${top1.avg}` : ''}——模板批量号拉高规模数字，解读增长时需剔除水分`, factEn: `Largest account ${top1.owner} alone holds ${top1.count} plugins (${Math.round((top1.count / plugins.length) * 100)}% of the ecosystem)${top1.avg != null ? `, avg score ${top1.avg}` : ''} — template batch account inflates scale numbers`, data: { owner: top1.owner, count: top1.count, avg: top1.avg } })
}

// 活跃度与失活
const stale90 = plugins.filter((p) => p.pushed_at && now - new Date(p.pushed_at).getTime() > 90 * dayMs).length
const stalePct = Math.round((stale90 / plugins.length) * 100)
if (stalePct >= 40) signals.push({ kind: 'stale', severity: 'mid', fact: `${stalePct}% 的插件超过 90 天未更新（${stale90}/${plugins.length}）——生态失活比例偏高`, factEn: `${stalePct}% of plugins untouched for 90+ days (${stale90}/${plugins.length}) — elevated abandonment ratio`, data: { stale90, total: plugins.length } })

// 下载集中度
const dls = plugins.filter((p) => p.weekly > 0)
if (dls.length >= 10) {
  const sum = dls.reduce((a, p) => a + p.weekly, 0)
  const top10 = [...dls].sort((a, b) => b.weekly - a.weekly).slice(0, 10).reduce((a, p) => a + p.weekly, 0)
  const share = Math.round((top10 / sum) * 100)
  if (share >= 70) signals.push({ kind: 'concentration', severity: 'low', fact: `周下载 Top10 占全部已发布插件下载的 ${share}%——流量高度集中，长尾曝光困难`, factEn: `Top 10 plugins take ${share}% of all weekly downloads — heavy concentration, long tail gets little exposure`, data: { share, sum } })
}

// npm 滞后
const staleNpm = (analysis.npmStaleTop || []).length
if (staleNpm >= 10) signals.push({ kind: 'npm-stale', severity: 'low', fact: `${staleNpm} 个插件仓库版本领先 npm 发布版本——安装侧拿到的是旧版`, factEn: `${staleNpm} plugins have repo versions ahead of npm — installs get outdated builds`, data: { count: staleNpm } })

// 官方动态：本周新 release（含 breaking）
const rels = (dyn?.dsh?.releases || []).filter((r) => r.published_at && now - new Date(r.published_at).getTime() <= 7 * dayMs)
const breaking = rels.filter((r) => r.breaking)
if (breaking.length) signals.push({ kind: 'breaking-release', severity: 'high', fact: `dsh 官方本周发布 ${rels.length} 个版本，其中 ${breaking.length} 个含 breaking 变更（${breaking.map((r) => r.tag).join(', ')}）——插件作者需评估适配`, factEn: `dsh shipped ${rels.length} releases this week, ${breaking.length} with breaking changes (${breaking.map((r) => r.tag).join(', ')}) — plugin authors must adapt`, data: { releases: rels.map((r) => r.tag) } })

/* ------------------------------------------------------------------ *
 * 2) 数据包（bounded，喂给 LLM 的全部事实）
 * ------------------------------------------------------------------ */
const t0 = analysis.totals || {}
const q = analysis.quality || {}
const pack = {
  week: wk, range: weekLabel(wk), snapshot: (analysis.generatedAt || '').slice(0, 10),
  totals: t0,
  grades: q.grades, avgScore: q.avgScore, medianStars: analysis.medianStars,
  distribution: analysis.distribution,
  categories: (analysis.categories || []).slice(0, 10),
  topByStars: (analysis.topByStars || []).slice(0, 8),
  downloadsTop: (analysis.downloads?.top || []).slice(0, 10),
  npmStaleTop: (analysis.npmStaleTop || []).slice(0, 5),
  suggested: (analysis.suggested || []).slice(0, 8),
  coverage: analysis.coverage && { topicUniverse: analysis.coverage.topicUniverse?.count, candidates: analysis.coverage.candidates, authoritative: t0.authoritative },
  scenarios: scenarios?.scenarios?.slice(0, 8)?.map((s) => ({ id: s.id, plugins: s.plugins?.length })) ?? null,
  dynamics: dyn && {
    dshStars: dyn.dsh?.stars, dshPushed: (dyn.dsh?.pushed_at || '').slice(0, 10),
    latestRelease: (dyn.dsh?.releases || [])[0] && { tag: dyn.dsh.releases[0].tag, at: (dyn.dsh.releases[0].published_at || '').slice(0, 10), breaking: !!dyn.dsh.releases[0].breaking },
    platform: (dyn.platform || []).filter((p) => !p.error).map((p) => ({ repo: p.repo, stars: p.stars, latest: p.latestRelease?.tag })),
  },
  weeklyDiff: diff,
  signals,
}

const prompt = `你是 DeepSeek Harness（DSH，Everything is a Plugin）插件生态的首席分析师，为 DSH Insights 观察站（dsh-insights.com）撰写阶段性生态洞察报告（${wk}，${pack.range}）。

## 硬规则
- 只允许使用下面数据包中的数字与事实；禁止编造任何数字、插件名或事件。数据缺失就明说缺失。
- 数据包里的 signals 是规则引擎已检出的异常/风险，必须逐条给出：可能原因（假设要标注为假设）、影响面、解决方案或应对建议。
- 写作风格：结论先行、专业克制、面向插件作者/生态用户/DSH 官方三类读者。

## 结构（zh_md 与 en_md 都按此结构）
1. 核心结论（3–5 条 bullet，每条一行：- **一句话结论**：数据支撑…）
2. 生态健康度评估：**必须用一个 markdown 表格**（| 维度 | 本期数值 | 解读 | 三列），逐行覆盖：规模、增长、质量分布、活跃度（7 日/30 日）、npm 发布率、文档覆盖；表格之后只允许 1–2 句总体判断
3. 质量与风险：**用 bullet 列表**，每条一个风险点：- **风险点**：数据 + 影响；禁止长段落
4. 异常与应对（逐条处理 signals；无 signals 则写本期无显著异常并说明监测口径）
5. 下一阶段重点与建议（分角色：插件作者 / 生态用户 / DSH 官方，各 2–4 条可执行建议 bullet）
6. 官方动态解读（bullet 列表，每条一个观察 + 对生态的影响）

## 格式约束（我们的渲染器是极简 markdown，必须遵守）
- **除各小节末尾 1–2 句的判断外，全文禁止超过 2 行的连续段落**——数据密集内容一律用表格或 bullet。
- 每个异常信号用 ### 三级标题（标题含信号名与 severity），下面固定三条**各自独占一行**的 bullet：- **可能原因（假设）**：…、- **影响面**：…、- **应对建议**：…。严禁把多个要点续行揉进同一个列表项或段落。
- 所有列表项单行写完；段落之间留空行；不要在列表项内换行续写。
- 表格用标准三列管道格式（表头 + 分隔行 + 数据行），单元格内不要有换行。
- 关键数字、结论性判断用 **加粗** 凸显（渲染时会重点标出）。

## 输出
严格 JSON（不要 markdown 代码围栏）：
{"title_zh":"…（含周数，如 DSH 生态洞察 · ${wk}，不要再带日期范围）","title_en":"…","zh_md":"…完整中文报告 markdown（1200–1800 字；正文从第一个 ## 小节开始，不要重复报告标题，不要再写 H1）…","en_md":"…full English edition in markdown, not a translation summary but a standalone report; start from the first ## section, no H1…"}

## 数据包字段注意
- weeklyDiff.baseDate 是 diff 的实际基线日期；若带 caveat 字段，必须按 caveat 的口径表述（相对基线的累计变化），并写明基线日期，严禁写成「本周新增/本周环比」。

## 数据包
${JSON.stringify(pack)}`

/* ------------------------------------------------------------------ *
 * 3) 调用 DeepSeek 并落盘
 * ------------------------------------------------------------------ */
if (DRY) {
  console.log(`[insights] dry-run · week=${wk} model=${model} key=${key ? 'set' : 'MISSING'}`)
  console.log(`[insights] prompt bytes=${Buffer.byteLength(prompt)} · signals=${signals.length}`)
  for (const s of signals) console.log(`  - [${s.severity}] ${s.kind}: ${s.fact}`)
  process.exit(0)
}
if (!key) { console.error('[insights] DEEPSEEK_API_KEY 未配置 —— 跳过（不阻断管线）'); process.exit(0) }

const r = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000,
  }),
  signal: AbortSignal.timeout(300000),
})
if (!r.ok) { console.error(`[insights] API HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1) }
const doc = await r.json()
const content = doc.choices?.[0]?.message?.content || ''
let report
try { report = JSON.parse(content.replace(/^```(?:json)?|```$/gm, '').trim()) } catch (e) {
  console.error(`[insights] JSON parse failed: ${e.message}; content head: ${content.slice(0, 200)}`)
  process.exit(1)
}
if (!report.zh_md || !report.en_md) { console.error('[insights] 输出缺 zh_md/en_md 字段'); process.exit(1) }

// 防御性清洗：模型偶尔在正文重复 H1 标题——剥掉，标题由落盘头统一生成
const stripH1 = (md) => md.trim().replace(/^#\s+[^\n]+\n+/, '')
const withRange = (title) => /\d{4}[/.-]\d{2}/.test(title || '') ? title : `${title}（${pack.range}）`
const titleZh = withRange(report.title_zh || `DSH 生态洞察 · ${wk}`)
const titleEn = withRange(report.title_en || `DSH Ecosystem Insights · ${wk}`)

const headZh = `> 由 DSH Insights 管线 + DeepSeek（${model}）生成 · 数据快照 ${pack.snapshot} · 启发式评估，非安全审计\n\n`
const headEn = `> Generated by the DSH Insights pipeline + DeepSeek (${model}) · snapshot ${pack.snapshot} · heuristic evaluation, not a security audit\n\n`
writeFileSync(join(OUT, `${wk}.md`), `# ${titleZh}\n\n${headZh}${stripH1(report.zh_md)}\n`)
writeFileSync(join(OUT, `${wk}.en.md`), `# ${titleEn}\n\n${headEn}${stripH1(report.en_md)}\n`)
writeFileSync(join(OUT, `${wk}.json`), JSON.stringify({ week: wk, range: pack.range, generatedAt: new Date().toISOString(), model, usage: doc.usage || null, title: { zh: report.title_zh, en: report.title_en }, signals }, null, 2))
console.log(`[insights] → ${OUT}/${wk}.{md,en.md,json} · signals=${signals.length} · tokens=${doc.usage?.total_tokens ?? '?'}`)
