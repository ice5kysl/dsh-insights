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
import { DATA, SITE, PATHS, loadPlugins, byFullName, readJsonl } from '../../lib/data.mjs'

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
    weekly.push({ slug, title, date, html: mdToHtml(md), md })
  }
  const weeklyIssues = weekly.map((w) => ({ slug: w.slug, title: w.title, html: w.html, md: w.md }))
  written.push(out('weekly/index.html', page({
    title: '生态周报', desc: 'DSH 插件生态周报存档：双栏阅读器，支持导出 Markdown / PDF / PNG。',
    base: '../', here: 'weekly/',
    body: `<p class="crumb">Weekly</p><h1 class="pagetitle">生态周报</h1>
<p class="lede">每周五自动生成 · 数据快照驱动 · 面向社区与 dsh 官方。订阅：<a href="../feed.xml">RSS</a> 或 watch <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub 仓库</a>。点左侧期次直接阅读，可导出 Markdown / PDF / PNG。</p>
<div class="wk">
  <aside class="wk-side" id="wk-side"></aside>
  <div class="wk-main">
    <div class="wk-bar">
      <span id="wk-cur" class="wk-cur"></span>
      <span class="wk-actions">
        <button class="wkbtn" id="wk-md">⬇ Markdown</button>
        <button class="wkbtn" id="wk-pdf">⬇ PDF</button>
        <button class="wkbtn" id="wk-png">⬇ 图片</button>
        <a class="wkbtn" id="wk-link" href="#" target="_blank">永久链接 ↗</a>
      </span>
    </div>
    <div id="wk-article" class="article"></div>
  </div>
</div>
<style>
.wk{display:grid;grid-template-columns:248px 1fr;gap:30px;align-items:start}
.wk-side{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:8px}
.wk-item{display:block;width:100%;text-align:left;border:0;background:none;padding:10px 12px;border-radius:9px;cursor:pointer;color:var(--mut);font-size:13px;line-height:1.45}
.wk-item:hover{background:var(--track);color:var(--ink)}
.wk-item.on{background:color-mix(in srgb,var(--accent) 9%,transparent);color:var(--accent);font-weight:650}
.wk-item small{display:block;font:11px var(--mono);color:var(--faint);margin-top:2px}
.wk-main{min-width:0}
.wk-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:18px}
.wk-cur{font:600 12.5px var(--mono);color:var(--mut)}
.wk-actions{display:flex;gap:6px;flex-wrap:wrap}
.wkbtn{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer;color:var(--mut)}
.wkbtn:hover{border-color:var(--faint);color:var(--ink);text-decoration:none}
@media(max-width:860px){.wk{grid-template-columns:1fr}.wk-side{position:static;max-height:none;display:flex;overflow-x:auto;gap:4px;padding:6px}.wk-item{white-space:nowrap;flex:none}}
@media print{
  body *{visibility:hidden}
  #wk-article,#wk-article *{visibility:visible}
  #wk-article{position:absolute;left:0;top:0;width:100%;padding:0 24px}
}
</style>
<script>
var ISSUES=${JSON.stringify(weeklyIssues).replace(/</g, '\\u003c')};
(function(){
  var side=document.getElementById('wk-side'),art=document.getElementById('wk-article'),cur=document.getElementById('wk-cur'),link=document.getElementById('wk-link');
  var bySlug={}; ISSUES.forEach(function(x){bySlug[x.slug]=x});
  function current(){ var h=decodeURIComponent((location.hash||'').replace(/^#/,'')); return bySlug[h]?h:ISSUES[0].slug }
  function render(){
    var s=current(),it=bySlug[s];
    art.innerHTML=it.html;
    cur.textContent=s;
    link.href='./'+s+'.html';
    side.querySelectorAll('.wk-item').forEach(function(b){b.classList.toggle('on',b.dataset.s===s)});
  }
  side.innerHTML=ISSUES.map(function(it){
    return '<button class="wk-item" data-s="'+it.slug+'">'+it.title.replace(/^DSH 插件生态周报 · /,'')+'<small>'+it.slug+'</small></button>' }).join('');
  side.querySelectorAll('.wk-item').forEach(function(b){b.addEventListener('click',function(){location.hash='#'+b.dataset.s})});
  window.addEventListener('hashchange',render);
  render();
  document.getElementById('wk-md').addEventListener('click',function(){
    var it=bySlug[current()];
    var blob=new Blob([it.md],{type:'text/markdown;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dsh-weekly-'+current()+'.md';a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
  });
  document.getElementById('wk-pdf').addEventListener('click',function(){ window.print() });
  document.getElementById('wk-png').addEventListener('click',function(){
    var s=current();
    var node=art.cloneNode(true);
    var w=860,h=Math.max(400,art.scrollHeight+80);
    var wrap=document.createElement('div');
    wrap.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
    wrap.setAttribute('style','width:'+w+'px;padding:36px 44px;background:#ffffff;color:#18181b;font:14px/1.75 -apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif');
    var st=document.createElement('style');
    st.textContent='h1{font-size:24px;margin:0 0 14px;letter-spacing:-.02em}h2{font-size:18px;margin:26px 0 8px;border-bottom:1px solid #e4e4e7;padding-bottom:6px}h3{font-size:15px;margin:20px 0 6px}p{margin:9px 0}ul,ol{margin:9px 0;padding-left:22px}li{margin:4px 0}blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid #e4e4e7;color:#71717a;background:#f4f4f5;border-radius:0 8px 8px 0;font-size:13px}code{font:12.5px ui-monospace,Menlo,Consolas,monospace;background:#f4f4f5;border-radius:5px;padding:1px 5px}pre{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:12px 14px;overflow:auto;font-size:12.5px}pre code{background:none;padding:0}table{width:100%;border-collapse:collapse;font-size:12.5px;margin:12px 0}th{color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.05em;text-align:left}th,td{padding:7px 10px;border-bottom:1px solid #e4e4e7;white-space:nowrap}hr{border:none;border-top:1px solid #e4e4e7;margin:24px 0}a{color:#2563eb;text-decoration:none}strong{font-weight:650}';
    wrap.appendChild(st);
    wrap.appendChild(node);
    var xhtml=new XMLSerializer().serializeToString(wrap);
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><foreignObject width="100%" height="100%">'+xhtml+'</foreignObject></svg>';
    var img=new Image();
    img.onload=function(){
      var c=document.createElement('canvas');c.width=w*2;c.height=h*2;
      var x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);
      x.drawImage(img,0,0,w*2,h*2);
      var a=document.createElement('a');a.download='dsh-weekly-'+s+'.png';a.href=c.toDataURL('image/png');a.click();
    };
    img.onerror=function(){ alert('图片导出失败（浏览器限制），可改用 PDF 导出') };
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
})();
</script>`,
  })))

  // ---- plugin detail pages (/p/<owner>/<repo>/) —— 完整插件详情页（信件为其中一节） --
  const enrichAll = JSON.parse(read('enrich.json') || '[]')
  const enBy = new Map(enrichAll.map((x) => [x.full_name, x]))
  const plugAll = loadPlugins()
  const plugByP = byFullName(plugAll)
  const llmBy = byFullName(readJsonl(PATHS.llm))
  const deepBy = byFullName(readJsonl(PATHS.deep))
  const dlMap = (JSON.parse(read('downloads.json') || '{}').map) || {}
  const dimLabel = { eng: '工程质量', docs: '文档完整性', discover: '可发现性', maint: '维护活跃' }
  const reportFiles = existsSync(PATHS.reportsDir)
    ? readdirSync(PATHS.reportsDir).filter((f) => f.endsWith('.md')) : []
  let pWrote = 0
  for (const f of reportFiles) {
    const md = read('reports', f)
    if (!md) continue
    const [owner, repo] = f.replace(/\.md$/, '').split('__')
    if (!owner || !repo) continue
    const full = `${owner}/${repo}`
    const r = plugByP.get(full) || {}
    const en = enBy.get(full) || {}
    const llm = llmBy.get(full)
    const deep = deepBy.get(full)
    const dl = r.pkgName ? dlMap[r.pkgName]?.d ?? null : null
    const peers = en.category
      ? enrichAll.filter((x) => x.category === en.category && x.full_name !== full)
          .sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 5) : []
    const dimRows = Object.entries(dimLabel).map(([k, label]) => {
      const v = en.dimScores?.[k]
      return `<div class="dimrow"><span>${label}</span><div class="dimt"><i style="width:${v == null ? 0 : v}%"></i></div><b>${v == null ? '—' : v}</b></div>`
    }).join('')
    const dropsRows = (en.drops || []).map((d) => `<div class="scrow"><a style="cursor:default">${escHtml(d.label)}</a><span class="meta">${d.sev === 'fail' ? 'fail −20' : d.sev === 'major' ? '−10' : d.sev === 'minor' ? '−2' : '−5'}</span></div>`).join('')
    const peersHtml = peers.map((p) => `<div class="scrow"><a href="/p/${escHtml(p.full_name)}/">${escHtml(p.full_name)}</a><span class="meta"><span class="grade ${escHtml(p.grade)}">${escHtml(p.grade)}</span> ${p.score} · ★${p.stars}</span></div>`).join('')
    const title = mdTitle(md, `${owner}/${repo}`)
    const body = `<p class="crumb">插件详情 · ${escHtml(full)}</p>
<div style="display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:6px">
  <img src="https://github.com/${escHtml(owner)}.png?size=80" width="56" height="56" style="border-radius:14px" alt="">
  <div style="flex:1;min-width:260px">
    <h1 class="pagetitle" style="margin-bottom:4px">${escHtml(repo)} <span style="color:var(--faint);font-weight:400;font-size:16px">${escHtml(owner)}</span></h1>
    <p class="lede" style="margin-bottom:10px;max-width:none">${escHtml(r.description || '（无描述）')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${en.grade ? `<span class="grade ${en.grade}" style="font-size:15px;min-width:30px;padding:3px 10px">${en.grade}</span><b class="mono" style="font-size:15px">${en.score ?? '—'}/100</b>` : ''}
      ${en.category ? `<span class="pill">${escHtml(en.category)}</span>` : ''}
      <a class="wkbtn" href="https://github.com/${escHtml(full)}" target="_blank">GitHub ↗</a>
      ${r.npm?.published ? `<a class="wkbtn" href="https://www.npmjs.com/package/${escHtml(r.pkgName)}" target="_blank">npm ${escHtml(r.npm.latest || '')} ↗</a>` : ''}
      <a class="wkbtn" href="https://github.com/${escHtml(owner)}" target="_blank">作者主页 ↗</a>
    </div>
  </div>
</div>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
  <div class="card"><b>★ ${(r.stars || 0).toLocaleString()}</b><p>GitHub stars</p></div>
  <div class="card"><b>${r.forks || 0}</b><p>forks</p></div>
  <div class="card"><b>${escHtml((r.created_at || '').slice(0, 10) || '—')}</b><p>创建于</p></div>
  <div class="card"><b>${escHtml((r.pushed_at || '').slice(0, 10) || '—')}</b><p>最近 push</p></div>
  <div class="card"><b>${dl != null ? dl.toLocaleString() + '/周' : '—'}</b><p>npm 周下载</p></div>
</div>
<div class="sc-cols" style="margin-top:16px">
  <div class="card" style="margin:0"><b>评分维度（六维框架）</b>${dimRows}<p style="font-size:11px;color:var(--faint);margin-top:10px">安全卫生（深检抽样）与采用度只展示不进分；兼容性随 rc 雷达上线。口径见 <a href="/about/">关于·指标体系</a>。</p></div>
  <div class="card" style="margin:0"><b>扣分明细（health-v4）</b>${dropsRows || '<p style="color:var(--ok);font-size:13px;margin-top:8px">无扣分项 ✓</p>'}${(en.missing || []).length ? `<p style="font-size:11px;color:var(--faint);margin-top:8px">未探测（不扣分）：${escHtml(en.missing.join('、'))}</p>` : ''}</div>
</div>
<div class="sc-cols" style="margin-top:14px">
  <div class="card" style="margin:0"><b>收录 / 发布</b>
    <p style="font-size:13px;margin-top:8px">${en.inAwesome ? '✅ awesome-dsh-plugin' : '— awesome 未收录'} · ${en.inImsai ? '✅ imsai' : '— imsai 未收录'}</p>
    <p style="font-size:13px;color:var(--mut)">${r.npm?.published ? `npm <b>${escHtml(r.pkgName)}@${escHtml(r.npm.latest || '')}</b>（${r.npm.versions ?? '?'} 个版本 · 最近发布 ${escHtml((r.npm.latestTime || '').slice(0, 10))}）` : '未发布 npm（仅仓库安装）'}</p>
    ${(r.npm?.published && r.version && r.npm.latest !== r.version) ? `<p style="font-size:12.5px;color:var(--warn)">⚠ 版本滞后：仓库 ${escHtml(r.version)} vs npm ${escHtml(r.npm.latest)}</p>` : ''}
    <p style="font-size:12.5px;margin-top:10px"><b>徽章接入</b>：<code style="font-size:11.5px">https://dsh-insights.com/badge/${escHtml(full)}.svg</code> · <a href="/badge/">接入指南 ↗</a></p>
  </div>
  <div class="card" style="margin:0"><b>LLM 解读</b>${llm ? `<p style="font-size:13px;margin-top:8px">${escHtml(llm.summaryZh || llm.summaryEn || '—')}</p>${(llm.capabilityTags || []).length ? `<p style="margin-top:8px">${llm.capabilityTags.map((t) => `<span class="pill">${escHtml(t)}</span>`).join('')}</p>` : ''}${(llm.claims || []).length ? `<p style="font-size:12px;color:var(--mut);margin-top:8px">README 宣称：${escHtml(llm.claims.slice(0, 4).join('；'))}</p>` : ''}` : '<p style="color:var(--faint);font-size:13px;margin-top:8px">未标注 · 待 LLM 标注轮</p>'}${deep ? `<p style="font-size:12.5px;margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><b>深检（写面/消毒，非审计）</b>：${escHtml(deep.verdict)} · 写面 ${deep.writeCount} 处 · ${deep.sanitized ? '有消毒器' : '无消毒器'}</p>` : ''}</div>
