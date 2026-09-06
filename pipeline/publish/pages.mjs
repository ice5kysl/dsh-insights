#!/usr/bin/env node
/**
 * pipeline/publish · pages — multi-page static site generator (the "pages" layer on top of
 * the single-page dashboard from stage 4).
 *
 * Generates:
 *   site/weekly/<slug>.html + weekly/index.html   from data/weekly/*.md
 *   site/p/<owner>/<repo>/index.html              from data/reports/*.md
 *   site/dynamics/index.html                       official dynamics (L2)
 *   site/scenarios/index.html                      scenario bundle recommendations
 *   site/about/index.html                          about / methodology / metrics
 *   site/data/index.html                           open-data index (+ copies data files)
 *   site/feed.xml                                  RSS for the weekly
 *   site/llms.txt                                  agent navigation
 *
 * Zero-dependency; page chrome and Markdown rendering live in lib/page.mjs.
 * Run: node pipeline/publish/pages.mjs   (after analyze/site/report/weekly stages)
 *
 * @module dsh-insights/stage-20
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { page, mdToHtml, mdTitle, escHtml } from '../../lib/page.mjs'
import { DATA, SITE, PATHS } from '../../lib/data.mjs'

const ORIGIN = 'https://dsh-insights.com'

const out = (rel, content) => {
  const p = join(SITE, rel)
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, content)
  return rel
}
const read = (...parts) => { try { return readFileSync(join(DATA, ...parts), 'utf8') } catch { return null } }

// ISO week → Monday date (for RSS pubDate)
function isoWeekDate(y, w) {
  const d = new Date(Date.UTC(y, 0, 4))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1 + (w - 1) * 7)
  return d
}

function main() {
  const written = []

  // ---- weekly pages ------------------------------------------------------
  const weeklyFiles = readdirSync(PATHS.weeklyDir)
    .filter((f) => /^(\d{4})-W(\d{2}).*\.md$/.test(f))
    .sort().reverse()
  const weekly = []
  for (const f of weeklyFiles) {
    const md = read('weekly', f)
    if (!md) continue
    const m = f.match(/^(\d{4})-W(\d{2})/)
    const slug = `${m[1]}-W${m[2]}`
    const title = mdTitle(md, `DSH 插件生态周报 · ${slug}`)
    const date = isoWeekDate(+m[1], +m[2])
    const body = `<p class="crumb">生态周报 · ${slug}</p>
<div class="article">${mdToHtml(md)}</div>`
    written.push(out(`weekly/${slug}.html`, page({
      title, desc: 'DSH 插件生态周报（自动生成 · 数据可复核）',
      base: '../', here: 'weekly/', body, og: { type: 'article' },
    })))
    weekly.push({ slug, title, date })
  }
  const weeklyList = weekly.map((w) =>
    `<div class="listrow"><a href="${w.slug}.html">${escHtml(w.title)}</a><span class="meta">${w.slug}</span></div>`).join('')
  written.push(out('weekly/index.html', page({
    title: '生态周报', desc: 'DSH 插件生态周报存档：每周五自动生成，机器整理、人工校对后外发。',
    base: '../', here: 'weekly/',
    body: `<p class="crumb">Weekly</p><h1 class="pagetitle">生态周报</h1>
<p class="lede">每周五自动生成 · 数据快照驱动 · 面向社区与 dsh 官方。订阅：<a href="../feed.xml">RSS</a> 或 watch <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub 仓库</a>。</p>
${weeklyList || '<p class="lede">暂无周报。</p>'}`,
  })))

  // ---- plugin letter pages (/p/<owner>/<repo>/) --------------------------
  const reportFiles = existsSync(PATHS.reportsDir)
    ? readdirSync(PATHS.reportsDir).filter((f) => f.endsWith('.md')) : []
  for (const f of reportFiles) {
    const md = read('reports', f)
    if (!md) continue
    const [owner, repo] = f.replace(/\.md$/, '').split('__')
    if (!owner || !repo) continue
    const title = mdTitle(md, `${owner}/${repo}`)
    const body = `<p class="crumb">致作者的信 · ${escHtml(owner)}/${escHtml(repo)}</p>
<div class="article">${mdToHtml(md)}</div>`
    written.push(out(`p/${owner}/${repo}/index.html`, page({
      title, desc: `${owner}/${repo} 的健康体检与改进建议（DSH Insights 自动生成）`,
      base: '../../../', here: null, body, og: { type: 'article' },
    })))
  }

  // ---- /data/ open-data index (+ copy public datasets) -------------------
  const DATASETS = [
    ['insights.json', '全量洞察快照（agent 首选入口）'],
    ['plugins.jsonl', '权威集全量（一行一插件）'],
    ['invalid.jsonl', '噪声分桶（被拒候选 + reason）'],
    ['enrich.json', '每插件评分 / 等级 / 分类 / 收录渠道'],
    ['analysis.json', '聚合统计（仪表盘数据源）'],
    ['plugins.csv', '权威集表格（25 列，Excel 友好）'],
    ['downloads.json', 'npm 周下载（CI 更新）'],
    ['listed.json', '收录渠道清单（awesome / imsai）'],
  ]
  const cards = []
  mkdirSync(join(SITE, 'data'), { recursive: true })
  for (const [f, desc] of DATASETS) {
    const src = join(DATA, f)
    if (!existsSync(src)) continue
    copyFileSync(src, join(SITE, 'data', f))
    const kb = Math.round(statSync(src).size / 1024)
    written.push(`data/${f}（拷贝）`)
    cards.push(`<div class="card"><b>${escHtml(desc)}</b><code>/data/${f}</code><p>${kb} KB · <a href="${f}">下载</a> · <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/SCHEMA.md" target="_blank">schema</a></p></div>`)
  }
  written.push(out('data/index.html', page({
    title: '开放数据', desc: 'DSH Insights 开放数据集：稳定 URL、可复核口径、CC BY 4.0。',
    base: '../', here: 'data/',
    body: `<p class="crumb">Open Data</p><h1 class="pagetitle">开放数据</h1>
<p class="lede">全量、可复核、持续更新。URL 稳定（公布即不变更），agent 可直接抓取，无需登录。使用请注明出处（CC BY 4.0）。</p>
<div class="cards">${cards.join('')}</div>
<h2 style="font-size:16px;margin:28px 0 8px">许可与口径</h2>
<p class="lede">代码 <b>MIT</b> · 数据 <b>CC BY 4.0</b>（署名：dsh-insights.com）。「权威集」= 非 fork/归档 + package.json 声明 dsh.bundle.patch 且 patch 已提交（下限口径）。健康分为启发式评估，<b>非安全审计</b>。</p>
<h2 style="font-size:16px;margin:28px 0 8px">调用示例</h2>
<pre style="background:var(--track);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;overflow:auto"><code>curl ${ORIGIN}/data/insights.json
curl ${ORIGIN}/feed.xml          # 周报 RSS</code></pre>`,
  })))

  // ---- /scenarios/ 场景组合推荐 -------------------------------------------
  const scenarios = (JSON.parse(read('scenarios.json') || '{"scenarios":[]}')).scenarios || []
  const scCards = scenarios.filter((s) => (s.plugins || []).length).map((s) => {
    const rows = s.plugins.map((p) => `<div class="listrow"><a href="${escHtml(p.url)}" target="_blank">${escHtml(p.full_name)}</a><span class="meta"><span class="grade ${escHtml(p.grade)}">${escHtml(p.grade)}</span> ${p.score} · ★${p.stars}${p.npm ? ' · npm ' + escHtml(p.npm) : ''}${p.active ? ' · 活跃' : ''}</span></div>`).join('')
    const reasons = [...new Set(s.plugins.flatMap((p) => p.reasons || []))].slice(0, 3).join('；')
    return `<div class="card"><b>${escHtml(s.zh)} <span style="color:var(--faint);font-weight:400;font-size:11.5px">${escHtml(s.en)}</span></b><p>${s.candidates} 个候选 · 按健康分/npm/活跃排序${reasons ? ' · ' + escHtml(reasons) : ''}</p>${rows}</div>`
  }).join('\n')
  written.push(out('scenarios/index.html', page({
    title: '场景组合推荐', desc: '按使用场景挑选 dsh 插件组合：客观信号排序、每场景给备选、理由可展开。',
    base: '../', here: 'scenarios/',
    body: `<p class="crumb">Scenarios</p><h1 class="pagetitle">场景组合推荐</h1>
<p class="lede">从「我要做什么」出发，而不是从「哪个星多」出发。每个场景给出健康分最高、npm 已发布、近期活跃的一组候选与备选——<b>客观信号排序，不接"最佳"叙事，不做付费置顶</b>。覆盖 ${scenarios.reduce((n, s) => n + (s.plugins || []).length, 0)} 个推荐位，随每日快照刷新。</p>
<div class="cards">${scCards || '<div class="card"><b>数据积累中</b><p>场景数据随 LLM 标注覆盖逐步补齐。</p></div>'}</div>
<h2 style="font-size:16px;margin:28px 0 8px">排序口径</h2>
<p class="lede">场景归属 = LLM 能力标签 ∪ 词汇桶（标注"LLM 生成，人工抽查"）；场景内排序 = 健康分 → npm 已发布 → 近 30 天活跃，星数仅作展示不参与排序。同样的数据在 <a href="../data/insights.json">/data/insights.json</a> 开放，agent 可直接消费。</p>`,
  })))

  // ---- /dynamics/ 官方动态（L2） -------------------------------------------
  const dyn = JSON.parse(read('dynamics.json') || 'null')
  let dynBody = ''
  if (dyn) {
    const dsh = dyn.dsh || {}
    const npm = dsh.npm || {}
    const daysSince = (iso) => iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null
    const distRows = Object.entries(npm.distTags || {}).map(([tag, v]) => {
      const ver = (npm.versions || []).find((x) => x.version === v)
      return `<tr><td>${escHtml(tag)}</td><td class="mono">${escHtml(v)}</td><td>${ver ? escHtml((ver.time || '').slice(0, 10)) + '（' + daysSince(ver.time) + ' 天前）' : '—'}</td></tr>`
    }).join('')
    const relRows = (dsh.releases || []).map((r) => `<div class="listrow"><a href="https://github.com/${escHtml(dsh.repo)}/releases/tag/${escHtml(r.tag)}" target="_blank">${escHtml(r.tag)}${r.breaking ? ' <span class="pill" style="color:var(--warn);border-color:var(--warn)">breaking?</span>' : ''}</a><span class="meta">${r.prerelease ? 'pre-release' : 'release'} · ${escHtml((r.published_at || '').slice(0, 10))}</span></div>`).join('')
    const platRows = (dyn.platform || []).filter((p) => !p.error).map((p) => `<div class="listrow"><a href="https://github.com/${escHtml(p.repo)}" target="_blank">${escHtml(p.repo)}</a><span class="meta">★${(p.stars || 0).toLocaleString()} · push ${escHtml((p.pushed_at || '').slice(0, 10))}${p.latestRelease ? ' · ' + escHtml(p.latestRelease.tag) : ''}</span></div>`).join('')
    const cs = dyn.compatSignal
    dynBody = `<p class="crumb">Official Dynamics</p><h1 class="pagetitle">官方动态</h1>
<p class="lede">dsh 官方与 DeepSeek 平台的可观测公开信号（releases / dist-tags / 仓库活动），每日随快照刷新。不做新闻舆情。采集于 ${escHtml((dyn.fetchedAt || '').slice(0, 16).replace('T', ' '))} UTC。</p>
<div class="cards">
  <div class="card"><b>DeepSeek Harness（dsh 官方）</b><code>${escHtml(dsh.repo)}</code><p>★${(dsh.stars || 0).toLocaleString()} · 最近 push ${escHtml((dsh.pushed_at || '').slice(0, 10))} · ${escHtml(dsh.description || '')}</p></div>
  <div class="card"><b>npm dist-tags</b><code>@deepseek-ai/dsh</code><table style="width:100%;font-size:12.5px;margin-top:8px"><tr><th align="left">tag</th><th align="left">版本</th><th align="left">发布时间</th></tr>${distRows}</table></div>
  <div class="card"><b>rc 兼容信号（雷达 v0 前置普查）</b><p>已探测 ${cs ? cs.pluginsProbed : '—'} 个 npm 插件：声明 <code>engines.dsh</code> 的仅 <b>${cs ? cs.declaringEngines : '—'}</b> 个，声明 dsh peer 依赖的 ${cs ? cs.declaringPeers : '—'} 个。<br>声明率太低 → 「声明 vs 最新 rc」的雷达 v0 不成立，主线走 v1（插件 API 符号 × rc changelog 交集，M2）。当前最新 rc：<b>${escHtml((npm.distTags || {}).latest || '—')}</b>，升级前请到 <a href="https://github.com/${escHtml(dsh.repo)}/releases" target="_blank">releases</a> 核对 breaking 说明。</p></div>
</div>
<h2 style="font-size:16px;margin:28px 0 8px">dsh 官方 releases（最近 ${(dsh.releases || []).length} 个）</h2>
${relRows || '<p class="lede">暂无</p>'}
<h2 style="font-size:16px;margin:28px 0 8px">DeepSeek 平台官方仓库</h2>
${platRows}
<p class="lede" style="margin-top:18px">${escHtml(dyn.note || '')}</p>`
  }
  written.push(out('dynamics/index.html', page({
    title: '官方动态', desc: 'dsh 官方与 DeepSeek 平台的可观测动态：releases、dist-tags、rc 兼容信号。',
    base: '../', here: 'dynamics/',
    body: dynBody || '<p class="crumb">Official Dynamics</p><h1 class="pagetitle">官方动态</h1><p class="lede">数据采集中，下个快照上线。</p>',
  })))

  // ---- /about/ 关于 · 方法论与指标体系 --------------------------------------
  written.push(out('about/index.html', page({
    title: '关于', desc: 'DSH Insights 是什么、指标体系、评估口径与边界声明。',
    base: '../', here: 'about/',
    body: `<p class="crumb">About</p><h1 class="pagetitle">关于 · 方法论与指标体系</h1>
<p class="lede">我们把口径公开到可以被反驳的程度——这是策展人和官方敢引用我们的前提。</p>
<div class="article">
<h2>关于 DSH Insights</h2>
<p>DeepSeek Harness 的<b>生态与动态全景观察站</b>，三层：L1 插件洞察（真伪判定 → 权威集 → 健康分 → 收录矩阵）、L2 官方动态（releases/rc 节奏 + rc 兼容雷达，建设中）、L3 生态报告（「致作者的信」与生态周报）。我们不做目录、不做市场、不做榜单——只提供可引用、可复核的数据与观测，<b>被生态吸收而非与之竞争</b>。独立个人项目，与 DeepSeek 官方无隶属关系；数据、规则、管线全部开源（<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>），发现误判请提 issue。</p>
<h2>权威集门禁</h2>
<p>非 fork / 非归档 · <code>package.json</code> 声明 <code>dsh.bundle.patch</code> · patch 文件已提交。这是下限口径：纯 tarball 分发的插件会进入分桶人工复核（<code>invalid.jsonl</code>）。</p>
<h2>覆盖与完整性（为什么权威集 ≪ topic 总数）</h2>
<p>GitHub <code>topic:dsh-plugin</code> 是官方唯一发现机制，<b>打标即入、零门槛</b>——其中混有大量蹭标、无关仓库、fork、monorepo 子路径与已删除仓库。我们的漏斗：<b>topic 宇宙（≈13.7k，首页漏斗实时口径）→ 多源候选（topic 分片全量抓取 + 策展目录 + npm 映射，去重）→ manifest 门禁逐条校验 → 权威集 + 分桶</b>。权威集是「货真价实可按官方 bundle 形态安装」的下限子集；<code>no-dsh-bundle</code> / <code>no-package.json</code> 桶里的候选可能是插件但形态非标，留待人工复核而不是混入权威集。校验按 API 预算<b>滚动推进、断点续跑</b>，权威集随每次快照扩大——<b>覆盖率数字本身也公开</b>（首页覆盖漏斗），这就是我们对「完整性」的回答方式：不报大数，报可核验的数。</p>
<h2>插件评估指标体系（六维框架 v1）</h2>
<p>每个插件从六个维度考察：<b>计分四维</b>进入总分（100 起扣 · warn −5 / fail −20），<b>展示两维</b>只呈现不进分，<b>兼容性</b>为预留维度。阈值：<span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>；插件详情抽屉可见各维度子分（dimScores）。</p>
<table>
<tr><th>维度</th><th>指标项</th><th>计分处理</th></tr>
<tr><td>工程质量</td><td>client 导出 · main=lib 布局 · files 白名单 · npm 发布 · 版本一致</td><td><b>计分</b></td></tr>
<tr><td>文档完整性</td><td>README（唯一的 fail 级）· 中文/双语文档 · LICENSE</td><td><b>计分</b></td></tr>
<tr><td>可发现性</td><td>dsh-plugin topic（计分）· 策展收录（只展示）</td><td><b>部分计分</b></td></tr>
<tr><td>维护活跃</td><td>仓库年龄 · 30 天无提交（npm ≥2 版本豁免新仓规则）</td><td><b>计分</b></td></tr>
<tr><td>安全卫生</td><td>写面 / 渲染消毒（深检抽样，启发式≠审计）</td><td>增量信号，<b>不进总分</b></td></tr>
<tr><td>采用度</td><td>★ · npm 周下载 · 收录渠道</td><td><b>只展示不进分</b>（可刷/污染）</td></tr>
<tr><td>兼容性</td><td>engines.dsh 声明（实测仅 ~1% 插件声明）· API 符号 × rc changelog（M2 雷达）</td><td>预留，暂缺测</td></tr>
</table>
<p>原则：纯客观信号 · 星数不进分 · 探测不到的不虚构不扣分（missing 明示）· 每条扣分带证据 · 社区评分永不引入。规则全文与 changelog 见 <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/SCHEMA.md" target="_blank">SCHEMA §health</a>。</p>
<h2>校准</h2>
<p>已知真/假插件编入校准集，每次快照跑回归（<code>pipeline/validate/regress.mjs</code>），回归非 100% 则当周快照不发布。口径变更必须 bump 规则版本并写 changelog。</p>
<h2>指标体系（我们怎么衡量自己）</h2>
<p>北极星：<b>数据/报告被生态采纳</b>——目录、市场或 dsh 官方引用我们的分数、观测或兼容预警。围绕它六组指标：</p>
<table>
<tr><th>组</th><th>回答的问题</th><th>关键指标</th></tr>
<tr><td>A 覆盖</td><td>做得全不全</td><td>权威集数量 · topic 全量覆盖率 · 候选池新鲜度</td></tr>
<tr><td>B 新鲜度</td><td>更新勤不勤</td><td>快照滞后 ≤7 天（CI 每日则 ≤1 天）· CI 成功率</td></tr>
<tr><td>C 公信力</td><td>分数信不信</td><td>校准回归通过率（目标 100%）· 争议工单数与解决时长 · 缺数据标注率</td></tr>
<tr><td>D 内容运转</td><td>引擎转不转</td><td>周报连续外发期数（断更即警报）· 信件覆盖率 · 作者反馈数</td></tr>
<tr><td>E 触达</td><td>有没有被看见</td><td>徽章部署仓库数 · repo ★ / 转载 · 站点访问</td></tr>
<tr><td>F 采纳</td><td>北极星的计数</td><td>引用/集成我们数据的目录·市场数 · rc 预警被 PR 采纳次数 · 官方触点记录</td></tr>
</table>
<p>红线：周报连续断更 2 期 → 内容产品线停新功能先修管线；校准回归非 100% → 当周快照不发布；采纳指标长期为 0 → 触发 go/pivot/kill 复盘。完整口径见 <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/PRODUCT-DESIGN.md" target="_blank">PRODUCT-DESIGN §四</a>。</p>
<h2>边界声明</h2>
<p>启发式评估 ≠ 安全审计。不做社区评分/投票、不做安装托管交易、不做登录产品。深检（写面/消毒）为增量信号，单独标注。</p>
<h2>可复核</h2>
<p>数据、规则、管线全部开源：<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>。发现误判请提 issue —— 争议工单本身是公信力指标（见上表 C 组）。</p>
</div>`,
  })))

  // ---- feed.xml (weekly RSS) ----------------------------------------------
  const items = weekly.slice(0, 20).map((w) => `  <item>
    <title>${escHtml(w.title)}</title>
    <link>${ORIGIN}/weekly/${w.slug}.html</link>
    <guid>${ORIGIN}/weekly/${w.slug}.html</guid>
    <pubDate>${w.date.toUTCString()}</pubDate>
  </item>`).join('\n')
  written.push(out('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>DSH Insights · DSH 生态周报</title>
  <link>${ORIGIN}/weekly/</link>
  <description>DeepSeek Harness 插件生态周报：每周五自动生成，数据可复核。</description>
  <language>zh-CN</language>
${items}
</channel>
</rss>
`))

  // ---- llms.txt (agent navigation) ----------------------------------------
  written.push(out('llms.txt', `# DSH Insights

DeepSeek Harness 全景观察站：插件健康（全量权威集 + 客观健康分 A–D）· 官方动态（dsh 官方 + DeepSeek 平台信号）· 生态趋势（生态周报）。启发式评估，非安全审计。

## 数据入口（稳定 URL，可直接抓取）
- ${ORIGIN}/data/insights.json — 全量洞察快照（首选）
- ${ORIGIN}/data/plugins.jsonl — 权威集（一行一插件）
- ${ORIGIN}/data/enrich.json — 每插件评分/分类/渠道
- ${ORIGIN}/feed.xml — 生态周报 RSS

## 页面
- ${ORIGIN}/ — 仪表盘（人类可读）
- ${ORIGIN}/dynamics/ — 官方动态（releases/dist-tags/rc 信号）
- ${ORIGIN}/scenarios/ — 场景组合推荐（按场景选插件）
- ${ORIGIN}/weekly/ — 周报存档
- ${ORIGIN}/p/<owner>/<repo>/ — 单插件健康报告
- ${ORIGIN}/about/ — 关于 · 方法论与指标体系
- ${ORIGIN}/data/ — 数据集索引与许可（CC BY 4.0）

## 源仓库
- https://github.com/ice5kysl/dsh-insights（管线 + 完整历史快照）
`))

  console.log(`[pages] ${written.length} 个产物：`)
  for (const w of written) console.log('  -', w)
}

main()
