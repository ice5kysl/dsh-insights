#!/usr/bin/env node
/**
 * pipeline/publish · pages — multi-page static site generator (the "pages" layer on top of
 * the single-page dashboard from stage 4).
 *
 * Generates:
 *   site/weekly/<slug>.html + weekly/index.html   from data/weekly/*.md
 *   site/p/<owner>/<repo>/index.html              from data/reports/*.md
 *   site/about/index.html                          methodology / rules / boundaries
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

  // ---- /about/ methodology ------------------------------------------------
  written.push(out('about/index.html', page({
    title: '方法论', desc: 'DSH Insights 评估口径、规则阈值、校准与边界声明。',
    base: '../', here: 'about/',
    body: `<p class="crumb">Methodology</p><h1 class="pagetitle">方法论与边界</h1>
<p class="lede">我们把口径公开到可以被反驳的程度——这是策展人和官方敢引用我们的前提。</p>
<div class="article">
<h2>权威集门禁</h2>
<p>非 fork / 非归档 · <code>package.json</code> 声明 <code>dsh.bundle.patch</code> · patch 文件已提交。这是下限口径：纯 tarball 分发的插件会进入分桶人工复核（<code>invalid.jsonl</code>）。</p>
<h2>覆盖与完整性（为什么权威集 ≪ topic 总数）</h2>
<p>GitHub <code>topic:dsh-plugin</code> 是官方唯一发现机制，<b>打标即入、零门槛</b>——其中混有大量蹭标、无关仓库、fork、monorepo 子路径与已删除仓库。我们的漏斗：<b>topic 宇宙（≈13.7k，首页漏斗实时口径）→ 多源候选（topic 分片全量抓取 + 策展目录 + npm 映射，去重）→ manifest 门禁逐条校验 → 权威集 + 分桶</b>。权威集是「货真价实可按官方 bundle 形态安装」的下限子集；<code>no-dsh-bundle</code> / <code>no-package.json</code> 桶里的候选可能是插件但形态非标，留待人工复核而不是混入权威集。校验按 API 预算<b>滚动推进、断点续跑</b>，权威集随每次快照扩大——<b>覆盖率数字本身也公开</b>（首页覆盖漏斗），这就是我们对「完整性」的回答方式：不报大数，报可核验的数。</p>
<h2>健康分（health-v2）</h2>
<p>100 起扣 · warn −5 / fail −20 · 纯客观信号（manifest 规范 / npm 发布与版本一致 / README 与中文文档 / LICENSE / dsh-plugin topic / 活跃度），星数不进分。阈值：<span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>。每条扣分带证据；探测不到的数据不虚构、不扣分（missing 明示）。规则全文与 changelog 见 <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/SCHEMA.md" target="_blank">SCHEMA §health</a>。</p>
<h2>校准</h2>
<p>已知真/假插件编入校准集，每次快照跑回归（<code>pipeline/validate/regress.mjs</code>），回归非 100% 则当周快照不发布。口径变更必须 bump 规则版本并写 changelog。</p>
<h2>边界声明</h2>
<p>启发式评估 ≠ 安全审计。不做社区评分/投票、不做安装托管交易、不做登录产品。深检（写面/消毒）为增量信号，单独标注。</p>
<h2>可复核</h2>
<p>数据、规则、管线全部开源：<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>。发现误判请提 issue —— 争议工单本身是公信力指标（见指标体系 C2）。</p>
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
- ${ORIGIN}/weekly/ — 周报存档
- ${ORIGIN}/p/<owner>/<repo>/ — 单插件健康报告
- ${ORIGIN}/about/ — 方法论与口径
- ${ORIGIN}/data/ — 数据集索引与许可（CC BY 4.0）

## 源仓库
- https://github.com/ice5kysl/dsh-insights（管线 + 完整历史快照）
`))

  console.log(`[pages] ${written.length} 个产物：`)
  for (const w of written) console.log('  -', w)
}

main()