</div>
${peersHtml ? `<h2 style="font-size:16px;margin:26px 0 8px">同类插件（${escHtml(en.category)}）</h2><div class="card">${peersHtml}</div>` : ''}
<h2 style="font-size:16px;margin:26px 0 8px">致作者的信</h2>
<div class="article">${mdToHtml(md)}</div>`
    const html = page({
      title: `${repo} · 插件详情 · DSH Insights`, desc: `${full} 的健康分、维度画像、扣分明细与改进建议（DSH Insights 自动生成）`,
      base: '../../../', here: 'plugins/', body, og: { type: 'article', title: `${full} · ${en.grade || ''} ${en.score ?? ''}/100 · DSH Insights` },
    })
    // diff 驱动：内容不变不重写（全量 4k+ 页避免每日 churn）
    const fp = join(SITE, 'p', owner, repo, 'index.html')
    if (existsSync(fp) && readFileSync(fp, 'utf8') === html) continue
    written.push(out(`p/${owner}/${repo}/index.html`, html))
    pWrote++
  }
  if (reportFiles.length) console.log(`[pages] /p/ ${pWrote} changed / ${reportFiles.length} letter pages`)

  // ---- /data/ open-data index (+ copy public datasets) -------------------
  const DATASETS = [
    ['insights.json', '全量洞察快照（agent 首选入口）'],
    ['plugins.jsonl', '权威集全量（一行一插件）'],
    ['invalid.jsonl', '噪声分桶（被拒候选 + reason）'],
    ['enrich.json', '每插件评分 / 等级 / 分类 / 收录渠道'],
    ['analysis.json', '聚合统计（仪表盘数据源）'],
    ['health.json', '健康分聚合（分级分布/均分/top 扣分）'],
    ['dynamics.json', '官方动态快照（dsh releases/dist-tags/DeepSeek 平台）'],
    ['plugins.csv', '权威集表格（25 列，Excel 友好）'],
    ['downloads.json', 'npm 周下载（CI 更新）'],
    ['listed.json', '收录渠道清单（awesome / imsai）'],
    ['metrics.jsonl', '产品发展指标自测量（周度追加）'],
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
  out('data/insights.schema.json', JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://dsh-insights.com/data/insights.schema.json',
    title: 'DSH Insights 全量洞察快照（insights.json）',
    type: 'object',
    required: ['$schema', 'generatedAt', 'ruleVersion', 'meta', 'plugins'],
    properties: {
      $schema: { type: 'string' },
      generatedAt: { type: 'string', format: 'date-time' },
      ruleVersion: { type: 'string', examples: ['health-v4'] },
      meta: { type: 'object' },
      plugins: {
        type: 'array',
        items: {
          type: 'object',
          required: ['full_name', 'url', 'health'],
          properties: {
            full_name: { type: 'string', description: 'owner/repo（join key）' },
            url: { type: 'string' },
            stars: { type: 'integer' },
            license: { type: ['string', 'null'] },
            topics: { type: 'array', items: { type: 'string' } },
            pkgName: { type: ['string', 'null'] },
            version: { type: ['string', 'null'] },
            npm: { type: 'object', properties: { published: { type: 'boolean' }, latest: { type: ['string', 'null'] } } },
            description: { type: 'string' },
            health: {
              type: 'object',
              required: ['score', 'grade'],
              properties: {
                score: { type: 'integer', minimum: 0, maximum: 100 },
                grade: { type: 'string', enum: ['S', 'A', 'B', 'C', 'D'], description: 'S≥95 A≥90 B≥75 C≥60 D<60' },
                dimScores: { type: 'object', properties: { eng: { type: 'integer' }, docs: { type: 'integer' }, discover: { type: 'integer' }, maint: { type: 'integer' } } },
                drops: { type: 'array', items: { type: 'string' }, description: '扣分规则 code，口径见 docs/SCHEMA.md §health' },
              },
            },
          },
        },
      },
    },
  }, null, 2) + '\n')
  written.push(out('data/index.html', page({
    title: '开放数据', desc: 'DSH Insights 开放数据集：稳定 URL、可复核口径、CC BY 4.0。',
    base: '../', here: 'data/',
    body: `<p class="crumb">Open Data</p><h1 class="pagetitle">开放数据</h1>
<p class="lede">全量、可复核、持续更新。URL 稳定（公布即不变更），agent 可直接抓取，无需登录。使用请注明出处（CC BY 4.0）。</p>
<div class="cards">${cards.join('')}</div>
<h2 style="font-size:16px;margin:28px 0 8px">许可与口径</h2>
<p class="lede">代码 <b>MIT</b> · 数据 <b>CC BY 4.0</b>（署名：dsh-insights.com，全文见 <a href="https://github.com/ice5kysl/dsh-insights/blob/main/DATA-LICENSE" target="_blank">DATA-LICENSE</a>）。「权威集」= 非 fork/归档 + package.json 声明 dsh.bundle.patch 且 patch 已提交（下限口径）。健康分为启发式评估，<b>非安全审计</b>。</p>
<h2 style="font-size:16px;margin:28px 0 8px">调用示例</h2>
<pre style="background:var(--track);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;overflow:auto"><code>curl ${ORIGIN}/data/insights.json
curl ${ORIGIN}/feed.xml          # 周报 RSS</code></pre>`,
  })))

  // ---- /scenarios/ 场景组合推荐 -------------------------------------------
  const scenarios = (JSON.parse(read('scenarios.json') || '{"scenarios":[]}')).scenarios || []
  const plugBy = byFullName(loadPlugins())
  const scRow = (p, extra) => `<div class="scrow"><a href="${escHtml(p.url)}" target="_blank" title="${escHtml(p.full_name)}">${escHtml(p.full_name)}</a><span class="meta"><span class="grade ${escHtml(p.grade)}">${escHtml(p.grade)}</span> ${p.score} · ★${p.stars}${p.npm ? ' · npm ' + escHtml(p.npm) : ''}${p.active ? ' · 活跃' : ''}${extra || ''}</span></div>`
  const scCards = scenarios.filter((s) => (s.plugins || []).length).map((s) => {
    const withAge = s.plugins.map((p) => ({ ...p, created: (plugBy.get(p.full_name)?.created_at || '').slice(0, 10) }))
    const best = withAge.slice(0, 5)
    const fresh = [...withAge].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 5)
    const reasons = [...new Set(s.plugins.flatMap((p) => p.reasons || []))].slice(0, 3).join('；')
    return `<section class="scsec" id="sc-${escHtml(s.id)}">
<h2 style="font-size:16px;margin:0 0 4px">${escHtml(s.zh)} <span style="color:var(--faint);font-weight:400;font-size:12px">${escHtml(s.en)}</span></h2>
<p style="color:var(--faint);font-size:12px;margin:0 0 12px">${s.candidates} 个候选 · 按健康分/npm/活跃排序${reasons ? ' · ' + escHtml(reasons) : ''}</p>
<div class="sc-cols">
<div class="card" style="margin:0"><b>质量首选</b>${best.map((p) => scRow(p)).join('')}</div>
<div class="card" style="margin:0"><b>新入场</b>${fresh.map((p) => scRow(p, ' · 创于 ' + escHtml(p.created || '—'))).join('') || '<p style="color:var(--faint);font-size:12px">暂无</p>'}</div>
</div>
</section>`
  }).join('\n')
  written.push(out('scenarios/index.html', page({
    title: '场景组合推荐', desc: '按使用场景挑选 dsh 插件组合：客观信号排序、每场景给备选、理由可展开。',
    base: '../', here: 'scenarios/',
    body: `<p class="crumb">Scenarios</p><h1 class="pagetitle">场景组合推荐</h1>
<p class="lede">从「我要做什么」出发，而不是从「哪个星多」出发。每个场景给出健康分最高、npm 已发布、近期活跃的一组候选与备选——<b>客观信号排序，不接"最佳"叙事，不做付费置顶</b>。覆盖 ${scenarios.reduce((n, s) => n + (s.plugins || []).length, 0)} 个推荐位，随每日快照刷新。</p>
<div>${scCards || '<div class="card"><b>数据积累中</b><p>场景数据随 LLM 标注覆盖逐步补齐。</p></div>'}</div>
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
    const relRows = (dsh.releases || []).map((r) => `<div style="padding:10px 2px;border-bottom:1px solid var(--line)">
<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px"><a href="https://github.com/${escHtml(dsh.repo)}/releases/tag/${escHtml(r.tag)}" target="_blank" style="font-weight:600;color:var(--ink)">${escHtml(r.tag)}</a>${r.breaking ? ' <span class="pill" style="color:var(--warn);border-color:var(--warn)">breaking?</span>' : ''}<span style="color:var(--faint);font:12px var(--mono);white-space:nowrap;flex:none">${r.prerelease ? 'pre-release' : 'release'} · ${escHtml((r.published_at || '').slice(0, 10))}${(r.added || r.fixed) ? ` · ${r.added} 新增/${r.fixed} 修复` : ''}</span></div>
${r.summary ? `<div style="color:var(--mut);font-size:12.5px;margin-top:4px">${escHtml(r.summary)}</div>` : ''}
</div>`).join('')
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

  // ---- /authors/ 作者榜 ----------------------------------------------------
  const an = JSON.parse(read('analysis.json') || '{}')
  const authors = an.authors || []
  const ast = an.authorStats || {}
  const byStars = [...authors].sort((x, y) => y.stars - x.stars).slice(0, 10)
  const byRiser = [...authors].filter((a) => a.delta > 0).sort((x, y) => y.delta - x.delta).slice(0, 10)
  const byNew = [...authors].sort((x, y) => (y.firstCreated || '').localeCompare(x.firstCreated || '')).slice(0, 10)
  const byProlific = [...authors].sort((x, y) => y.plugins - x.plugins).slice(0, 10)
  const miniList = (rows, val) => rows.length
    ? rows.map((a, i) => `<div class="listrow"><a href="https://github.com/${escHtml(a.owner)}" target="_blank" title="${escHtml(a.owner)}"><span style="color:var(--faint);font-family:var(--mono);font-size:11px;margin-right:4px">${i + 1}</span><img src="https://github.com/${escHtml(a.owner)}.png?size=40" width="18" height="18" loading="lazy" alt="" style="border-radius:50%;vertical-align:-3px;margin-right:6px">${escHtml(a.owner)}</a><span class="meta">${val(a)}</span></div>`).join('')
    : '<p class="lede" style="margin:8px 0">数据积累中（较上一快照暂无变化）</p>'
  const boardCards = [
    ['★ 最多 star 榜', '作者全部插件 ★ 合计', miniList(byStars, (a) => `★${a.stars.toLocaleString()}`)],
    ['多产榜', '权威集插件数', miniList(byProlific, (a) => `${a.plugins} 个 · A/B ${a.ab}`)],
    ['最新飙升榜', '较上一快照 ★ 增量（日更）', miniList(byRiser, (a) => `+${a.delta}`)],
    ['最新榜', '首次出现插件的时间', miniList(byNew, (a) => escHtml(a.firstCreated || '—'))],
  ].map(([t, sub, html]) => `<div class="card"><b>${t}</b><p>${sub}</p>${html}</div>`).join('\n')

  // 作者协作关系图（Top 200 ★ 插件 contributors 采样）
  const graph = JSON.parse(read('authors-graph.json') || 'null')
  const graphSec = graph && graph.nodes?.length ? `
<h2 style="font-size:16px;margin:28px 0 8px">协作关系图 · 关键节点人物</h2>
<p class="lede">同一插件的贡献者之间连边（采样：★ Top ${graph.sampledPlugins} 权威插件，${graph.nodes.length} 人 · ${graph.links.length} 条边）。节点大小 = 关联插件数与 ★ 量级，边粗细 = 共享插件数与流行度——<b>居中的大节点就是生态的关键节点人物</b>。悬停看详情，点击访问主页。采集于 ${escHtml((graph.fetchedAt || '').slice(0, 10))}。</p>
<div class="card" style="padding:8px"><div id="gwrap" style="position:relative"><svg id="gnet" viewBox="0 0 920 540" style="width:100%;height:auto;display:block"></svg><div id="gtip2" style="position:absolute;pointer-events:none;background:var(--ink);color:var(--bg);font:11.5px var(--mono);padding:6px 10px;border-radius:7px;display:none;max-width:260px;z-index:5"></div></div></div>
<script>
(function(){
  var G=${JSON.stringify({ nodes: graph.nodes.slice(0, 60), links: graph.links }).replace(/</g, '\\u003c')};
  var keep=new Set(G.nodes.map(function(n){return n.id}));
  var links=G.links.filter(function(l){return keep.has(l.source)&&keep.has(l.target)&&l.weight>=1.5}).slice(0,160);
  var nodes=G.nodes.map(function(n,i){ var a=i/G.nodes.length*2*Math.PI;
    return {id:n.id,plugins:n.plugins,stars:n.stars,repos:n.repos,
      x:460+200*Math.cos(a),y:270+170*Math.sin(a),vx:0,vy:0,
      r:4+Math.sqrt(n.plugins)*2.2+Math.log10(n.stars+1)*1.6} });
  var idx={}; nodes.forEach(function(n,i){idx[n.id]=i});
  var E=links.map(function(l){return {s:idx[l.source],t:idx[l.target],w:l.weight,repos:l.repos}}).filter(function(l){return l.s!=null&&l.t!=null});
  var W=920,H=540;
  for(var it=0;it<300;it++){
    for(var i=0;i<nodes.length;i++){var a=nodes[i];
      for(var j=i+1;j<nodes.length;j++){var b=nodes[j];
        var dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+0.01,d=Math.sqrt(d2);
        var f=Math.min(60,1400/d2);
        a.vx+=dx/d*f*0.5;a.vy+=dy/d*f*0.5;b.vx-=dx/d*f*0.5;b.vy-=dy/d*f*0.5 }}
    E.forEach(function(e){var a=nodes[e.s],b=nodes[e.t];
      var dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy+0.01);
      var f=(d-70-e.w*4)*0.02*Math.min(3,e.w);
      a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f });
    nodes.forEach(function(n){n.vx+=(W/2-n.x)*0.002;n.vy+=(H/2-n.y)*0.002;
      n.vx*=0.82;n.vy*=0.82;n.x+=n.vx;n.y+=n.vy;
      n.x=Math.max(20,Math.min(W-20,n.x));n.y=Math.max(20,Math.min(H-20,n.y)) });
  }
  var svg=document.getElementById('gnet'),tip=document.getElementById('gtip2'),ns='http://www.w3.org/2000/svg';
  var deg={}; E.forEach(function(e){deg[e.s]=(deg[e.s]||0)+1;deg[e.t]=(deg[e.t]||0)+1});
  var adj={}; E.forEach(function(e){(adj[e.s]=adj[e.s]||[]).push(e.t);(adj[e.t]=adj[e.t]||[]).push(e.s)});
  var eEls=E.map(function(e){var l=document.createElementNS(ns,'line');
    l.setAttribute('x1',nodes[e.s].x);l.setAttribute('y1',nodes[e.s].y);
    l.setAttribute('x2',nodes[e.t].x);l.setAttribute('y2',nodes[e.t].y);
    l.setAttribute('stroke','var(--faint)');l.setAttribute('stroke-opacity','0.35');
    l.setAttribute('stroke-width',Math.max(0.6,Math.min(4,e.w/2)));
    svg.appendChild(l);return l});
  // 核心节点：协作度 ≥3 的枢纽（半径 ×1.4 + 描边环 + 加粗标签）
  var core={}; Object.keys(deg).forEach(function(k){ if(deg[k]>=3)core[k]=1 });
  nodes.forEach(function(n,i){ n.core=core[i]?1:0; n.r=n.r*(n.core?1.4:0.85) });
  var defs=document.createElementNS(ns,'defs'); svg.appendChild(defs);
  var nEls=nodes.map(function(n,i){
    var g=document.createElementNS(ns,'g'); g.style.cursor='pointer';
    var clip=document.createElementNS(ns,'clipPath'); clip.setAttribute('id','gcp'+i);
    var cc=document.createElementNS(ns,'circle'); cc.setAttribute('cx',n.x);cc.setAttribute('cy',n.y);cc.setAttribute('r',n.r);
    clip.appendChild(cc); defs.appendChild(clip);
    var bg=document.createElementNS(ns,'circle');
    bg.setAttribute('cx',n.x);bg.setAttribute('cy',n.y);bg.setAttribute('r',n.r);
    bg.setAttribute('fill',n.core?'var(--accent)':'var(--faint)');bg.setAttribute('fill-opacity',n.core?'0.9':'0.7');
    g.appendChild(bg);
    var img=document.createElementNS(ns,'image');
    img.setAttribute('href','https://github.com/'+n.id+'.png?size=64');
    img.setAttribute('x',n.x-n.r);img.setAttribute('y',n.y-n.r);
    img.setAttribute('width',n.r*2);img.setAttribute('height',n.r*2);
    img.setAttribute('clip-path','url(#gcp'+i+')');img.setAttribute('preserveAspectRatio','xMidYMid slice');
    g.appendChild(img);
    if(n.core){ var ring=document.createElementNS(ns,'circle');
      ring.setAttribute('cx',n.x);ring.setAttribute('cy',n.y);ring.setAttribute('r',n.r+2.5);
      ring.setAttribute('fill','none');ring.setAttribute('stroke','var(--accent)');ring.setAttribute('stroke-width','2');
      g.appendChild(ring) }
    var t=document.createElementNS(ns,'text');
    t.setAttribute('x',n.x);t.setAttribute('y',n.y+n.r+11);
    t.setAttribute('text-anchor','middle');
    t.setAttribute('style','font:'+(n.core?'600 10.5px':'10px')+' var(--mono);fill:'+(n.core?'var(--ink)':'var(--mut)'));
    t.textContent=n.id.length>14?n.id.slice(0,13)+'…':n.id;
    g.appendChild(t);
    g.addEventListener('mouseenter',function(ev){focus(i,true,ev)});
    g.addEventListener('mouseleave',function(){focus(i,false)});
    g.addEventListener('click',function(){window.open('https://github.com/'+n.id,'_blank')});
    svg.appendChild(g);return {g:g,t:t,core:n.core}});
  function focus(i,on,ev){var nbr={};nbr[i]=1;(adj[i]||[]).forEach(function(j){nbr[j]=1});
    nEls.forEach(function(el,j){el.g.setAttribute('opacity',on?(nbr[j]?1:0.15):1);
      el.t.setAttribute('style','font:'+(el.core?'600 10.5px':'10px')+' var(--mono);fill:'+(on&&!nbr[j]?'var(--faint)':(el.core?'var(--ink)':'var(--mut)'))+';fill-opacity:'+(on&&!nbr[j]?'0.25':'1'))});
    eEls.forEach(function(l,k){var e=E[k];var hot=(e.s===i||e.t===i);
      l.setAttribute('stroke',hot?'var(--accent)':'var(--faint)');
      l.setAttribute('stroke-opacity',on?(hot?0.9:0.06):0.35)});
    if(on){var n=nodes[i];var co=(adj[i]||[]).slice(0,6).map(function(j){return nodes[j].id}).join('、');
      tip.innerHTML='<b>'+n.id+'</b> · 插件 '+n.plugins+' · ★'+n.stars.toLocaleString()+(co?'<br>协作：'+co:'');
      tip.style.display='block';
      tip.style.left=Math.min(W-270,Math.max(4,(n.x/W)*document.getElementById('gwrap').clientWidth+14))+'px';
      tip.style.top=Math.max(4,(n.y/H)*document.getElementById('gwrap').clientWidth*540/920-10)+'px'}
    else tip.style.display='none'}
})();
</script>` : ''
  const authorRows = authors.map((a, i) => `<tr>
<td class="num">${i + 1}</td>
<td><a href="https://github.com/${escHtml(a.owner)}" target="_blank"><img src="https://github.com/${escHtml(a.owner)}.png?size=40" width="20" height="20" loading="lazy" alt="" style="border-radius:50%;vertical-align:-4px;margin-right:7px">${escHtml(a.owner)}</a></td>
<td class="num" data-v="${a.plugins}">${a.plugins}</td>
<td class="num" data-v="${a.ab}">${a.ab}</td>
<td class="num" data-v="${a.avg}">${a.avg}</td>
<td class="num" data-v="${a.stars}">★${a.stars.toLocaleString()}</td>
<td class="num" data-v="${a.npm}">${a.npm}</td>
<td class="num" data-v="${a.covered}">${a.covered}</td>
<td class="num" data-v="${a.lastPush || ''}">${escHtml(a.lastPush || '—')}</td>
<td>${a.topPlugin ? `<a href="https://github.com/${escHtml(a.topPlugin)}" target="_blank" title="${escHtml(a.topPlugin)}">${escHtml(a.topPlugin.split('/')[1])}</a>` : '—'}</td>
<td>${escHtml(a.topCat || '—')}</td>
</tr>`).join('\n')
  written.push(out('authors/index.html', page({
    title: '作者榜', desc: 'DSH 插件生态的作者与组织：榜单、协作关系图与全量作者库。',
    base: '../', here: 'authors/',
    body: `<p class="crumb">Authors</p><h1 class="pagetitle">作者 · 生态里的重要人物</h1>
<p class="lede">${ast.total ?? '—'} 位作者/组织构成这个生态：${ast.multi ?? '—'} 位多产（≥2 个插件），Top 10 作者产出占权威集 ${ast.top10Share ?? '—'}%。榜单按客观信号排序（★ 只作展示，不进质量分）。</p>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${boardCards}</div>
${graphSec}
<h2 style="font-size:16px;margin:28px 0 8px">作者库（全量 ${authors.length}）</h2>
<table class="ptable" id="atable" style="width:100%;margin-top:8px">
<thead><tr><th class="num">#</th><th>作者</th><th class="num" data-k="num">插件</th><th class="num" data-k="num">A/B</th><th class="num" data-k="num">均分</th><th class="num" data-k="num">★合计</th><th class="num" data-k="num">npm</th><th class="num" data-k="num">收录</th><th class="num" data-k="str">最近活跃</th><th>代表插件</th><th>主分类</th></tr></thead>
<tbody>${authorRows}</tbody></table>
<p class="lede" style="margin-top:14px">口径：作者 = 仓库 owner（个人或组织）；收录 = 进 awesome/imsai 渠道数；均分 = 其全部插件健康分均值。点表头排序。数据随每日快照刷新。</p>
<style>
.ptable{border-collapse:collapse;font-size:12.5px}
.ptable th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);cursor:pointer;user-select:none;white-space:nowrap}
.ptable td{padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.ptable td.num,.ptable th.num{text-align:right}
.ptable tbody tr:hover{background:var(--track)}
.ptable td:nth-child(10){max-width:180px;overflow:hidden;text-overflow:ellipsis}
</style>
<script>
(function(){
  var tb=document.getElementById('atable'); if(!tb)return;
  var ths=tb.querySelectorAll('th'), tbody=tb.querySelector('tbody'), desc=true, col=-1;
  ths.forEach(function(th,i){ th.addEventListener('click',function(){
    var numeric=i>=2&&i<=8; desc=(col===i)?!desc:true; col=i;
    var rows=[].slice.call(tbody.querySelectorAll('tr'));
    rows.sort(function(a,b){ var x=a.children[i],y=b.children[i];
      if(numeric){ var vx=parseFloat((x.getAttribute('data-v')||x.textContent).replace(/[^0-9.\\-]/g,''))||0, vy=parseFloat((y.getAttribute('data-v')||y.textContent).replace(/[^0-9.\\-]/g,''))||0; return desc?vy-vx:vx-vy }
      var sx=x.textContent,sy=y.textContent; return desc?sx.localeCompare(sy):sy.localeCompare(sx) });
    rows.forEach(function(r){ tbody.appendChild(r) });
    tbody.querySelectorAll('tr').forEach(function(r,j){ r.children[0].textContent=j+1 });
  }) });
})();
</script>`,
  })))

  // ---- /badge/ 健康徽章 ---------------------------------------------------
  const enrichForBadge = JSON.parse(read('enrich.json') || '[]')
  const badgeEx = ['omdsh-dev/DSH-better-sidebar', 'zhu1090093659/dsh-web', 'ConsoleSun/Gemini-Eyes']
    .map((f) => {
      const e = enrichForBadge.find((x) => x.full_name === f)
      return e ? [f, `${e.grade} · ${e.score}/100`] : null
    }).filter(Boolean)
  const badgeExHtml = badgeEx.map(([f, note]) => `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--line)"><img src="../badge/${f}.svg" alt="${f} badge" style="height:22px"><span style="font-size:12px;color:var(--mut)"><a href="https://github.com/${f}" target="_blank">${f}</a> · ${note}</span></div>`).join('')
  written.push(out('badge/index.html', page({
    title: '健康徽章', desc: '把 DSH Insights 客观健康分带进你的 README：徽章的价值、解读与接入方法。',
    base: '../', here: 'badge/',
    body: `<p class="crumb">Badge</p><h1 class="pagetitle">健康徽章 · 把分数带进 README</h1>
<p class="lede">一枚 SVG 徽章 = 你插件的客观健康分，随每日快照自动刷新。对作者是信任信号与修复指引，对生态是分数走出本站的最小分发单元。</p>

<h2 style="font-size:16px;margin:28px 0 8px">长什么样（真实样例，实时渲染）</h2>
${badgeExHtml}

<h2 style="font-size:16px;margin:28px 0 8px">如何解读</h2>
<p class="lede">徽章显示「等级 · 分数」：100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 <span class="grade S">S ≥ 95</span> <span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>。评的是六维框架中的计分四维（工程质量 / 文档完整性 / 可发现性 / 维护活跃），每条扣分都带证据、可在插件页和仪表盘抽屉里逐项核查——<b>分数的意义不在于高低，在于可复核</b>。框架全文见 <a href="../about/">关于 · 指标体系</a>。</p>

<h2 style="font-size:16px;margin:28px 0 8px">为什么值得挂</h2>
<p class="lede">对作者：潜在用户装前 10 秒的信任凭证；分数提升是看得见的修复回报；徽章链回插件页，带来反链与同类定位。对生态：目录与市场装不下所有插件，但每个 README 都可以挂分数——徽章是让「信得过」在生态里自传播的钩子。我们不做排名、不做安全审计，只提供客观信号。</p>

<h2 style="font-size:16px;margin:28px 0 8px">接入（输入你的仓库，自动生成）</h2>
<div class="card" style="max-width:720px">
  <b>你的插件仓库</b>
  <p><input id="brepo" placeholder="owner/repo，如 ice5kysl/dsh-workspace-kit" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:13px var(--mono);background:var(--bg);color:var(--ink)"></p>
  <div id="bprev" style="margin:10px 0;min-height:26px"><span style="color:var(--faint);font-size:12.5px">输入后预览徽章</span></div>
  <b style="font-size:12.5px">写法一 · 徽章 + 链接插件页（推荐）</b>
  <pre style="margin:8px 0"><code id="bcode1">[![DSH Insights health](https://dsh-insights.com/badge/owner/repo.svg)](https://dsh-insights.com/p/owner/repo/)</code></pre>
  <b style="font-size:12.5px">写法二 · 纯徽章</b>
  <pre style="margin:8px 0"><code id="bcode2">![DSH Insights health](https://dsh-insights.com/badge/owner/repo.svg)</code></pre>
  <p style="margin-top:8px"><button id="bcopy" style="padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:var(--track);color:var(--ink);font-size:12.5px;cursor:pointer">复制写法一</button> <span id="bcopied" style="font-size:12px;color:var(--ok)"></span></p>
</div>

<h2 style="font-size:16px;margin:28px 0 8px">说明与边界</h2>
<p class="lede">徽章内容随每日快照自动更新（GitHub 图片缓存最长一天）；分数掉档不需要你改任何代码。启发式评估 ≠ 安全审计；徽章 404 = 仓库不在当前权威集（可能是门禁未过或校验未覆盖，可到 <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">仓库</a> 提 issue 查询/申诉）。想先本地自查，可用我们的体检工具：<code>npx --yes github:ice5kysl/dsh-plugin-health &lt;owner/repo&gt;</code>。</p>
<script>
(function(){
  var inp=document.getElementById('brepo'),prev=document.getElementById('bprev'),
      c1=document.getElementById('bcode1'),c2=document.getElementById('bcode2'),
      btn=document.getElementById('bcopy'),ok=document.getElementById('bcopied');
  function norm(v){ v=(v||'').trim().replace(/^https?:\\/\\/github\\.com\\//,'').replace(/\\/+$/,''); return /^[\\w.-]+\\/[\\w.-]+$/.test(v)?v:null }
  function upd(){ var r=norm(inp.value);
    if(!r){ prev.innerHTML='<span style="color:var(--faint);font-size:12.5px">输入后预览徽章</span>'; return }
    prev.textContent='';
    var img=document.createElement('img');
    img.src='../badge/'+r+'.svg'; img.style.height='22px'; img.alt=r+' badge';
    img.onerror=function(){ prev.innerHTML='<span style="font-size:12px;color:var(--warn)">该仓库暂未收录权威集（徽章 404）——可能门禁未过或校验未覆盖</span>' };
    prev.appendChild(img);
    c1.textContent='[![DSH Insights health](https://dsh-insights.com/badge/'+r+'.svg)](https://dsh-insights.com/p/'+r+'/)'
    c2.textContent='![DSH Insights health](https://dsh-insights.com/badge/'+r+'.svg)' }
  inp.addEventListener('input',upd);
  btn.addEventListener('click',function(){
    (navigator.clipboard?navigator.clipboard.writeText(c1.textContent):Promise.reject()).then(function(){ ok.textContent='已复制 ✓' }).catch(function(){ ok.textContent='请手动复制' });
    setTimeout(function(){ ok.textContent='' },2000) });
})();
</script>`,
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
<p>每个插件从六个维度考察：<b>计分四维</b>进入总分（100 起扣 · fail −20 / 较重 −10 / 中 −5 / 轻 −2，health-v3 区分度重构），<b>展示两维</b>只呈现不进分，<b>兼容性</b>为预留维度。阈值：<span class="grade S">S ≥ 95</span> <span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>；插件详情抽屉可见各维度子分（dimScores）。</p>
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
<h2>站点统计（隐私披露）</h2>
<p>本站使用 <a href="https://umami.is" target="_blank">Umami</a>（开源、无 cookie、不收集个人信息）统计页面访问与来源，用于衡量产品发展（指标体系 E 组）；同时每周将覆盖/内容/触达指标记入 <code>data/metrics.jsonl</code> 公开于仓库。不使用任何其他跟踪。</p>
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
    <description>${escHtml(w.title)}（DSH Insights 自动生成，数据可复核）</description>
  </item>`).join('\n')
  written.push(out('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>DSH Insights · DSH 生态周报</title>
  <link>${ORIGIN}/weekly/</link>
  <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>DeepSeek Harness 插件生态周报：每周五 CI 自动生成（历史期含回填特刊），数据可复核。</description>
  <language>zh-CN</language>
${items}
</channel>
</rss>
`))

  // llms.txt：单一来源为仓库根 llms.txt（pages.yml 部署时拷入 public/），此处不再生成（P2-1）

  console.log(`[pages] ${written.length} 个产物：`)
  for (const w of written) console.log('  -', w)
}

main()
