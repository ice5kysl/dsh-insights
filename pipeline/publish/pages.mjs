#!/usr/bin/env node
/**
 * pipeline/publish · pages — multi-page static site generator (the "pages" layer on top of
 * the single-page dashboard from stage 4).
 *
 * Generates:
 *   site/weekly/<slug>.html + weekly/index.html   from data/weekly/*.md
 *   site/insights/<slug>.html + insights/index.html  from data/insight-reports/*.md（中英双语成对块）
 *   site/p/<owner>/<repo>/index.html              full authoritative set (plugins.jsonl ⨝ enrich.json)
 *   site/dynamics/index.html                       official dynamics (L2)
 *   site/scenarios/index.html                      scenario bundle recommendations
 *   site/about/index.html                          about / methodology / metrics
 *   site/data/index.html                           open-data index (+ copies data files)
 *   site/feed.xml                                  RSS for the weekly
 *   site/llms.txt                                  agent navigation
 *
 * 「致作者的信」为外发邮件/PR 物料（data/reports/，letters.mjs 生成），不上 /p/ 页。
 *
 * Zero-dependency; page chrome and Markdown rendering live in lib/page.mjs.
 * Run: node pipeline/publish/pages.mjs   (after analyze/site/report/weekly stages)
 *
 * @module dsh-insights/stage-20
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { page, mdToHtml, mdTitle, escHtml, icon, stripEmoji } from '../../lib/page.mjs'
import { t, ph, langBlock } from '../../lib/i18n.mjs'
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
    const body = `<p class="crumb">${t('生态周报', 'Weekly')} · ${slug}</p>
<div class="article">${mdToHtml(md)}</div>`
    written.push(out(`weekly/${slug}.html`, page({
      og: { type: 'article', url: `${ORIGIN}/weekly/${slug}.html` },
      title, titleEn: `DSH Plugin Ecosystem Weekly · ${slug}`, desc: 'DSH 插件生态周报（自动生成 · 数据可复核）',
      base: '../', here: 'weekly/', body, og: { type: 'article' },
    })))
    weekly.push({ slug, title, date, html: mdToHtml(md), md })
  }
  const weeklyIssues = weekly.map((w) => ({ slug: w.slug, title: w.title, html: w.html, md: w.md }))
  written.push(out('weekly/index.html', page({
    title: '生态周报', titleEn: 'Weekly', desc: 'DSH 插件生态周报存档：双栏阅读器，支持导出 Markdown / PDF / PNG。',
    base: '../', here: 'weekly/',
    body: `<p class="crumb">Weekly</p><h1 class="pagetitle">${t('生态周报', 'Ecosystem Weekly')}</h1>
<p class="lede">${t('每周五自动生成 · 数据快照驱动 · 面向社区与 dsh 官方。订阅：', 'Generated every Friday · driven by data snapshots · for the community and the dsh team. Subscribe: ')}<a href="../feed.xml">RSS</a> ${t('或 watch', 'or watch')} <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">${t('GitHub 仓库', 'the GitHub repo')}</a>${t('。点左侧期次直接阅读，可导出 Markdown / PDF / PNG。', '. Pick an issue on the left to read; export as Markdown / PDF / PNG.')}</p>
${langBlock('', '<p class="lede" style="margin-bottom:14px">Weekly reports are published in Chinese; an English edition is planned.</p>')}
<div class="wk">
  <aside class="wk-side" id="wk-side"></aside>
  <div class="wk-main">
    <div class="wk-bar">
      <span id="wk-cur" class="wk-cur"></span>
      <span class="wk-actions">
        <button class="wkbtn" id="wk-md">⬇ Markdown</button>
        <button class="wkbtn" id="wk-pdf">⬇ PDF</button>
        <button class="wkbtn" id="wk-png">${t('⬇ 图片', '⬇ PNG')}</button>
        <a class="wkbtn" id="wk-link" href="#" target="_blank">${t('永久链接 ↗', 'Permalink ↗')}</a>
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
  var __t=window.__t||function(zh,en){return document.documentElement.dataset.lang==='en'?en:zh};
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
    img.onerror=function(){ alert(__t('图片导出失败（浏览器限制），可改用 PDF 导出','PNG export failed (browser limitation) — use PDF export instead')) };
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
})();
</script>`,
  })))

  // ---- insights pages（LLM 阶段性生态洞察，中英双语成对块） ----------------
  const insightDir = join(DATA, 'insight-reports')
  const insightFiles = existsSync(insightDir) ? readdirSync(insightDir).filter((f) => /^\d{4}-W\d{2}\.md$/.test(f)).sort().reverse() : []
  const insights = []
  for (const f of insightFiles) {
    const slug = f.replace(/\.md$/, '')
    const mdZh = read('insight-reports', f)
    const mdEn = read('insight-reports', `${slug}.en.md`)
    if (!mdZh) continue
    const meta = JSON.parse(read('insight-reports', `${slug}.json`) || '{}')
    const title = mdTitle(mdZh, `DSH 生态洞察 · ${slug}`)
    const titleEn = meta.title?.en || `DSH Ecosystem Insights · ${slug}`
    const bodyHtml = langBlock(mdToHtml(mdZh), mdEn ? mdToHtml(mdEn) : '<p><i>English edition pending.</i></p>')
    // 重点关注盒：由规则引擎信号确定性生成（不依赖 LLM 排版），high 黄底凸显
    const sevLabel = { high: t('高', 'HIGH'), mid: t('中', 'MID'), low: t('低', 'LOW') }
    const sigBox = (meta.signals || []).length
      ? `<div class="sigbox"><b>${t('重点关注', 'Key signals')} · ${meta.signals.length} ${t('个异常信号', 'anomaly signals')}</b>${meta.signals.map((s) => `<div class="sig ${escHtml(s.severity || 'low')}"><span class="sev">${sevLabel[s.severity] || s.severity}</span>${t(s.fact, s.factEn || s.fact)}</div>`).join('')}</div>`
      : ''
    written.push(out(`insights/${slug}.html`, page({
      og: { type: 'article', url: `${ORIGIN}/insights/${slug}.html` },
      title, titleEn,
      desc: 'DSH 生态阶段性洞察报告（规则信号 grounding + DeepSeek 分析 · 中英双语）',
      base: '../', here: 'insights/',
      body: `<p class="crumb">${t('生态洞察', 'Insights')} · ${slug}</p>${sigBox}<div class="article">${bodyHtml}</div>`,
    })))
    insights.push({ slug, title, titleEn, range: meta.range || '', model: meta.model || '', signals: (meta.signals || []).length, bodyHtml, sigBox })
  }
  if (insights.length) {
    const latest = insights[0]
    written.push(out('insights/index.html', page({
      title: '生态洞察', titleEn: 'Insights',
      desc: 'DSH 生态阶段性洞察报告：规则引擎检出异常信号，DeepSeek 撰写分析结论与建议，中英双语。',
      base: '../', here: 'insights/',
      body: `<p class="crumb">Insights</p><h1 class="pagetitle">${t('生态洞察', 'Ecosystem Insights')}</h1>
<p class="lede">${t('每周五随管线生成：规则引擎先从数据检出异常信号，再由 DeepSeek 撰写分析结论、异常应对与分角色建议。数字全部来自落盘数据，LLM 只负责解释与判断。中英双语，点右上角切换。', 'Generated every Friday with the pipeline: a rules engine detects anomaly signals from the data first, then DeepSeek writes the analysis, mitigations and per-role recommendations. All numbers come from on-disk data — the LLM only interprets. Bilingual zh/en via the top-right switcher.')}</p>
<div class="cards">${insights.map((r) => `<a class="card" href="./${r.slug}.html" style="text-decoration:none;color:inherit"><b>${t(r.title, r.titleEn)}<span style="color:var(--faint);font-weight:400;font-size:12px"> · ${escHtml(r.model)}</span></b><p>${t('信号', 'Signals')} ${r.signals} · ${escHtml(r.range)}</p></a>`).join('')}</div>
<h2 style="margin:34px 0 10px;font-size:18px;letter-spacing:-.01em">${t('最新一期', 'Latest issue')}</h2>
${latest.sigBox}<div class="article">${latest.bodyHtml}</div>`,
    })))
  }

  // ---- plugin detail pages (/p/<owner>/<repo>/) —— 对全量权威集生成（客观数据页） --
  // 「致作者的信」是外发邮件/PR 物料（data/reports/，letters.mjs 照常生成），不再上页。
  // 无 enrich 行的新入库插件也生成：等级/扣分/同类优雅降级为「评分待生成」。
  const enrichAll = JSON.parse(read('enrich.json') || '[]')
  const enBy = new Map(enrichAll.map((x) => [x.full_name, x]))
  const plugAll = loadPlugins()
  const llmBy = byFullName(readJsonl(PATHS.llm))
  const deepBy = byFullName(readJsonl(PATHS.deep))
  const dlMap = (JSON.parse(read('downloads.json') || '{}').map) || {}
  const compatDoc = JSON.parse(read('compat.json') || '{}')
  const compatBy = new Map((compatDoc.plugins || []).map((p) => [p.pkgName, p]))
  const dshLatest = compatDoc.officialDsh?.latest || ''
  // 实测兼容矩阵（compat-observed.json）：pkgName → { version, requires, results }
  const obsDoc = JSON.parse(read('compat-observed.json') || 'null')
  const obsPlugins = obsDoc?.plugins || {}
  const obsVersions = obsDoc?.dshVersions || []
  const obsTagOf = {}
  for (const [tag, ver] of Object.entries(obsDoc?.shellDistTags || {})) (obsTagOf[ver] ||= []).push(tag)
  const dimLabel = { eng: t('工程质量', 'Engineering quality'), docs: t('文档完整性', 'Docs completeness'), discover: t('可发现性', 'Discoverability'), maint: t('维护活跃', 'Maintenance activity') }
  const okIco = `<span style="display:inline-block;vertical-align:-2px;color:var(--ok)">${icon('check', 13)}</span>`
  const warnIco = `<span style="display:inline-block;vertical-align:-2px;color:var(--warn)">${icon('alert', 13)}</span>`
  let pWrote = 0
  for (const r of plugAll) {
    const owner = r.owner, repo = r.repo
    if (!owner || !repo) continue
    const full = r.full_name || `${owner}/${repo}`
    const en = enBy.get(full) || {}
    const hasScore = en.grade != null
    const llm = llmBy.get(full)
    const deep = deepBy.get(full)
    const dl = r.pkgName ? dlMap[r.pkgName]?.d ?? null : null
    const compat = r.pkgName ? compatBy.get(r.pkgName) || null : null
    const compatLine = !r.npm?.published ? '' : compat?.enginesDsh
      ? `<p style="font-size:12.5px;color:var(--mut)" title="${t('启发式信号（npm registry 探测），非运行时测试', 'Heuristic signal (npm registry probe), not a runtime test')}">${t('dsh 兼容', 'dsh compat')}：engines.dsh <b>${escHtml(compat.enginesDsh)}</b>${dshLatest ? ` · ${t('官方 latest', 'official latest')} <code>${escHtml(dshLatest)}</code>` : ''}</p>`
      : compat?.dshPeers?.length
        ? `<p style="font-size:12.5px;color:var(--mut)" title="${t('启发式信号（npm registry 探测），非运行时测试', 'Heuristic signal (npm registry probe), not a runtime test')}">${t('dsh 兼容：未声明 engines.dsh · peers', 'dsh compat: no engines.dsh · peers')} ${compat.dshPeers.slice(0, 2).map((p) => `${escHtml(p.name)} ${escHtml(p.range)}`).join(' · ')}${compat.dshPeers.length > 2 ? t(` 等 ${compat.dshPeers.length} 项`, ` (+${compat.dshPeers.length - 2} more)`) : ''}</p>`
        : `<p style="font-size:12.5px;color:var(--mut)">${t('dsh 兼容：未声明（engines.dsh / peers 均无）——建议在 package.json 加 "engines": {"dsh": "^x.y.z"}', 'dsh compat: undeclared (no engines.dsh / peers) — add "engines": {"dsh": "^x.y.z"} to package.json')}</p>`
    // 实测兼容区块：有记录按 shell 版本逐行 ✓/✗；无记录给诚实文案（未发布/无 client bundle/未扫到）
    const obs = r.pkgName ? obsPlugins[r.pkgName] || null : null
    const obsRows = obs
      ? obsVersions.map((v) => {
          const res = obs.results?.[v]
          if (!res) return ''
          const ok = res.status === 'ok'
          const tagStr = (obsTagOf[v] || []).join(' · ')
          return `<div class="scrow"><a style="cursor:default">${escHtml(v)}${tagStr ? ` <span style="color:var(--faint);font-weight:400;font-size:11px">${escHtml(tagStr)}</span>` : ''}</a><span class="meta" style="color:${ok ? 'var(--ok)' : 'var(--err)'};white-space:normal">${ok ? `✓ ${t('可加载', 'loadable')}` : `✗ ${t('无法加载（loader 启动即崩）', 'fails to load (loader crashes at boot)')}：${t('缺', 'missing')} ${(res.missing || []).map((m) => `<code>${escHtml(m)}</code>`).join(' ')}`}</span></div>`
        }).join('')
      : ''
    const obsBlock = `<h2 style="font-size:16px;margin:26px 0 8px">${t('实测兼容', 'Observed Compatibility')} <span style="color:var(--faint);font-weight:400;font-size:12px">${t('client bundle × shell 模块表', 'client bundle × shell module table')}</span></h2>
<div class="card">${obs
      ? `${obsRows}<p style="font-size:11px;color:var(--faint);margin-top:10px">${t(`实测对象：npm ${escHtml(obs.version)} · 外部 require ${obs.requires.length} 个。口径：静态分析 client bundle 的 require 字面量，对比各 shell 版本烘焙的模块表（seed 词 ∪ 图行近似＝语料库已知插件包名，"/client" 后缀剥离后匹配）；非运行时测试，动态 require（含模板串）不在检测范围。`, `Measured: npm ${escHtml(obs.version)} · ${obs.requires.length} external requires. Method: static analysis of the client bundle's literal requires vs each shell build's baked module table (seed words ∪ graph-row approximation = corpus-known plugin package names, matched after stripping a "/client" suffix); not a runtime test — dynamic requires (incl. template strings) are out of scope.`)}</p>`
      : `<p style="color:var(--faint);font-size:13px;margin:4px 0">${t('暂无实测数据：该插件未发布 npm、无界面（client）bundle，或尚未被扫描覆盖。', 'No observed data: the plugin is not on npm, has no client (UI) bundle, or has not been scanned yet.')}</p>`}</div>`
    const peers = en.category
      ? enrichAll.filter((x) => x.category === en.category && x.full_name !== full)
          .sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 5) : []
    const dimRows = hasScore
      ? Object.entries(dimLabel).map(([k, label]) => {
          const v = en.dimScores?.[k]
          return `<div class="dimrow"><span>${label}</span><div class="dimt"><i style="width:${v == null ? 0 : v}%"></i></div><b>${v == null ? '—' : v}</b></div>`
        }).join('')
      : ''
    const dropsRows = hasScore
      ? (en.drops || []).map((d) => `<div class="scrow"><a style="cursor:default">${escHtml(d.label)}</a><span class="meta">${d.sev === 'fail' ? 'fail −20' : d.sev === 'major' ? '−10' : d.sev === 'minor' ? '−2' : '−5'}</span></div>`).join('')
      : ''
    const peersHtml = peers.map((p) => `<div class="scrow"><a href="/p/${escHtml(p.full_name)}/">${escHtml(p.full_name)}</a><span class="meta"><span class="grade ${escHtml(p.grade)}">${escHtml(p.grade)}</span> ${p.score} · ★${p.stars}</span></div>`).join('')
    const body = `<p class="crumb">${t('插件详情', 'Plugin')} · ${escHtml(full)}</p>
<div style="display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:6px">
  <img src="https://github.com/${escHtml(owner)}.png?size=80" width="56" height="56" style="border-radius:14px" alt="">
  <div style="flex:1;min-width:260px">
    <h1 class="pagetitle" style="margin-bottom:4px">${escHtml(repo)} <span style="color:var(--faint);font-weight:400;font-size:16px">${escHtml(owner)}</span></h1>
    <p class="lede" style="margin-bottom:10px;max-width:none">${escHtml(stripEmoji(r.description)) || t('（无描述）', '(No description)')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${hasScore ? `<span class="grade ${en.grade}" style="font-size:15px;min-width:30px;padding:3px 10px">${en.grade}</span><b class="mono" style="font-size:15px">${en.score ?? '—'}/100</b>` : `<span class="pill">${t('评分待生成', 'Score pending')}</span>`}
      ${en.category ? `<span class="pill">${escHtml(en.category)}</span>` : ''}
      <a class="wkbtn" href="https://github.com/${escHtml(full)}" target="_blank">GitHub ↗</a>
      ${r.npm?.published ? `<a class="wkbtn" href="https://www.npmjs.com/package/${escHtml(r.pkgName)}" target="_blank">npm ${escHtml(r.npm.latest || '')} ↗</a>` : ''}
      <a class="wkbtn" href="https://github.com/${escHtml(owner)}" target="_blank">${t('作者主页 ↗', 'Author ↗')}</a>
    </div>
  </div>
</div>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
  <div class="card"><b>★ ${(r.stars || 0).toLocaleString()}</b><p>GitHub stars</p></div>
  <div class="card"><b>${r.forks || 0}</b><p>forks</p></div>
  <div class="card"><b>${escHtml((r.created_at || '').slice(0, 10) || '—')}</b><p>${t('创建于', 'Created')}</p></div>
  <div class="card"><b>${escHtml((r.pushed_at || '').slice(0, 10) || '—')}</b><p>${t('最近 push', 'Last push')}</p></div>
  <div class="card"><b>${dl != null ? dl.toLocaleString() + t('/周', '/wk') : '—'}</b><p>${t('npm 周下载', 'npm weekly downloads')}</p></div>
</div>
<div class="sc-cols" style="margin-top:16px">
  <div class="card" style="margin:0"><b>${t('评分维度（六维框架）', 'Scoring dimensions (six-dimension framework)')}</b>${dimRows || `<p style="color:var(--faint);font-size:13px;margin-top:8px">${t('评分待生成（新入库，下个评分快照补齐）', 'Score pending (newly indexed; filled in the next scoring snapshot)')}</p>`}<p style="font-size:11px;color:var(--faint);margin-top:10px">${t('安全卫生（深检抽样）、采用度与兼容性（engines.dsh/peers 探测）只展示不进分。口径见', 'Safety hygiene (deep-scan sampling), adoption and compatibility (engines.dsh/peers probe) are display-only, never scored. Definitions:')} <a href="/about/">${t('关于·指标体系', 'About · Metrics')}</a></p></div>
  <div class="card" style="margin:0"><b>${t('扣分明细（health-v4）', 'Deductions (health-v4)')}</b>${dropsRows || (hasScore ? `<p style="color:var(--ok);font-size:13px;margin-top:8px">${t('无扣分项 ✓', 'No deductions ✓')}</p>` : `<p style="color:var(--faint);font-size:13px;margin-top:8px">${t('评分待生成（新入库，下个评分快照补齐）', 'Score pending (newly indexed; filled in the next scoring snapshot)')}</p>`)}${hasScore && (en.missing || []).length ? `<p style="font-size:11px;color:var(--faint);margin-top:8px">${t('未探测（不扣分）：', 'Not probed (no deduction): ')}${escHtml(en.missing.join('、'))}</p>` : ''}</div>
</div>
<div class="sc-cols" style="margin-top:14px">
  <div class="card" style="margin:0"><b>${t('收录 / 发布', 'Listing / Publishing')}</b>
    <p style="font-size:13px;margin-top:8px">${en.inAwesome ? okIco + ' awesome-dsh-plugin' : '— ' + t('awesome 未收录', 'not in awesome')} · ${en.inImsai ? okIco + ' imsai' : '— ' + t('imsai 未收录', 'not in imsai')}</p>
    <p style="font-size:13px;color:var(--mut)">${r.npm?.published ? `npm <b>${escHtml(r.pkgName)}@${escHtml(r.npm.latest || '')}</b>${t(`（${r.npm.versions ?? '?'} 个版本 · 最近发布 ${escHtml((r.npm.latestTime || '').slice(0, 10))}）`, ` (${r.npm.versions ?? '?'} versions · latest ${(r.npm.latestTime || '').slice(0, 10)})`)}` : t('未发布 npm（仅仓库安装）', 'Not on npm (repo install only)')}</p>
    ${compatLine}
    ${(r.npm?.published && r.version && r.npm.latest !== r.version) ? `<p style="font-size:12.5px;color:var(--warn)">${warnIco} ${t(`版本滞后：仓库 ${escHtml(r.version)} vs npm ${escHtml(r.npm.latest)}`, `Version lag: repo ${escHtml(r.version)} vs npm ${escHtml(r.npm.latest)}`)}</p>` : ''}
    <p style="font-size:12.5px;margin-top:10px"><b>${t('徽章接入', 'Badge')}</b>：<code style="font-size:11.5px">https://dsh-insights.com/badge/${escHtml(full)}.svg</code> · <a href="/badge/">${t('接入指南 ↗', 'Setup guide ↗')}</a></p>
  </div>
  <div class="card" style="margin:0"><b>${t('LLM 解读', 'LLM Summary')}</b>${llm ? `<p style="font-size:13px;margin-top:8px">${escHtml(llm.summaryZh || llm.summaryEn || '—')}</p>${(llm.capabilityTags || []).length ? `<p style="margin-top:8px">${llm.capabilityTags.map((t) => `<span class="pill">${escHtml(t)}</span>`).join('')}</p>` : ''}${(llm.claims || []).length ? `<p style="font-size:12px;color:var(--mut);margin-top:8px">${t('README 宣称：', 'README claims: ')}${escHtml(llm.claims.slice(0, 4).join('；'))}</p>` : ''}` : `<p style="color:var(--faint);font-size:13px;margin-top:8px">${t('未标注 · 待 LLM 标注轮', 'Not annotated yet · pending an LLM annotation round')}</p>`}${deep ? `<p style="font-size:12.5px;margin-top:10px;border-top:1px solid var(--line);padding-top:8px"><b>${t('深检（写面/消毒，非审计）', 'Deep scan (write surface/sanitization, not an audit)')}</b>：${escHtml(deep.verdict)} · ${t(`写面 ${deep.writeCount} 处`, `${deep.writeCount} write points`)} · ${deep.sanitized ? t('有消毒器', 'sanitizer present') : t('无消毒器', 'no sanitizer')}</p>` : ''}</div>
</div>
${obsBlock}
${peersHtml ? `<h2 style="font-size:16px;margin:26px 0 8px">${t(`同类插件（${escHtml(en.category)}）`, `Similar plugins (${escHtml(en.category)})`)}</h2><div class="card">${peersHtml}</div>` : ''}
<p style="margin-top:18px;font-size:12px;color:var(--faint)">${t('数据有误或已更新？', 'Data wrong or outdated? ')}<a href="https://github.com/ice5kysl/dsh-insights/actions/workflows/recheck.yml">${t('申请重检', 'Request a re-check')}</a>${t('（Actions 手动触发，输入 owner/repo，约半小时生效）', ' (manual Actions trigger; enter owner/repo; takes effect in ~30 min)')} · <a href="https://github.com/ice5kysl/dsh-insights/issues/new/choose">${t('申诉 / 纠错', 'Appeal / correction')}</a></p>`
    const html = page({
      title: `${repo} · 插件详情 · DSH Insights`, titleEn: `${repo} · Plugin · DSH Insights`, desc: `${full} 的健康分、维度画像、扣分明细与客观数据（DSH Insights 自动生成）`,
      base: '../../../', here: 'dashboard/', body, og: { type: 'article', title: `${full} · ${hasScore ? `${en.grade} ${en.score}/100 · ` : ''}DSH Insights`, url: `${ORIGIN}/p/${full}/` },
    })
    // diff 驱动：内容不变不重写（全量页避免每日 churn）
    const fp = join(SITE, 'p', owner, repo, 'index.html')
    if (existsSync(fp) && readFileSync(fp, 'utf8') === html) continue
    written.push(out(`p/${owner}/${repo}/index.html`, html))
    pWrote++
  }
  console.log(`[pages] /p/ ${pWrote} written / ${plugAll.length} plugin pages（全量权威集，信件已退出页面）`)

  // ---- /data/ open-data index (+ copy public datasets) -------------------
  const DATASETS = [
    ['insights.json', '全量洞察快照（agent 首选入口）', 'Full insights snapshot (the agent entry point)'],
    ['plugins.jsonl', '权威集全量（一行一插件）', 'Full authoritative set (one plugin per line)'],
    ['invalid.jsonl', '噪声分桶（被拒候选 + reason）', 'Noise buckets (rejected candidates + reason)'],
    ['enrich.json', '每插件评分 / 等级 / 分类 / 收录渠道', 'Per-plugin score / grade / category / listing channels'],
    ['analysis.json', '聚合统计（仪表盘数据源）', 'Aggregate stats (dashboard data source)'],
    ['health.json', '健康分聚合（分级分布/均分/top 扣分）', 'Health score aggregates (grade distribution / average / top deductions)'],
    ['dynamics.json', '官方动态快照（dsh releases/dist-tags/DeepSeek 平台）', 'Official dynamics snapshot (dsh releases / dist-tags / DeepSeek platform)'],
    ['compat.json', 'dsh 版本兼容信号（engines.dsh / peers 探测）', 'dsh version compat signals (engines.dsh / peers probe)'],
    ['shell-seeds.json', 'shell 模块表 seed 词（dsh-web-frontend 全版本）', 'Shell module-table seed words (all dsh-web-frontend versions)'],
    ['compat-observed.json', '实测兼容矩阵（client require × shell 模块表）', 'Observed compat matrix (client requires × shell module table)'],
    ['scenarios.json', '场景组合推荐（插件 ↔ 场景映射）', 'Scenario picks (plugin ↔ scenario mapping)'],
    ['plugins.csv', '权威集表格（25 列，Excel 友好）', 'Authoritative set as a table (25 columns, Excel-friendly)'],
    ['downloads.json', 'npm 周下载（CI 更新）', 'npm weekly downloads (updated by CI)'],
    ['listed.json', '收录渠道清单（awesome / imsai）', 'Listing channels (awesome / imsai)'],
    ['metrics.jsonl', '产品发展指标自测量（周度追加）', 'Self-measured product metrics (appended weekly)'],
  ]
  const cards = []
  mkdirSync(join(SITE, 'data'), { recursive: true })
  for (const [f, desc, descEn] of DATASETS) {
    const src = join(DATA, f)
    if (!existsSync(src)) continue
    copyFileSync(src, join(SITE, 'data', f))
    const kb = Math.round(statSync(src).size / 1024)
    written.push(`data/${f}（拷贝）`)
    cards.push(`<div class="card"><b>${t(desc, descEn)}</b><code>/data/${f}</code><p>${kb} KB · <a href="${f}">${t('下载', 'Download')}</a> · <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/SCHEMA.md" target="_blank">schema</a></p></div>`)
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
    title: '开放数据', titleEn: 'Open Data', desc: 'DSH Insights 开放数据集：稳定 URL、可复核口径、CC BY 4.0。',
    base: '../', here: 'data/',
    body: `<p class="crumb">Open Data</p><h1 class="pagetitle">${t('开放数据', 'Open Data')}</h1>
<p class="lede">${t('全量、可复核、持续更新。URL 稳定（公布即不变更），agent 可直接抓取，无需登录。使用请注明出处（CC BY 4.0）。', 'Complete, verifiable, continuously updated. URLs are stable (never changed once published); agents can fetch directly, no login required. Attribution required (CC BY 4.0).')}</p>
<div class="cards">${cards.join('')}</div>
<h2 style="font-size:16px;margin:28px 0 8px">${t('许可与口径', 'License & Definitions')}</h2>
<div class="lede">${langBlock(
  '代码 <b>MIT</b> · 数据 <b>CC BY 4.0</b>（署名：dsh-insights.com，全文见 <a href="https://github.com/ice5kysl/dsh-insights/blob/main/DATA-LICENSE" target="_blank">DATA-LICENSE</a>）。「权威集」= 非 fork/归档 + package.json 声明 dsh.bundle.patch 且 patch 已提交（下限口径）。健康分为启发式评估，<b>非安全审计</b>。',
  'Code <b>MIT</b> · data <b>CC BY 4.0</b> (attribution: dsh-insights.com; full text in <a href="https://github.com/ice5kysl/dsh-insights/blob/main/DATA-LICENSE" target="_blank">DATA-LICENSE</a>). The "authoritative set" = not a fork/archived + package.json declares dsh.bundle.patch with the patch committed (a lower-bound definition). The health score is a heuristic evaluation, <b>not a security audit</b>.'
)}</div>
<h2 style="font-size:16px;margin:28px 0 8px">${t('调用示例', 'Usage Examples')}</h2>
<pre style="background:var(--track);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;overflow:auto"><code>curl ${ORIGIN}/data/insights.json
curl ${ORIGIN}/feed.xml          # ${t('周报 RSS', 'weekly RSS')}</code></pre>`,
  })))

  // ---- /scenarios/ 场景组合推荐 -------------------------------------------
  const scenarios = (JSON.parse(read('scenarios.json') || '{"scenarios":[]}')).scenarios || []
  const plugBy = byFullName(loadPlugins())
  // B6：主链接落站内 /p/ 详情页（存在时），GitHub 降为 ↗ 次链接——场景页从「出口页」变「中转页」
  const scRow = (p, extra) => {
    const inSite = existsSync(join(SITE, 'p', ...String(p.full_name).split('/'), 'index.html'))
    const desc = stripEmoji(plugBy.get(p.full_name)?.description || '').replace(/\s+/g, ' ').trim().slice(0, 72)
    return `<div class="scrow"><div style="display:flex;align-items:baseline;gap:6px;min-width:0"><a href="${inSite ? '/p/' + escHtml(p.full_name) + '/' : escHtml(p.url)}"${inSite ? '' : ' target="_blank"'} title="${escHtml(p.full_name)}">${escHtml(p.full_name)}</a>${inSite ? ` <a href="${escHtml(p.url)}" target="_blank" style="font-size:11px;color:var(--faint);flex:none" title="GitHub 仓库" data-en-title="GitHub repository">↗</a>` : ''}</div><span class="meta"><span class="grade ${escHtml(p.grade)}">${escHtml(p.grade)}</span> ${p.score} · ★${p.stars}${p.npm ? ' · npm ' + escHtml(p.npm) : ''}${p.active ? ' · ' + t('活跃', 'Active') : ''}${extra || ''}</span>${desc ? `<span class="meta" style="color:var(--mut)">${escHtml(desc)}</span>` : ''}</div>`
  }
  const scCards = scenarios.filter((s) => (s.plugins || []).length).map((s) => {
    const withAge = s.plugins.map((p) => ({ ...p, created: (plugBy.get(p.full_name)?.created_at || '').slice(0, 10) }))
    const best = withAge.slice(0, 5)
    const fresh = [...withAge].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 5)
    const reasons = [...new Set(s.plugins.flatMap((p) => p.reasons || []))].slice(0, 3).join('；')
    return `<section class="scsec" id="sc-${escHtml(s.id)}">
<h2 style="font-size:16px;margin:0 0 4px">${escHtml(s.zh)} <span style="color:var(--faint);font-weight:400;font-size:12px">${escHtml(s.en)}</span></h2>
<p style="color:var(--faint);font-size:12px;margin:0 0 12px">${t(`${s.candidates} 个候选 · 按健康分/npm/活跃排序`, `${s.candidates} candidates · sorted by health score / npm / activity`)}${reasons ? ' · ' + escHtml(reasons) : ''}</p>
<div class="sc-cols">
<div class="card" style="margin:0"><b>${t('质量首选', 'Top Picks')}</b>${best.map((p) => scRow(p)).join('')}</div>
<div class="card" style="margin:0"><b>${t('新入场', 'New Arrivals')}</b>${fresh.map((p) => scRow(p, ' · ' + t('创于', 'created') + ' ' + escHtml(p.created || '—'))).join('') || `<p style="color:var(--faint);font-size:12px">${t('暂无', 'None yet')}</p>`}</div>
</div>
</section>`
  }).join('\n')
  written.push(out('scenarios/index.html', page({
    title: '场景组合推荐', titleEn: 'Scenario Picks', desc: '按使用场景挑选 dsh 插件组合：客观信号排序、每场景给备选、理由可展开。',
    base: '../', here: 'scenarios/',
    body: `<p class="crumb">Scenarios</p><h1 class="pagetitle">${t('场景组合推荐', 'Scenario Picks')}</h1>
<div class="lede">${langBlock(
  `从「我要做什么」出发，而不是从「哪个星多」出发。每个场景给出健康分最高、npm 已发布、近期活跃的一组候选与备选——<b>客观信号排序，不接"最佳"叙事，不做付费置顶</b>。覆盖 ${scenarios.reduce((n, s) => n + (s.plugins || []).length, 0)} 个推荐位，随每日快照刷新。`,
  `Start from "what do I want to do", not from "which has the most stars". Each scenario offers candidates and alternates with the highest health score, published to npm, and recently active — <b>ranked by objective signals; we don't sell the "best" narrative and don't take paid placement</b>. ${scenarios.reduce((n, s) => n + (s.plugins || []).length, 0)} recommendation slots, refreshed with the daily snapshot.`
)}</div>
<div class="sc-layout">
<div class="sc-main">${scCards || `<div class="card"><b>${t('数据积累中', 'Collecting data')}</b><p>${t('场景数据随 LLM 标注覆盖逐步补齐。', 'Scenario coverage grows as LLM annotation progresses.')}</p></div>`}</div>
<aside class="sc-toc" id="sc-toc">${scenarios.filter((s) => (s.plugins || []).length).map((s) => `<a href="#sc-${escHtml(s.id)}" data-t="sc-${escHtml(s.id)}">${t(s.zh, s.en)}</a>`).join('')}</aside>
</div>
<style>
.sc-layout{display:grid;grid-template-columns:minmax(0,1fr) 208px;gap:28px;align-items:start}
.sc-toc{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:8px}
.sc-toc a{display:block;padding:7px 10px;border-radius:8px;color:var(--mut);font-size:12.5px;line-height:1.4}
.sc-toc a:hover{background:var(--track);color:var(--ink);text-decoration:none}
.sc-toc a.on{background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent);font-weight:650}
@media(max-width:960px){.sc-layout{grid-template-columns:1fr}.sc-toc{position:static;max-height:none;display:flex;overflow-x:auto;gap:4px;padding:6px}.sc-toc a{white-space:nowrap;flex:none}}
</style>
<script>
(function(){
  var toc=document.getElementById('sc-toc'); if(!toc)return;
  var links=[].slice.call(toc.querySelectorAll('a'));
  var secs=links.map(function(a){return document.getElementById(a.dataset.t)}).filter(Boolean);
  if(!secs.length)return;
  function spy(){ var y=window.scrollY+120, cur=secs[0];
    secs.forEach(function(s){ if(s.offsetTop<=y)cur=s });
    links.forEach(function(a){ a.classList.toggle('on', a.dataset.t===cur.id) });
  }
  window.addEventListener('scroll',spy,{passive:true}); spy();
})();
</script>
<h2 style="font-size:16px;margin:28px 0 8px">${t('排序口径', 'Sorting Criteria')}</h2>
<div class="lede">${langBlock(
  '场景归属 = LLM 能力标签 ∪ 词汇桶（标注"LLM 生成，人工抽查"）；场景内排序 = 健康分 → npm 已发布 → 近 30 天活跃，星数仅作展示不参与排序。同样的数据在 <a href="../data/insights.json">/data/insights.json</a> 开放，agent 可直接消费。',
  'Scenario assignment = LLM capability tags ∪ keyword buckets (labeled "LLM-generated, human spot-checked"); ranking within a scenario = health score → published to npm → active in the last 30 days. Stars are display-only and never affect ranking. The same data is open at <a href="../data/insights.json">/data/insights.json</a> for agents to consume directly.'
)}</div>`,
  })))

  // ---- /dynamics/ 动态：feed 时间线（侧栏标签筛选 + 按日分组 + 叙事行） --------
  const dyn = JSON.parse(read('dynamics.json') || 'null')
  const nowMs = Date.now(), d30ms = 30 * 86400000
  // 版本升级：相邻两期 history 快照的 version diff（history 自 2026-09-07 起记录 version，首日为空）
  const hEntries = JSON.parse(read('history.json') || '{}').entries || []
  const hLast = hEntries[hEntries.length - 1], hPrev = hEntries[hEntries.length - 2]
  const upRows = []
  if (hPrev?.plugins) {
    for (const r of plugAll) {
      const pv = hPrev.plugins[r.full_name]?.version
      if (pv && r.version && pv !== r.version) upRows.push({ r, from: pv, to: r.version })
    }
    upRows.sort((a, b) => (b.r.stars || 0) - (a.r.stars || 0))
  }
  // 事件汇聚：插件新入库 / 版本升级 / 活跃更新 / 官方 release（含 breaking）/ 平台仓库
  const evs = []
  for (const r of plugAll) {
    const g = enBy.get(r.full_name)?.grade
    const owner = (r.full_name || '').split('/')[0]
    if (r.created_at && nowMs - new Date(r.created_at).getTime() < d30ms) {
      evs.push({ d: r.created_at, tag: 'new', actor: owner, obj: r.full_name, url: `/p/${r.full_name}/`, sub: stripEmoji(r.description || '').slice(0, 80) || `★${r.stars || 0}`, grade: g })
    } else if (r.pushed_at && nowMs - new Date(r.pushed_at).getTime() < d30ms) {
      evs.push({ d: r.pushed_at, tag: 'update', actor: owner, obj: r.full_name, url: `/p/${r.full_name}/`, sub: `${r.version ? escHtml(r.version) + ' · ' : ''}★${r.stars || 0}`, grade: g })
    }
  }
  for (const u of upRows) evs.push({ d: hLast.date + 'T00:00:00Z', tag: 'upgrade', actor: (u.r.full_name || '').split('/')[0], obj: u.r.full_name, url: `/p/${u.r.full_name}/`, sub: `${escHtml(u.from)} → ${escHtml(u.to)}`, grade: enBy.get(u.r.full_name)?.grade })
  const dsh0 = dyn?.dsh || {}
  for (const r of dsh0.releases || []) {
    evs.push({ d: r.published_at, tag: r.breaking ? 'breaking' : 'official', actor: (dsh0.repo || '').split('/')[0], obj: r.tag, url: `https://github.com/${dsh0.repo}/releases/tag/${r.tag}`, sub: escHtml((r.summary || (r.prerelease ? 'pre-release' : 'release')).slice(0, 90)), ext: 1 })
  }
  for (const p of (dyn?.platform || []).filter((p) => !p.error && p.pushed_at)) {
    evs.push({ d: p.pushed_at, tag: 'platform', actor: p.repo.split('/')[0], obj: p.repo, url: `https://github.com/${p.repo}`, sub: `★${(p.stars || 0).toLocaleString()}${p.latestRelease ? ' · ' + escHtml(p.latestRelease.tag) : ''}`, ext: 1 })
  }
  evs.sort((a, b) => new Date(b.d) - new Date(a.d))
  const FEED_CAP = 400
  // 少量高价值事件（官方/breaking/平台/升级）不被海量新入库挤出窗口
  const PRIORITY = new Set(['official', 'breaking', 'platform', 'upgrade'])
  const feedPriority = evs.filter((e) => PRIORITY.has(e.tag))
  const feed = [...feedPriority, ...evs.filter((e) => !PRIORITY.has(e.tag)).slice(0, Math.max(0, FEED_CAP - feedPriority.length))]
    .sort((a, b) => new Date(b.d) - new Date(a.d))

  const TAGS = [
    ['new', '新插件', 'New plugin', 'var(--accent)', '发布了新插件', 'published a new plugin'],
    ['upgrade', '版本升级', 'Upgrade', 'var(--ok)', '升级了', 'upgraded'],
    ['update', '活跃更新', 'Update', 'var(--faint)', '更新了', 'updated'],
    ['official', '官方发布', 'Official', 'var(--ink)', '发布了', 'released'],
    ['breaking', 'Breaking', 'Breaking', 'var(--err)', '发布了含 breaking 的', 'shipped a breaking release'],
    ['platform', '平台仓库', 'Platform', '#7c3aed', '更新了平台仓库', 'updated'],
  ]
  const tagOf = Object.fromEntries(TAGS.map(([k, zh, en, c, vzh, ven]) => [k, { zh, en, c, vzh, ven }]))
  const tagCount = Object.fromEntries(TAGS.map(([k]) => [k, 0]))
  for (const e of feed) tagCount[e.tag] = (tagCount[e.tag] || 0) + 1

  const relTime = (d) => {
    const m = Math.max(1, Math.round((nowMs - new Date(d).getTime()) / 60000))
    if (m < 60) return t(`${m} 分钟前`, `${m}m ago`)
    const h = Math.round(m / 60)
    if (h < 24) return t(`${h} 小时前`, `${h}h ago`)
    return t(`${Math.round(h / 24)} 天前`, `${Math.round(h / 24)}d ago`)
  }

  const sideBtn = (key, zh, en, n, on) => `<button class="fside${on ? ' on' : ''}" data-f="${key}"><span>${t(zh, en)}</span><span class="n">${n}</span></button>`
  const sideHtml = sideBtn('all', '全部动态', 'All', feed.length, true) + TAGS.filter(([k]) => tagCount[k]).map(([k, zh, en]) => sideBtn(k, zh, en, tagCount[k], false)).join('')

  const feedRows = []
  let lastDay = ''
  for (const e of feed) {
    const day = (e.d || '').slice(0, 10)
    if (day !== lastDay) {
      feedRows.push(`<div class="fday" data-day="${day}">${day}</div>`)
      lastDay = day
    }
    const tg = tagOf[e.tag] || { zh: e.tag, en: e.tag, c: 'var(--faint)', vzh: e.tag, ven: e.tag }
    feedRows.push(`<div class="frow" data-tag="${e.tag}" data-day="${day}">
<i class="fdot" style="background:${tg.c}"></i>
<img class="fav" src="https://github.com/${escHtml(e.actor)}.png?size=40" width="22" height="22" loading="lazy" alt="" onerror="this.style.visibility='hidden'">
<div class="fbody">
  <div class="fline"><a class="fwho" href="https://github.com/${escHtml(e.actor)}" target="_blank">${escHtml(e.actor)}</a><span class="fverb">${t(tg.vzh, tg.ven)}</span><a class="fobj" href="${e.url}"${e.ext ? ' target="_blank"' : ''}>${e.grade ? `<span class="grade ${e.grade}">${e.grade}</span> ` : ''}${escHtml(e.obj)}</a></div>
  ${e.sub ? `<div class="fsub">${e.sub}</div>` : ''}
</div>
<span class="ftime" title="${escHtml((e.d || '').slice(0, 16).replace('T', ' '))} UTC">${relTime(e.d)}</span>
</div>`)
  }

  // 官方状态参考卡（dist-tags / rc 信号 / 仓库卡）
  let officialRef = ''
  if (dyn) {
    const npm = dsh0.npm || {}
    const daysSince = (iso) => iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : null
    const distRows = Object.entries(npm.distTags || {}).map(([tag, v]) => {
      const ver = (npm.versions || []).find((x) => x.version === v)
      return `<tr><td>${escHtml(tag)}</td><td class="mono">${escHtml(v)}</td><td>${ver ? t(`${escHtml((ver.time || '').slice(0, 10))}（${daysSince(ver.time)} 天前）`, `${(ver.time || '').slice(0, 10)} (${daysSince(ver.time)}d ago)`) : '—'}</td></tr>`
    }).join('')
    const cs = dyn.compatSignal
    officialRef = `<h2 style="font-size:16px;margin:30px 0 8px">${t('官方状态 · dist-tags 与 rc 兼容', 'Official Status · dist-tags & rc Compatibility')}</h2>
<div class="cards">
  <div class="card"><b>${t('DeepSeek Harness（dsh 官方）', 'DeepSeek Harness (official)')}</b><code>${escHtml(dsh0.repo)}</code><p>★${(dsh0.stars || 0).toLocaleString()} · ${t('最近 push', 'last push')} ${escHtml((dsh0.pushed_at || '').slice(0, 10))} · ${escHtml(dsh0.description || '')}</p></div>
  <div class="card"><b>npm dist-tags</b><code>@deepseek-ai/dsh</code><table style="width:100%;font-size:12.5px;margin-top:8px"><tr><th align="left">tag</th><th align="left">${t('版本', 'Version')}</th><th align="left">${t('发布时间', 'Published')}</th></tr>${distRows}</table></div>
  <div class="card"><b>${t('rc 兼容信号（雷达 v0 前置普查）', 'rc Compatibility Signal (pre-radar v0 survey)')}</b>${langBlock(
    `<p>已探测 ${cs ? cs.pluginsProbed : '—'} 个 npm 插件：声明 <code>engines.dsh</code> 的仅 <b>${cs ? cs.declaringEngines : '—'}</b> 个，声明 dsh peer 依赖的 ${cs ? cs.declaringPeers : '—'} 个。<br>声明率太低 → 「声明 vs 最新 rc」的雷达 v0 不成立，主线走 v1（插件 API 符号 × rc changelog 交集，M2）。当前最新 rc：<b>${escHtml((npm.distTags || {}).latest || '—')}</b>，升级前请到 <a href="https://github.com/${escHtml(dsh0.repo)}/releases" target="_blank">releases</a> 核对 breaking 说明。</p>`,
    `<p>${cs ? cs.pluginsProbed : '—'} npm plugins probed: only <b>${cs ? cs.declaringEngines : '—'}</b> declare <code>engines.dsh</code>, and ${cs ? cs.declaringPeers : '—'} declare a dsh peer dependency.<br>The declaration rate is too low for a "declared vs latest rc" radar v0, so the main line is v1 (plugin API symbols × rc changelog intersection, M2). Current latest rc: <b>${escHtml((npm.distTags || {}).latest || '—')}</b> — check the breaking notes in <a href="https://github.com/${escHtml(dsh0.repo)}/releases" target="_blank">releases</a> before upgrading.</p>`
  )}</div>
</div>
<p class="lede" style="margin-top:6px">${t(`官方信号采集于 ${escHtml((dyn.fetchedAt || '').slice(0, 16).replace('T', ' '))} UTC。`, `Official signals collected at ${(dyn.fetchedAt || '').slice(0, 16).replace('T', ' ')} UTC.`)} ${escHtml(dyn.note || '')}</p>`
  }

  const dynBody = `<p class="crumb">Dynamics</p><h1 class="pagetitle">${t('动态', 'Dynamics')}</h1>
<p class="lede">${t('生态时间线：谁在什么时候做了什么——插件新入库 / 版本升级 / 活跃更新 + 官方 release 与平台仓库动向。近 30 天窗口，每日随快照滚动。', 'The ecosystem timeline: who did what and when — plugin arrivals / version upgrades / recent activity plus official releases and platform repos. Rolling 30-day window, refreshed daily.')}</p>
<div class="flayout">
<aside class="fsidebar" id="fside">${sideHtml}</aside>
<div class="fmain card" id="feed">${feedRows.join('') || `<p class="lede" style="margin:10px 0">${t('近 30 天暂无动态', 'No events in the last 30 days')}</p>`}</div>
</div>
${evs.length > FEED_CAP ? `<p class="lede" style="margin-top:8px">${t(`仅显示最近 ${FEED_CAP} 条（共 ${evs.length} 条）`, `Showing the latest ${FEED_CAP} of ${evs.length} events`)}</p>` : ''}
${officialRef}
<style>
.flayout{display:grid;grid-template-columns:188px minmax(0,1fr);gap:24px;align-items:start}
.fsidebar{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:6px}
.fside{display:flex;align-items:center;justify-content:space-between;width:100%;border:0;background:none;padding:8px 10px;border-radius:8px;cursor:pointer;color:var(--mut);font-size:12.5px;text-align:left}
.fside:hover{background:var(--track);color:var(--ink)}
.fside.on{background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent);font-weight:650}
.fside .n{font:11px var(--mono);opacity:.6}
.fmain{padding:4px 16px}
.frow{display:flex;align-items:flex-start;gap:10px;padding:10px 2px;border-bottom:1px solid var(--line)}
.frow:last-child{border-bottom:none}
.fdot{flex:none;width:7px;height:7px;border-radius:50%;margin-top:8px}
.fav{flex:none;border-radius:50%;margin-top:2px}
.fbody{flex:1;min-width:0}
.fline{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;line-height:1.5}
.fwho{font-weight:650;color:var(--ink)}
.fverb{color:var(--mut);font-size:12.5px}
.fobj{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.fobj:hover{color:var(--accent)}
.fsub{color:var(--faint);font-size:12px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ftime{flex:none;color:var(--faint);font:11.5px var(--mono);white-space:nowrap;margin-top:3px}
.fday{position:sticky;top:56px;background:var(--card);font:600 11.5px var(--mono);letter-spacing:.06em;color:var(--faint);padding:12px 2px 6px;border-bottom:1px solid var(--line);z-index:2}
@media(max-width:860px){.flayout{grid-template-columns:1fr}.fsidebar{position:static;max-height:none;display:flex;overflow-x:auto;gap:4px}.fside{white-space:nowrap;flex:none;width:auto;gap:6px}}
</style>
<script>
(function(){
  var btns=document.querySelectorAll('#fside .fside');
  function apply(f){
    document.querySelectorAll('#feed .frow').forEach(function(r){ r.style.display=(f==='all'||r.dataset.tag===f)?'':'none' });
    document.querySelectorAll('#feed .fday').forEach(function(d){
      var any=false, n=d.nextElementSibling;
      while(n && n.classList.contains('frow')){ if(n.style.display!=='none'){any=true;break} n=n.nextElementSibling }
      d.style.display=any?'':'none';
    });
  }
  btns.forEach(function(c){ c.addEventListener('click',function(){ btns.forEach(function(x){x.classList.remove('on')}); c.classList.add('on'); apply(c.dataset.f) }) });
})();
</script>`
  written.push(out('dynamics/index.html', page({
    title: '动态', titleEn: 'Dynamics', desc: 'DSH 生态时间线：插件新入库/版本升级/活跃更新 + dsh 官方 releases 与 DeepSeek 平台动向，按日分组可筛选。',
    base: '../', here: 'dynamics/',
    body: dynBody,
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
    : `<p class="lede" style="margin:8px 0">${t('数据积累中（较上一快照暂无变化）', 'Collecting data (no change since the last snapshot)')}</p>`
  const boardCards = [
    [t('★ 最多 star 榜', 'Top by Stars'), t('作者全部插件 ★ 合计', 'Total ★ across all plugins'), miniList(byStars, (a) => `★${a.stars.toLocaleString()}`)],
    [t('多产榜', 'Most Prolific'), t('权威集插件数', 'Plugins in the authoritative set'), miniList(byProlific, (a) => t(`${a.plugins} 个 · A/B ${a.ab}`, `${a.plugins} plugins · A/B ${a.ab}`))],
    [t('最新飙升榜', 'Trending'), t('较上一快照 ★ 增量（日更）', '★ gained since the last snapshot (daily)'), miniList(byRiser, (a) => `+${a.delta}`)],
    [t('最新榜', 'Newest'), t('首次出现插件的时间', 'When their first plugin appeared'), miniList(byNew, (a) => escHtml(a.firstCreated || '—'))],
  ].map(([t, sub, html]) => `<div class="card"><b>${t}</b><p>${sub}</p>${html}</div>`).join('\n')

  // 作者协作关系图（Top 200 ★ 插件 contributors 采样）
  const graph = JSON.parse(read('authors-graph.json') || 'null')
  const graphSec = graph && graph.nodes?.length ? `
<h2 style="font-size:16px;margin:28px 0 8px">${t('协作关系图 · 关键节点人物', 'Collaboration Graph · Key Connectors')}</h2>
<div class="lede">${langBlock(
  `同一插件的贡献者之间连边（采样：★ Top ${graph.sampledPlugins} 权威插件，${graph.nodes.length} 人 · ${graph.links.length} 条边）。节点大小 = 关联插件数与 ★ 量级，边粗细 = 共享插件数与流行度——<b>居中的大节点就是生态的关键节点人物</b>。悬停看详情，点击访问主页。采集于 ${escHtml((graph.fetchedAt || '').slice(0, 10))}。`,
  `Edges connect contributors of the same plugin (sample: top ${graph.sampledPlugins} authoritative plugins by ★, ${graph.nodes.length} people · ${graph.links.length} edges). Node size = plugin count and ★ magnitude; edge width = shared plugins and popularity — <b>the big central nodes are the ecosystem's key connectors</b>. Hover for details, click to visit a profile. Collected ${escHtml((graph.fetchedAt || '').slice(0, 10))}.`
)}</div>
<div class="card" style="padding:8px"><div id="gwrap" style="position:relative"><svg id="gnet" viewBox="0 0 920 540" style="width:100%;height:auto;display:block"></svg><div id="gtip2" style="position:absolute;pointer-events:none;background:var(--ink);color:var(--bg);font:11.5px var(--mono);padding:6px 10px;border-radius:7px;display:none;max-width:260px;z-index:5"></div></div></div>
<script>
(function(){
  var __t=window.__t||function(zh,en){return document.documentElement.dataset.lang==='en'?en:zh};
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
      tip.innerHTML='<b>'+n.id+'</b> · '+__t('插件','plugins')+' '+n.plugins+' · ★'+n.stars.toLocaleString()+(co?'<br>'+__t('协作：','With: ')+co:'');
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
    title: '作者榜', titleEn: 'Authors', desc: 'DSH 插件生态的作者与组织：榜单、协作关系图与全量作者库。',
    base: '../', here: 'authors/',
    body: `<p class="crumb">Authors</p><h1 class="pagetitle">${t('作者 · 生态里的重要人物', 'Authors · Key People of the Ecosystem')}</h1>
<p class="lede">${t(`${ast.total ?? '—'} 位作者/组织构成这个生态：${ast.multi ?? '—'} 位多产（≥2 个插件），Top 10 作者产出占权威集 ${ast.top10Share ?? '—'}%。榜单按客观信号排序（★ 只作展示，不进质量分）。`, `${ast.total ?? '—'} authors/orgs make up this ecosystem: ${ast.multi ?? '—'} are prolific (≥2 plugins), and the top 10 authors account for ${ast.top10Share ?? '—'}% of the authoritative set. Ranked by objective signals (★ is display-only, never scored).`)}</p>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${boardCards}</div>
${graphSec}
<h2 style="font-size:16px;margin:28px 0 8px">${t(`作者库（全量 ${authors.length}）`, `Author Directory (all ${authors.length})`)}</h2>
<div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
  <input id="aq" ${ph('搜索作者 / 组织名…', 'Search authors / orgs…')} style="flex:1;min-width:200px;max-width:320px;padding:7px 12px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-size:13px">
  <span id="ainfo" style="font:12px var(--mono);color:var(--mut)"></span>
  <button class="wkbtn" id="aprev">${t('‹ 上一页', '‹ Prev')}</button>
  <button class="wkbtn" id="anext">${t('下一页 ›', 'Next ›')}</button>
</div>
<div style="overflow:auto;max-height:70vh;border:1px solid var(--line);border-radius:12px;margin-top:10px">
<table class="ptable" id="atable" style="width:100%">
<thead><tr><th class="num">#</th><th>${t('作者', 'Author')}</th><th class="num" data-k="num">${t('插件', 'Plugins')}</th><th class="num" data-k="num">A/B</th><th class="num" data-k="num">${t('均分', 'Avg')}</th><th class="num" data-k="num">${t('★合计', '★ Total')}</th><th class="num" data-k="num">npm</th><th class="num" data-k="num">${t('收录', 'Listed')}</th><th class="num" data-k="str">${t('最近活跃', 'Last Active')}</th><th>${t('代表插件', 'Top Plugin')}</th><th>${t('主分类', 'Top Category')}</th></tr></thead>
<tbody>${authorRows}</tbody></table>
</div>
<p class="lede" style="margin-top:14px">${t('口径：作者 = 仓库 owner（个人或组织）；收录 = 进 awesome/imsai 渠道数；均分 = 其全部插件健康分均值。点表头排序。数据随每日快照刷新。', 'Definitions: author = repo owner (person or org); listed = number of awesome/imsai channels; avg = mean health score across their plugins. Click a header to sort. Data refreshes with the daily snapshot.')}</p>
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
  var __t=window.__t||function(zh,en){return document.documentElement.dataset.lang==='en'?en:zh};
  var tb=document.getElementById('atable'); if(!tb)return;
  var tbody=tb.querySelector('tbody'), all=[].slice.call(tbody.querySelectorAll('tr'));
  var q=document.getElementById('aq'), info=document.getElementById('ainfo');
  var ths=tb.querySelectorAll('th'), desc=true, col=-1, page=0, PER=100;
  function view(){ var s=(q.value||'').toLowerCase(); return all.filter(function(r){ return !s||r.children[1].textContent.toLowerCase().indexOf(s)>=0 }) }
  function draw(){
    var rows=view(), pages=Math.max(1,Math.ceil(rows.length/PER));
    if(page>=pages)page=pages-1; if(page<0)page=0;
    var slice=rows.slice(page*PER,(page+1)*PER);
    all.forEach(function(r){ r.style.display='none' });
    slice.forEach(function(r){ r.style.display='' });
    slice.forEach(function(r,j){ r.children[0].textContent=page*PER+j+1 });
    info.textContent=__t(rows.length+' 位 · 第 '+(page+1)+'/'+pages+' 页',rows.length+' authors · page '+(page+1)+'/'+pages);
  }
  q.addEventListener('input',function(){ page=0; draw() });
  document.getElementById('aprev').onclick=function(){ if(page>0){page--;draw()} };
  document.getElementById('anext').onclick=function(){ page++;draw() };
  ths.forEach(function(th,i){ th.addEventListener('click',function(){
    var numeric=i>=2&&i<=8; desc=(col===i)?!desc:true; col=i;
    all.sort(function(a,b){ var x=a.children[i],y=b.children[i];
      if(numeric){ var vx=parseFloat((x.getAttribute('data-v')||x.textContent).replace(/[^0-9.\\-]/g,''))||0, vy=parseFloat((y.getAttribute('data-v')||y.textContent).replace(/[^0-9.\\-]/g,''))||0; return desc?vy-vx:vx-vy }
      var sx=x.textContent,sy=y.textContent; return desc?sx.localeCompare(sy):sy.localeCompare(sx) });
    page=0; draw();
  }) });
  document.addEventListener('langchange',function(){ draw() });
  draw();
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
    title: '健康徽章', titleEn: 'Health Badge', desc: '把 DSH Insights 客观健康分带进你的 README：徽章的价值、解读与接入方法。',
    base: '../', here: 'badge/',
    body: `<p class="crumb">Badge</p><h1 class="pagetitle">${t('健康徽章 · 把分数带进 README', 'Health Badge · Bring the Score into Your README')}</h1>
<p class="lede">${t('一枚 SVG 徽章 = 你插件的客观健康分，随每日快照自动刷新。对作者是信任信号与修复指引，对生态是分数走出本站的最小分发单元。', 'One SVG badge = your plugin\'s objective health score, auto-refreshed with the daily snapshot. For authors it is a trust signal and a repair guide; for the ecosystem it is the smallest distribution unit that carries scores beyond this site.')}</p>

<h2 style="font-size:16px;margin:28px 0 8px">${t('长什么样（真实样例，实时渲染）', 'What It Looks Like (live examples, rendered in real time)')}</h2>
${badgeExHtml}

<h2 style="font-size:16px;margin:28px 0 8px">${t('如何解读', 'How to Read It')}</h2>
<div class="lede">${langBlock(
  '徽章显示「等级 · 分数」：100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 <span class="grade S">S ≥ 95</span> <span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>。评的是六维框架中的计分四维（工程质量 / 文档完整性 / 可发现性 / 维护活跃），每条扣分都带证据、可在插件页上逐项核查——<b>分数的意义不在于高低，在于可复核</b>。框架全文见 <a href="../about/">关于 · 指标体系</a>。',
  'The badge shows "grade · score": start at 100 and deduct in four tiers (fail −20 / major −10 / moderate −5 / minor −2). Thresholds: <span class="grade S">S ≥ 95</span> <span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>. It scores the four scored dimensions of the six-dimension framework (engineering quality / docs completeness / discoverability / maintenance activity); every deduction carries evidence and can be verified item by item on the plugin page — <b>the value of a score is not how high it is, but that it can be verified</b>. Full framework: <a href="../about/">About · Metrics</a>.'
)}</div>

<h2 style="font-size:16px;margin:28px 0 8px">${t('为什么值得挂', 'Why It Is Worth Adding')}</h2>
<p class="lede">${t('对作者：潜在用户装前 10 秒的信任凭证；分数提升是看得见的修复回报；徽章链回插件页，带来反链与同类定位。对生态：目录与市场装不下所有插件，但每个 README 都可以挂分数——徽章是让「信得过」在生态里自传播的钩子。我们不做排名、不做安全审计，只提供客观信号。', 'For authors: a 10-second trust signal before a potential user installs; every score improvement is a visible payoff for a fix; the badge links back to the plugin page, bringing backlinks and peer positioning. For the ecosystem: directories and marketplaces cannot hold every plugin, but every README can carry a score — the badge is the hook that lets "trustworthy" propagate on its own. We do not rank, we do not audit security; we provide objective signals.')}</p>

<h2 style="font-size:16px;margin:28px 0 8px">${t('接入（输入你的仓库，自动生成）', 'Setup (enter your repo; snippets are generated automatically)')}</h2>
<div class="card" style="max-width:720px">
  <b>${t('你的插件仓库', 'Your plugin repo')}</b>
  <p><input id="brepo" ${ph('owner/repo，如 ice5kysl/dsh-workspace-kit', 'owner/repo, e.g. ice5kysl/dsh-workspace-kit')} style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:13px var(--mono);background:var(--bg);color:var(--ink)"></p>
  <div id="bprev" style="margin:10px 0;min-height:26px"><span style="color:var(--faint);font-size:12.5px">${t('输入后预览徽章', 'Enter a repo to preview the badge')}</span></div>
  <b style="font-size:12.5px">${t('写法一 · 徽章 + 链接插件页（推荐）', 'Option 1 · badge linked to the plugin page (recommended)')}</b>
  <pre style="margin:8px 0"><code id="bcode1">[![DSH Insights health](https://dsh-insights.com/badge/owner/repo.svg)](https://dsh-insights.com/p/owner/repo/)</code></pre>
  <b style="font-size:12.5px">${t('写法二 · 纯徽章', 'Option 2 · badge only')}</b>
  <pre style="margin:8px 0"><code id="bcode2">![DSH Insights health](https://dsh-insights.com/badge/owner/repo.svg)</code></pre>
  <p style="margin-top:8px"><button id="bcopy" style="padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:var(--track);color:var(--ink);font-size:12.5px;cursor:pointer">${t('复制写法一', 'Copy option 1')}</button> <span id="bcopied" style="font-size:12px;color:var(--ok)"></span></p>
</div>

<h2 style="font-size:16px;margin:28px 0 8px">${t('说明与边界', 'Notes & Boundaries')}</h2>
<div class="lede">${langBlock(
  '徽章内容随每日快照自动更新（GitHub 图片缓存最长一天）；分数掉档不需要你改任何代码。启发式评估 ≠ 安全审计；徽章 404 = 仓库不在当前权威集（可能是门禁未过或校验未覆盖，可到 <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">仓库</a> 提 issue 查询/申诉）。想先本地自查，可用 <a href="../kit/">dsh-insights-kit</a> 自带的命令行：<code>npx dsh-insights-kit selfcheck &lt;插件目录&gt;</code>——按同一套规则现场体检，每条扣分附修复指引，退出码可直接做 CI 门禁。',
  'Badge content updates automatically with the daily snapshot (GitHub image caching may lag up to a day); a grade drop requires no code change on your side. Heuristic evaluation ≠ security audit; a badge 404 means the repo is not in the current authoritative set (the gate may not have passed, or validation has not covered it — open an issue on the <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">repo</a> to ask or appeal). To self-check locally first, use the CLI bundled with <a href="../kit/">dsh-insights-kit</a>: <code>npx dsh-insights-kit selfcheck &lt;plugin-dir&gt;</code> — the same rulebook, every deduction with fix guidance, and an exit code you can gate CI on.'
)}</div>
<script>
(function(){
  var __t=window.__t||function(zh,en){return document.documentElement.dataset.lang==='en'?en:zh};
  var inp=document.getElementById('brepo'),prev=document.getElementById('bprev'),
      c1=document.getElementById('bcode1'),c2=document.getElementById('bcode2'),
      btn=document.getElementById('bcopy'),ok=document.getElementById('bcopied');
  function norm(v){ v=(v||'').trim().replace(/^https?:\\/\\/github\\.com\\//,'').replace(/\\/+$/,''); return /^[\\w.-]+\\/[\\w.-]+$/.test(v)?v:null }
  function upd(){ var r=norm(inp.value);
    if(!r){ prev.innerHTML='<span style="color:var(--faint);font-size:12.5px">'+__t('输入后预览徽章','Enter a repo to preview the badge')+'</span>'; return }
    prev.textContent='';
    var img=document.createElement('img');
    img.src='../badge/'+r+'.svg'; img.style.height='22px'; img.alt=r+' badge';
    img.onerror=function(){ prev.innerHTML='<span style="font-size:12px;color:var(--warn)">'+__t('该仓库暂未收录权威集（徽章 404）——可能门禁未过或校验未覆盖','This repo is not in the authoritative set yet (badge 404) — the gate may not have passed, or validation has not covered it')+'</span>' };
    prev.appendChild(img);
    c1.textContent='[![DSH Insights health](https://dsh-insights.com/badge/'+r+'.svg)](https://dsh-insights.com/p/'+r+'/)'
    c2.textContent='![DSH Insights health](https://dsh-insights.com/badge/'+r+'.svg)' }
  inp.addEventListener('input',upd);
  document.addEventListener('langchange',function(){ if(!norm(inp.value))upd() });
  btn.addEventListener('click',function(){
    (navigator.clipboard?navigator.clipboard.writeText(c1.textContent):Promise.reject()).then(function(){ ok.textContent=__t('已复制 ✓','Copied ✓') }).catch(function(){ ok.textContent=__t('请手动复制','Copy manually') });
    setTimeout(function(){ ok.textContent='' },2000) });
})();
</script>`,
  })))

  // ---- / 首页（全站汇总门户 · 激活版：搜索直达 + KPI + 最新入库 + 场景速配） ----
  const an0 = JSON.parse(read('analysis.json') || '{}')
  const t0 = an0.totals || {}
  const cov0 = an0.coverage || {}
  const gr0 = an0.quality?.grades || {}
  const dist0 = an0.distribution || {}
  const dyn0 = JSON.parse(read('dynamics.json') || 'null')
  const latestRel = dyn0?.dsh?.releases?.[0]
  const distTags = dyn0?.dsh?.npm?.distTags || {}
  const latestWk = weekly[0]
  const wkBullets = latestWk ? (latestWk.md.split('## 本期速览')[1] || '').split('\n').filter((l) => l.startsWith('- ')).slice(0, 5).map((l) => mdToHtml(l)).join('') : ''
  const saN = (gr0.S ?? 0) + (gr0.A ?? 0)
  const saPct = t0.authoritative ? Math.round((saN / t0.authoritative) * 1000) / 10 : null
  const fresh6 = [...plugAll].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6)
  const freshCards = fresh6.map((p) => { const fg = enBy.get(p.full_name)?.grade; return `<a class="card" href="/p/${escHtml(p.full_name)}/" style="text-decoration:none;color:inherit;display:block" title="${escHtml(p.full_name)}">
<b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--mono);font-size:12.5px">${fg ? `<span class="grade ${escHtml(fg)}">${escHtml(fg)}</span> ` : ''}${escHtml(p.full_name)}</b>
<p>★ ${p.stars || 0} · ${t('入库', 'added')} ${escHtml((p.created_at || '').slice(0, 10))}</p>
<p style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(stripEmoji(p.description).slice(0, 64)) || t('（无描述）', '(No description)')}</p></a>` }).join('')
  const sceneCards = scenarios.slice(0, 6).map((s) => {
    const top = (s.plugins || [])[0]
    return `<a class="card" href="scenarios/#sc-${escHtml(s.id)}" style="text-decoration:none;color:inherit;display:block"><b>${t(s.zh, s.en)}</b>${top ? `<p style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--mono);font-size:12px"><span class="grade ${escHtml(top.grade)}">${escHtml(top.grade)}</span> ${escHtml(top.full_name)}</p>` : ''}<p>${t(`${(s.plugins || []).length} 个推荐位 · ${s.candidates ?? '?'} 候选`, `${(s.plugins || []).length} picks · ${s.candidates ?? '?'} candidates`)}</p><p style="color:var(--accent);font:600 12px var(--mono);margin-top:8px">${t('看质量首选 →', 'See top picks →')}</p></a>`
  }).join('')
  // ---- 首页栏目摘要：数字条 / 动态 feed / 榜单 / 作者榜（全部复用上文聚合，随小时级刷新变化）----
  const d7ms = 7 * 86400000
  const new7 = plugAll.filter((p) => p.created_at && nowMs - new Date(p.created_at).getTime() < d7ms).length
  const act7 = plugAll.filter((p) => p.pushed_at && nowMs - new Date(p.pushed_at).getTime() < d7ms).length
  const brk30 = (dyn0?.dsh?.releases || []).filter((r) => r.breaking && r.published_at && nowMs - new Date(r.published_at).getTime() < d30ms).length
  const pulse = [
    [new7, t('本周新入库', 'new this week')],
    [act7, t('本周有提交', 'pushed this week')],
    [upRows.length, t('最新快照版本升级', 'upgrades in latest diff')],
    [brk30, t('30 天 BREAKING', 'BREAKING in 30d')],
  ].map(([n, label]) => `<a href="dynamics/" style="text-decoration:none;color:inherit;flex:1;min-width:140px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card)"><b class="mono" style="font-size:20px">${n}</b> <span style="color:var(--mut);font-size:12px">${label}</span></a>`).join('')
  const feedPeek = feed.slice(0, 8).map((e) => {
    const tg = tagOf[e.tag] || { zh: e.tag, en: e.tag, c: 'var(--faint)' }
    return `<div class="scrow"><div style="display:flex;align-items:baseline;gap:8px;min-width:0"><span style="flex:none;font:600 10.5px var(--mono);color:${tg.c};border:1px solid ${tg.c};border-radius:99px;padding:0 7px">${t(tg.zh, tg.en)}</span><a href="${e.url}"${e.ext ? ' target="_blank"' : ''}>${escHtml(e.obj)}</a><span style="flex:none;margin-left:auto;color:var(--faint);font:11px var(--mono)">${relTime(e.d)}</span></div>${e.sub ? `<span class="meta" style="color:var(--mut)">${e.sub}</span>` : ''}</div>`
  }).join('')
  const lbRow = (i, href, name, right, ext) => `<div class="scrow" style="flex-direction:row;align-items:baseline;gap:8px"><span class="mono" style="color:var(--faint);flex:none;width:16px">${i + 1}</span><a href="${href}"${ext ? ' target="_blank"' : ''}>${escHtml(name)}</a><span class="meta" style="margin-left:auto;flex:none">${right}</span></div>`
  const topScore = [...enrichAll].filter((x) => typeof x.score === 'number').sort((a, b) => b.score - a.score || (b.stars || 0) - (a.stars || 0)).slice(0, 5)
  const scoreRows = topScore.map((p, i) => lbRow(i, `/p/${escHtml(p.full_name)}/`, p.full_name, `<span class="grade ${escHtml(p.grade)}">${escHtml(p.grade)}</span> ${p.score} · ★${(p.stars || 0).toLocaleString()}`)).join('')
  const starRowsH = (an0.topByStars || []).slice(0, 5).map((s2, i) => lbRow(i, `/p/${escHtml(s2.repo)}/`, s2.repo, `★ ${(s2.stars || 0).toLocaleString()}${s2.published ? ' · npm' : ''}`)).join('')
  const topAuthors = [...(an0.authors || [])].sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 5)
  const authorRowsH = topAuthors.map((a2, i) => lbRow(i, 'authors/', a2.owner, `★${(a2.stars || 0).toLocaleString()} · ${t(`${a2.plugins} 个插件`, `${a2.plugins} plugins`)}`)).join('')
  const ico = (name, size = 15) => `<span style="display:inline-block;vertical-align:-2px">${icon(name, size)}</span>`
  const navCard = (href, ic, name, desc, stat) => `<a class="card" href="${href}" style="text-decoration:none;color:inherit;display:block"><b>${ico(ic)} ${name}</b><p>${desc}</p><p style="color:var(--accent);font:600 12px var(--mono);margin-top:8px">${stat}</p></a>`
  written.push(out('index.html', page({
    title: 'DSH Insights · DeepSeek Harness 全景观察站', titleEn: 'DSH Insights · The DeepSeek Harness Observatory', desc: '插件健康 · 官方动态 · 生态趋势——全量、客观、可复核的 DSH 生态观测。',
    base: './', here: '',
    body: `
<div style="padding:48px 0 28px;border-bottom:1px solid var(--line)">
  <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="var(--ink)"/><path d="M25 16H16v32h9" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M39 16h9v32h-9" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="38.75" y="18" width="3.5" height="26" rx="1.75" fill="#4D6BFE"/><circle cx="30.5" cy="35" r="6.5" fill="none" stroke="#4D6BFE" stroke-width="3.5"/></svg>
  <h1 class="pagetitle" style="font-size:clamp(30px,4.6vw,44px);margin-top:18px">DSH Insights</h1>
  <p class="lede" style="font-size:16px;margin-bottom:6px">DeepSeek Harness Plugin Ecosystem · <b>${t('全景观察站', 'The Observatory')}</b> — ${t('插件健康 · 官方动态 · 生态趋势', 'Plugin health · official dynamics · ecosystem trends')}</p>
  <p class="lede">${t('全量发现 → manifest 门禁逐条校验 → 六维框架客观评分（可复核、非安全审计）。开放数据 + 生态周报 + 官方动态雷达，面向插件作者、使用者和 dsh 官方。', 'Full discovery → item-by-item manifest-gate verification → objective scoring on a six-dimension framework (verifiable, not a security audit). Open data + weekly ecosystem report + official-dynamics radar, for plugin authors, users, and the dsh team.')}</p>
  <div class="hnum"><b class="count mono" data-v="${t0.authoritative ?? 0}">0</b><span>${t('权威插件', 'Authoritative plugins')}<br>${t('manifest 门禁逐条校验 · 断点续跑滚动扩大', 'Verified item by item via the manifest gate · rolling, resumable growth')}</span></div>
  <div class="hmeta"><span>${t('快照', 'Snapshot')} <b class="mono">${escHtml((an0.generatedAt || '').slice(0, 10))}</b></span><span>${t('多源候选', 'Multi-source candidates')} <b class="mono">${(cov0.candidates ?? 14081).toLocaleString()}</b></span><span>${t('topic 宇宙', 'Topic universe')} <b class="mono">${(cov0.topicUniverse?.count ?? 0).toLocaleString()}</b></span><span>S+A <b class="mono">${saN}</b></span><span>${t('周报', 'Weekly')} <b class="mono">${weekly.length} ${t('期', 'issues')}</b></span></div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:22px;max-width:760px">
    <span style="color:var(--faint);flex:none">${icon('search', 17)}</span>
    <input id="home-q" type="text" ${ph(`搜索 ${(t0.authoritative || 0).toLocaleString()}+ 插件…`, `Search ${(t0.authoritative || 0).toLocaleString()}+ plugins…`)} autocomplete="off"
      style="flex:1;min-width:220px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:14px;outline:none;background:var(--card);color:var(--ink)">
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
    <a class="wkbtn" style="background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600" href="dashboard/#browse">${t(`浏览插件库（${(t0.authoritative || 0).toLocaleString()} 个权威插件）→`, `Browse the directory (${(t0.authoritative || 0).toLocaleString()} authoritative plugins) →`)}</a>
    <a class="wkbtn" style="border-color:var(--accent);color:var(--accent);font-weight:600" href="kit/">${t('✦ 生态助手插件', '✦ The Kit')}</a>
    <a class="wkbtn" href="weekly/">${t('读生态周报', 'Read the Weekly')}</a>
    <a class="wkbtn" href="feed.xml">${t('订阅 RSS', 'Subscribe via RSS')}</a>
    <a class="wkbtn" href="badge/">${t('作者接入徽章', 'Badge Setup for Authors')}</a>
  </div>
</div>
<style>
.hnum{margin-top:30px;display:flex;align-items:baseline;gap:14px}
.hnum .count{font-size:clamp(46px,6vw,66px);font-weight:700;letter-spacing:-.04em;line-height:1;color:var(--ink)}
.hnum>span{color:var(--mut);font-size:13px;line-height:1.55}
.hmeta{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;color:var(--faint);font-size:12.5px}
.hmeta b{color:var(--mut);font-weight:600}
</style>
<script>(function(){document.querySelectorAll('.count[data-v]').forEach(function(el){var v=+el.dataset.v,s0=null,d=900;function step(ts){if(!s0)s0=ts;var p=Math.min(1,(ts-s0)/d),e2=1-Math.pow(1-p,3);el.textContent=Math.round(v*e2).toLocaleString('en-US');if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)})})()</script>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:22px">
  <div class="card"><b class="mono" style="font-size:22px">${(t0.authoritative || 0).toLocaleString()}</b><p>${t('权威插件（manifest 门禁）', 'Authoritative plugins (manifest gate)')}</p></div>
  <div class="card"><b class="mono" style="font-size:22px;color:#7c3aed">${saN}<span style="font-size:13px;color:var(--mut)"> · ${saPct != null ? saPct + '%' : '—'}</span></b><p>${t('S+A 级（≥90 分）及占比', 'S+A grade (≥90) and share')}</p></div>
  <div class="card"><b class="mono" style="font-size:22px">${(t0.active7Pct ?? 0)}%</b><p>${t(`近 7 天活跃（30 天 ${t0.active30Pct ?? '—'}%）`, `Active in 7d (30d ${t0.active30Pct ?? '—'}%)`)}</p></div>
  <div class="card"><b class="mono" style="font-size:22px">${dist0.publishPct ?? '—'}%</b><p>${t(`npm 发布率（${(dist0.publish?.published ?? 0).toLocaleString()} 已发布）`, `npm publish rate (${(dist0.publish?.published ?? 0).toLocaleString()} published)`)}</p></div>
  <div class="card"><b class="mono" style="font-size:22px">${(cov0.candidates || 0).toLocaleString()}</b><p>${t('多源候选（topic∪策展∪npm）', 'Multi-source candidates (topic ∪ curated ∪ npm)')}</p></div>
  <div class="card"><b class="mono" style="font-size:22px">${weekly.length}</b><p>${t('周报期数（每周五更新）', 'Weekly issues (published Fridays)')}</p></div>
</div>
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">${pulse}</div>
<h2 style="font-size:16px;margin:30px 0 10px">${t('最新动态', 'Latest Activity')} <span style="color:var(--faint);font-weight:400;font-size:12px">${t('新插件 · 版本升级 · 官方发布 · 平台仓库', 'New plugins · upgrades · official releases · platform repos')} · <a href="dynamics/">${t('全部动态 →', 'All activity →')}</a></span></h2>
<div class="sc-cols">
  <div class="card" style="margin:0"><b>${ico('radar')} ${t('生态动态', 'Ecosystem Feed')}</b>${feedPeek || `<p style="color:var(--faint);font-size:12px">${t('暂无', 'None yet')}</p>`}
    <p style="margin-top:10px"><a href="dynamics/">${t('按标签筛选的完整时间线 →', 'Full timeline with tag filters →')}</a></p>
  </div>
  <div class="card" style="margin:0"><b>${ico('mail')} ${t('本周速览', 'This Week')} · ${latestWk ? escHtml(latestWk.slug) : ''}</b>
    ${latestWk ? `<div class="article" style="font-size:13px">${wkBullets}</div><p style="margin-top:10px"><a href="weekly/#${latestWk.slug}">${t('读全文（可导出 Markdown/PDF/图片）→', 'Read the full report (export Markdown/PDF/PNG) →')}</a></p>` : `<p>${t('生成中', 'Generating')}</p>`}
  </div>
</div>
<h2 style="font-size:16px;margin:30px 0 10px">${t('榜单速览', 'Leaderboards')} <span style="color:var(--faint);font-weight:400;font-size:12px">${t('客观评分 · 社区关注', 'Objective score · community attention')} · <a href="dashboard/#rank">${t('完整榜单 →', 'Full leaderboards →')}</a></span></h2>
<div class="sc-cols">
  <div class="card" style="margin:0"><b>${ico('star')} ${t('质量首选（健康分）', 'Top by Health Score')}</b>${scoreRows}
    <p style="margin-top:10px"><a href="dashboard/#rank">${t('发布健康 · 值得收录等更多榜单 →', 'More boards: release health, worth-listing →')}</a></p>
  </div>
  <div class="card" style="margin:0"><b>${ico('star')} ${t('社区关注（星数）', 'Most Starred')}</b>${starRowsH}
    <p style="margin-top:10px"><a href="dashboard/#rank">${t('完整星榜 →', 'Full star board →')}</a></p>
  </div>
</div>
<h2 style="font-size:16px;margin:30px 0 10px">${t('场景速配', 'Scenario Quick Picks')} <span style="color:var(--faint);font-weight:400;font-size:12px">${t('从「我要做什么」出发', 'Start from "what I want to do"')} · <a href="scenarios/">${t(`全部 ${scenarios.length} 个场景 →`, `All ${scenarios.length} scenarios →`)}</a></span></h2>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">${sceneCards}</div>
<div class="sc-cols" style="margin-top:26px">
  <div class="card" style="margin:0"><b>${ico('users')} ${t('活跃作者', 'Top Authors')}</b>${authorRowsH}
    <p style="margin-top:10px"><a href="authors/">${t('作者榜与协作关系图 →', 'Author boards & collaboration graph →')}</a></p>
  </div>
  <div class="card" style="margin:0"><b>${ico('radar')} ${t('官方动态', 'Official Dynamics')}</b>
    ${latestRel ? `<p style="margin-top:8px;font-size:13px">${t('最新 release：', 'Latest release: ')}<a href="https://github.com/deepseek-ai/DeepSeek-Harness/releases/tag/${escHtml(latestRel.tag)}" target="_blank"><b>${escHtml(latestRel.tag)}</b></a>（${escHtml((latestRel.published_at || '').slice(0, 10))}${latestRel.breaking ? ' · <span style="color:var(--warn)">' + t('含 breaking 说明', 'includes breaking notes') + '</span>' : ''}）</p>${latestRel.summary ? `<p style="font-size:12.5px;color:var(--mut);margin-top:6px">${escHtml(latestRel.summary)}</p>` : ''}` : ''}
    <p style="font-size:12.5px;color:var(--mut);margin-top:8px">npm dist-tags：${Object.entries(distTags).map(([k, v]) => `${k}=${v}`).join(' · ')}</p>
    <p style="margin-top:10px"><a href="dynamics/">${t('官方动态与 rc 兼容信号 →', 'Official dynamics & rc compatibility signal →')}</a></p>
  </div>
</div>
<h2 style="font-size:16px;margin:30px 0 10px">${t('最新入库', 'New Arrivals')} <span style="color:var(--faint);font-weight:400;font-size:12px">${t('按仓库创建时间 · 每日快照刷新', 'By repo creation date · refreshed with the daily snapshot')}</span></h2>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">${freshCards}</div>
<h2 style="font-size:16px;margin:30px 0 10px">${t('全站导览', 'Site Map')}</h2>
<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">
  ${navCard('dashboard/', 'plugin', t('插件', 'Plugins'), t('生态全景一站看：趋势 · 质量分布 · 榜单 + 全量插件库（搜索/筛选/排序，点进详情看扣分明细）', 'The ecosystem in one place: trends · quality distribution · leaderboards + the full directory (search/filter/sort; open a detail page for deductions)'), t(`${(t0.authoritative || 0).toLocaleString()} 个 · 均分 ${an0.quality?.avgScore ?? '—'} · S+A ${saN}`, `${(t0.authoritative || 0).toLocaleString()} plugins · avg ${an0.quality?.avgScore ?? '—'} · S+A ${saN}`))}
  ${navCard('scenarios/', 'tag', t('场景组合推荐', 'Scenario Picks'), t('从「我要做什么」出发选插件：质量首选 + 新入场', 'Pick plugins by "what I want to do": top picks + new arrivals'), t(`${scenarios.length} 个场景`, `${scenarios.length} scenarios`))}
  ${navCard('kit/', 'radar', t('生态助手插件', 'The Kit'), t('把观察站装进 DSH：插件体检 · 装前查验 · 场景发现 · 作者自检', 'The observatory inside DSH: checkup · pre-install check · scenario picks · author self-check'), 'dsh-insights-kit')}
  ${navCard('weekly/', 'mail', t('生态周报', 'Weekly'), t('双栏阅读器 · 可导出 Markdown/PDF/图片 · RSS', 'Two-pane reader · export Markdown/PDF/PNG · RSS'), t(`${weekly.length} 期 · 每周五`, `${weekly.length} issues · every Friday`))}
  ${navCard('dynamics/', 'radar', t('官方动态', 'Dynamics'), t('dsh releases/dist-tags · DeepSeek 平台 · rc 兼容信号', 'dsh releases/dist-tags · DeepSeek platform · rc compatibility signal'), latestRel ? escHtml(latestRel.tag) : '—')}
  ${navCard('authors/', 'users', t('作者榜', 'Authors'), t('生态里的重要人物：榜单 + 协作关系图', 'Key people of the ecosystem: leaderboards + collaboration graph'), t(`${(an0.authorStats?.total || 0).toLocaleString()} 位`, `${(an0.authorStats?.total || 0).toLocaleString()} authors`))}
  ${navCard('badge/', 'star', t('健康徽章', 'Badge'), t('把客观评分带进 README：一页接入指南', 'Bring the objective score into your README: a one-page setup guide'), t('health-v5 · 每日刷新', 'health-v5 · refreshed daily'))}
  ${navCard('data/', 'database', t('开放数据', 'Open Data'), t('稳定 JSON URL · agent 可读 · CC BY 4.0', 'Stable JSON URLs · agent-friendly · CC BY 4.0'), t('insights.json 等 13 个数据集', '13 datasets incl. insights.json'))}
  ${navCard('about/', 'book', t('关于 · 指标体系', 'About · Metrics'), t('方法论全公开：权威集门禁 · 六维框架 · 校准回归', 'Methodology in the open: authoritative-set gate · six-dimension framework · calibration regression'), t('可复核到每条扣分', 'Every deduction is verifiable'))}
</div>
<script>
// 首页搜索：回车直达仪表盘插件库（#browse?q=… 由 dashboard 脚本解析）
(function(){ var q=document.getElementById('home-q'); if(!q)return;
  q.addEventListener('keydown',function(ev){ if(ev.key!=='Enter')return;
    var v=q.value.trim(); if(v) location.href='/dashboard/#browse?q='+encodeURIComponent(v); }); })();
// 旧锚点兼容：/#browse?… 与 /#overview 等仪表盘区块 → /dashboard/
(function(){ var h=location.hash||'';
  if(h.indexOf('#browse')===0){ location.replace('/dashboard/'+h) }
  else if(/^#(overview|quality|rank)/.test(h)){ location.replace('/dashboard/'+h) } })();
</script>`,
  })))

  // ---- /about/ 关于 · 方法论与指标体系 --------------------------------------
  written.push(out('about/index.html', page({
    title: '关于', titleEn: 'About', desc: 'DSH Insights 是什么、指标体系、评估口径与边界声明。',
    base: '../', here: 'about/',
    body: `<p class="crumb">About</p><h1 class="pagetitle">${t('关于 · 方法论与指标体系', 'About · Methodology & Metrics')}</h1>
<p class="lede">${t('我们把口径公开到可以被反驳的程度——这是策展人和官方敢引用我们的前提。', 'We publish our definitions to the point where they can be falsified — that is the precondition for curators and the dsh team to cite us.')}</p>
<div class="article">
${langBlock(`
<h2>关于 DSH Insights</h2>
<p>DeepSeek Harness 的<b>生态与动态全景观察站</b>，三层：L1 插件洞察（真伪判定 → 权威集 → 健康分 → 收录矩阵）、L2 官方动态（releases/rc 节奏 + rc 兼容雷达，建设中）、L3 生态报告（「致作者的信」与生态周报）。我们不做目录、不做市场、不做榜单——只提供可引用、可复核的数据与观测，<b>被生态吸收而非与之竞争</b>。独立个人项目，与 DeepSeek 官方无隶属关系；数据、规则、管线全部开源（<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>），发现误判请提 issue。</p>
<h2>权威集门禁</h2>
<p>非 fork / 非归档 · <code>package.json</code> 声明 <code>dsh.bundle.patch</code> · patch 文件已提交。这是下限口径：纯 tarball 分发的插件会进入分桶人工复核（<code>invalid.jsonl</code>）。</p>
<h2>覆盖与完整性（为什么权威集 ≪ topic 总数）</h2>
<p>GitHub <code>topic:dsh-plugin</code> 是官方唯一发现机制，<b>打标即入、零门槛</b>——其中混有大量蹭标、无关仓库、fork、monorepo 子路径与已删除仓库。我们的漏斗：<b>topic 宇宙（≈13.7k，首页漏斗实时口径）→ 多源候选（topic 分片全量抓取 + 策展目录 + npm 映射，去重）→ manifest 门禁逐条校验 → 权威集 + 分桶</b>。权威集是「货真价实可按官方 bundle 形态安装」的下限子集；<code>no-dsh-bundle</code> / <code>no-package.json</code> 桶里的候选可能是插件但形态非标，留待人工复核而不是混入权威集。校验按 API 预算<b>滚动推进、断点续跑</b>，权威集随每次快照扩大——<b>覆盖率数字本身也公开</b>（首页覆盖漏斗），这就是我们对「完整性」的回答方式：不报大数，报可核验的数。</p>
<h2>插件评估指标体系（六维框架 v1）</h2>
<p>每个插件从六个维度考察：<b>计分四维</b>进入总分（100 起扣 · fail −20 / 较重 −10 / 中 −5 / 轻 −2，当前 health-v5），<b>展示两维</b>只呈现不进分，<b>兼容性</b>为预留维度。阈值：<span class="grade S">S ≥ 95</span> <span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>；插件详情页可见各维度子分（dimScores）。</p>
<table>
<tr><th>维度</th><th>指标项</th><th>计分处理</th></tr>
<tr><td>工程质量</td><td>client 导出 · main=lib 布局 · files 白名单 · npm 发布 · 版本一致</td><td><b>计分</b></td></tr>
<tr><td>文档完整性</td><td>README（唯一的 fail 级）· 中文/双语文档 · LICENSE</td><td><b>计分</b></td></tr>
<tr><td>可发现性</td><td>dsh-plugin topic（计分）· 批量模板导入账号（计分）· 策展收录（只展示）</td><td><b>部分计分</b></td></tr>
<tr><td>维护活跃</td><td>仓库年龄 · 30 天无提交 · 一次性导入无维护（npm ≥2 版本豁免）</td><td><b>计分</b></td></tr>
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
<p>数据、规则、管线全部开源：<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>。发现误判请提 issue —— 争议工单本身是公信力指标（见上表 C 组）。产品版本与发布记录见<a href="../changelog/">更新日志</a>。</p>
`, `
<h2>About DSH Insights</h2>
<p>An <b>ecosystem and dynamics observatory</b> for DeepSeek Harness (DSH), in three layers: L1 plugin insights (authenticity check → authoritative set → health score → listing matrix), L2 official dynamics (release/rc cadence + an rc compatibility radar, under construction), and L3 ecosystem reports (letters to authors and the weekly ecosystem report). We don't build a directory, a marketplace, or a leaderboard — we provide citable, verifiable data and observations, <b>meant to be absorbed by the ecosystem rather than compete with it</b>. This is an independent personal project with no affiliation to DeepSeek; the data, rules, and pipeline are all open source (<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>) — please open an issue if you spot a misjudgment.</p>
<h2>The Authoritative Set Gate</h2>
<p>Not a fork, not archived · <code>package.json</code> declares <code>dsh.bundle.patch</code> · the patch file is committed. This is a lower-bound definition: plugins distributed as pure tarballs fall into bucketed manual review (<code>invalid.jsonl</code>).</p>
<h2>Coverage & Completeness (why the authoritative set ≪ the topic total)</h2>
<p>GitHub's <code>topic:dsh-plugin</code> is the official discovery mechanism — <b>tag and you're in, zero barrier</b> — so it is full of tag squatters, unrelated repos, forks, monorepo subpaths, and deleted repos. Our coverage funnel: <b>topic universe (≈13.7k; see the live funnel on the home page) → multi-source candidates (full topic shard crawl + curated lists + npm mapping, deduplicated) → item-by-item manifest-gate verification → authoritative set + buckets</b>. The authoritative set is the lower-bound subset that is "genuinely installable in the official bundle form"; candidates in the <code>no-dsh-bundle</code> / <code>no-package.json</code> buckets may be plugins in a non-standard shape, held for manual review rather than mixed into the authoritative set. Verification <b>rolls forward within an API budget and is resumable</b>, so the authoritative set grows with every snapshot — <b>and the coverage numbers themselves are public</b> (the coverage funnel on the home page). That is how we answer "completeness": not with a big number, but with a verifiable one.</p>
<h2>Plugin Evaluation Metrics (six-dimension framework v1)</h2>
<p>Every plugin is examined on six dimensions: <b>four scored dimensions</b> feed the total (start at 100 · fail −20 / major −10 / moderate −5 / minor −2; currently health-v5), <b>two display dimensions</b> are shown but never scored, and <b>compatibility</b> is a reserved dimension. Quality grades: <span class="grade S">S ≥ 95</span> <span class="grade A">A ≥ 90</span> <span class="grade B">B ≥ 75</span> <span class="grade C">C ≥ 60</span> <span class="grade D">D</span>; per-dimension subscores (dimScores) are visible on each plugin's detail page.</p>
<table>
<tr><th>Dimension</th><th>Signals</th><th>Scoring</th></tr>
<tr><td>Engineering quality</td><td>client export · main=lib layout · files whitelist · published to npm · version consistency</td><td><b>Scored</b></td></tr>
<tr><td>Docs completeness</td><td>README (the only fail-level signal) · Chinese/bilingual docs · LICENSE</td><td><b>Scored</b></td></tr>
<tr><td>Discoverability</td><td>dsh-plugin topic (scored) · batch template-import accounts (scored) · curated listings (display only)</td><td><b>Partially scored</b></td></tr>
<tr><td>Maintenance activity</td><td>repo age · no commits in 30 days · one-shot import with no maintenance (npm ≥2 versions exempt)</td><td><b>Scored</b></td></tr>
<tr><td>Safety hygiene</td><td>write surface / render sanitization (deep-scan sampling; heuristic ≠ audit)</td><td>Incremental signal, <b>not scored</b></td></tr>
<tr><td>Adoption</td><td>★ · npm weekly downloads · listing channels</td><td><b>Display only</b> (gameable/pollutable)</td></tr>
<tr><td>Compatibility</td><td>engines.dsh declaration (only ~1% of plugins declare it) · API symbols × rc changelog (M2 radar)</td><td>Reserved, not yet measured</td></tr>
</table>
<p>Principles: purely objective signals · stars never scored · what cannot be probed is never fabricated or deducted (missing is shown explicitly) · every deduction carries evidence · community ratings will never be introduced. Full rules and changelog: <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/SCHEMA.md" target="_blank">SCHEMA §health</a>.</p>
<h2>Calibration</h2>
<p>Known genuine/fake plugins are compiled into a calibration set; every snapshot runs a regression (<code>pipeline/validate/regress.mjs</code>), and if the regression is not 100% the week's snapshot is not published. Any definition change must bump the rule version and be recorded in the changelog.</p>
<h2>Metrics (how we measure ourselves)</h2>
<p>North star: <b>our data/reports being adopted by the ecosystem</b> — directories, marketplaces, or the dsh team citing our scores, observations, or compatibility warnings. Around it, six metric groups:</p>
<table>
<tr><th>Group</th><th>Question it answers</th><th>Key metrics</th></tr>
<tr><td>A Coverage</td><td>Are we complete?</td><td>authoritative set size · full topic coverage rate · candidate pool freshness</td></tr>
<tr><td>B Freshness</td><td>Do we update often?</td><td>snapshot lag ≤7 days (≤1 day with daily CI) · CI success rate</td></tr>
<tr><td>C Credibility</td><td>Are scores trusted?</td><td>calibration regression pass rate (target 100%) · dispute issues and time-to-resolution · missing-data annotation rate</td></tr>
<tr><td>D Content engine</td><td>Is the engine running?</td><td>consecutive weekly issues (a gap is an alert) · letter coverage · author feedback count</td></tr>
<tr><td>E Reach</td><td>Are we seen?</td><td>repos deploying the badge · repo ★ / reposts · site visits</td></tr>
<tr><td>F Adoption</td><td>The north star, counted</td><td>directories/marketplaces citing or integrating our data · rc warnings accepted via PR · official touchpoints</td></tr>
</table>
<p>Red lines: two consecutive missed weekly issues → the content line stops new features and fixes the pipeline first; calibration regression below 100% → the week's snapshot is not published; adoption stuck at zero long-term → triggers a go/pivot/kill review. Full definitions: <a href="https://github.com/ice5kysl/dsh-insights/blob/main/docs/PRODUCT-DESIGN.md" target="_blank">PRODUCT-DESIGN §4</a>.</p>
<h2>Boundary Statement</h2>
<p>Heuristic evaluation ≠ security audit. No community ratings or voting, no install hosting or transactions, no logged-in product. The deep scan (write surface / sanitization) is an incremental signal and is labeled separately.</p>
<h2>Site Analytics (privacy disclosure)</h2>
<p>This site uses <a href="https://umami.is" target="_blank">Umami</a> (open source, cookieless, collects no personal information) to measure page visits and referrers — it feeds metric group E above. Coverage/content/reach metrics are also appended weekly to <code>data/metrics.jsonl</code>, public in the repo. No other tracking of any kind.</p>
<h2>Verifiability</h2>
<p>Data, rules, and pipeline are all open source: <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub</a>. If you spot a misjudgment, open an issue — dispute tickets are themselves a credibility metric (group C above). Product versions and releases: <a href="../changelog/">Changelog</a>.</p>
`)}
</div>`,
  })))

  // ---- /changelog/ 产品版本与发布记录 ---------------------------------------
  const changelog = JSON.parse(read('changelog.json') || '{"releases":[]}')
  const typeMeta = {
    feat: ['功能', 'Feature', 'var(--accent)'],
    fix: ['修复', 'Fix', 'var(--warn)'],
    data: ['数据', 'Data', 'var(--ok)'],
    ci: ['管线', 'Pipeline', '#7c3aed'],
    breaking: ['Breaking', 'Breaking', 'var(--err)'],
  }
  const relHtml = (changelog.releases || []).map((r) => `
<div class="card" style="margin:14px 0">
  <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
    <b style="font:700 17px var(--mono)">${escHtml(r.version)}</b>
    <span style="color:var(--faint);font:12px var(--mono)">${escHtml(r.date)}</span>
    <span style="font-weight:650">${t(r.title?.zh || '', r.title?.en || '')}</span>
  </div>
  ${r.summary ? `<p style="color:var(--mut);font-size:13px;margin:8px 0 4px">${t(r.summary.zh, r.summary.en)}</p>` : ''}
  <div>${(r.items || []).map((it) => { const m = typeMeta[it.type] || typeMeta.feat
    return `<div class="listrow" style="padding:9px 2px"><span style="display:inline-flex;gap:8px;align-items:baseline;min-width:0;flex:1"><span class="pill" style="margin:0;flex:none;color:${m[2]};border-color:${m[2]}">${t(m[0], m[1])}</span><span>${t(it.zh, it.en)}</span></span></div>` }).join('')}</div>
</div>`).join('')
  written.push(out('changelog/index.html', page({
    title: '更新日志', titleEn: 'Changelog', desc: 'DSH Insights 产品版本与阶段性发布记录（随 git tag 发布）。',
    base: '../', here: null,
    body: `<p class="crumb">Changelog</p><h1 class="pagetitle">${t('更新日志', 'Changelog')}</h1>
<p class="lede">${t('产品版本与阶段性发布记录（随 git tag 发布）。每日数据快照的滚动更新不在此列——那是管线常态。', 'Product versions and milestone releases (tagged in git). Daily rolling data snapshots are not listed here — that is the pipeline norm.')}</p>
${relHtml || `<p class="lede">${t('暂无发布记录', 'No releases yet')}</p>`}`,
  })))

  // ---- /kit/ 生态助手插件（dsh-insights-kit）介绍与使用指南 -------------------
  const kitCaps = [
    ['我的插件体检', 'My Plugins Checkup', '列出你已安装的插件，逐个标注健康等级与分数；npm 有新版本时提醒升级；dsh 官方发布 breaking 版本时给出适配预警；低分插件给出同类更优替代。', 'Lists your installed plugins with health grades and scores, warns when npm has newer versions, alerts on official breaking releases, and points to better alternatives for low-grade plugins.'],
    ['装前查验', 'Pre-install Check', '输入插件名（或粘贴 GitHub 链接）→ 健康卡：S–D 等级、百分制分数、四维子分、逐条扣分明细，一键跳到完整详情页。', 'Type a plugin name (or paste a GitHub link) → a health card: S–D grade, 0–100 score, four dimension sub-scores, and itemized deductions, with a link to the full detail page.'],
    ['场景发现', 'Scenario Picks', '从「我想做什么」出发浏览 22 个场景的推荐插件——按健康分客观排序，不卖「最好」叙事。', 'Browse picks across 22 scenarios starting from "what I want to do" — ranked by objective health score, no "best" narrative for sale.'],
    ['作者自检（CLI）', 'Author Self-check (CLI)', '随包附带的命令行：npx dsh-insights-kit selfcheck <目录>，按 health-v5 规则书体检本地插件目录（manifest / 文档 / 工程成熟度 + 只读面安全扫描），每条扣分附修复指引；退出码可直接当 CI pre-publish 门禁。', 'A CLI ships with the package: npx dsh-insights-kit selfcheck <dir> runs the health-v5 rulebook against a local plugin directory (manifest / docs / engineering maturity plus a read-only-surface scan), every deduction with fix guidance; the exit code doubles as a CI pre-publish gate.'],
  ]
  written.push(out('kit/index.html', page({
    title: '生态助手插件', titleEn: 'The Kit', desc: 'dsh-insights-kit：装在 DSH 里的生态助手——插件体检、装前查验、场景发现、作者自检。',
    base: '../', here: 'kit/',
    body: `<p class="crumb">Kit</p><h1 class="pagetitle">dsh-insights-kit <span style="color:var(--faint);font-weight:400;font-size:16px">${t('生态助手插件', 'the ecosystem assistant')}</span></h1>
<p class="lede">${t('把 DSH Insights 的数据装进 DeepSeek Harness：侧栏「✦ 生态」一个入口，服务两类人——帮用户做「装什么、留什么、升不升」的决策，帮作者在发布前打磨作品。瘦客户端，数据全部来自本站的开放数据集。', 'DSH Insights inside DeepSeek Harness: one sidebar entry ("✦ 生态") serving two audiences — helping users decide what to install, keep and upgrade, and helping authors polish their plugins before release. A thin client over this site\u2019s open datasets.')}</p>
<div class="cards">${kitCaps.map(([zh, en, dzh, den]) => `<div class="card"><b>${t(zh, en)}</b><p>${t(dzh, den)}</p></div>`).join('')}</div>
<h2 style="font-size:16px;margin:28px 0 8px">${t('安装', 'Install')}</h2>
<div class="article">${langBlock(
`<p><b>方式一 · npm</b>：<code>npm install dsh-insights-kit</code> 后在 DSH web profile 启用。</p><p><b>方式二 · 源码</b>：<code>git clone https://github.com/ice5kysl/dsh-insights-kit</code>，然后 <code>bash scripts/install-personal.sh</code>（构建并装入个人 DSH）。</p><p>装好后点左侧栏底部的 <b>✦ 生态</b> 按钮打开面板。</p>`,
`<p><b>Option 1 · npm</b>: <code>npm install dsh-insights-kit</code>, then enable it in the DSH web profile.</p><p><b>Option 2 · source</b>: <code>git clone https://github.com/ice5kysl/dsh-insights-kit</code>, then <code>bash scripts/install-personal.sh</code> (builds and installs into your personal DSH).</p><p>After install, click the <b>✦ 生态</b> button at the bottom of the sidebar to open the panel.</p>`
)}</div>
<h2 style="font-size:16px;margin:28px 0 8px">${t('隐私与数据', 'Privacy & Data')}</h2>
<div class="article">${langBlock(
`<p>插件本身零后端：生态数据只读自 <a href="../data/">dsh-insights.com 开放数据集</a>（CC BY 4.0，host 面缓存 6 小时）；「作者自检」是随包的本地 CLI（<code>npx dsh-insights-kit selfcheck</code>），目录扫描<b>只读且不出本机</b>。不收集任何使用数据。</p>`,
`<p>The plugin has no backend of its own: ecosystem data is read-only from the <a href="../data/">dsh-insights.com open datasets</a> (CC BY 4.0, cached 6h by the host face); the author self-check is a local CLI shipped with the package (<code>npx dsh-insights-kit selfcheck</code>) — directory scans are <b>read-only and never leave your machine</b>. No usage data is collected.</p>`
)}</div>
<h2 style="font-size:16px;margin:28px 0 8px">${t('相关', 'Related')}</h2>
<div class="cards">
  <a class="card" href="https://github.com/ice5kysl/dsh-insights-kit" target="_blank" style="text-decoration:none;color:inherit"><b>GitHub ↗</b><p>${t('源码、issue、安装脚本', 'Source, issues, install scripts')}</p></a>
  <a class="card" href="../badge/" style="text-decoration:none;color:inherit"><b>${t('健康徽章', 'Health Badge')}</b><p>${t('自检通过后，把徽章挂进你的 README', 'After your self-check passes, put the badge in your README')}</p></a>
</div>
<p class="lede" style="margin-top:14px">${t('dogfooding 说明：本插件按 DSH 官方 bundle 规范开发，同样被 DSH Insights 管线收录与评分——你可以在', 'Dogfooding note: this plugin is built to the official DSH bundle spec and is itself indexed and scored by the DSH Insights pipeline — you can watch its own grade on')} <a href="https://github.com/ice5kysl/dsh-insights-kit" target="_blank">${t('它的仓库与（即将上线的）详情页', 'its repo and (soon) its own detail page')}</a>${t('上看到它自己的等级。', '.')}</p>`,
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
  <description>DeepSeek Harness 插件生态周报：每周五 CI 自动生成（W36 前为历史补档），数据可复核。</description>
  <language>zh-CN</language>
${items}
</channel>
</rss>
`))

  // llms.txt：单一来源为仓库根 llms.txt（pages.yml 部署时拷入 public/），此处不再生成（P2-1）

  // ---- robots.txt + sitemap.xml（B4：SEO 地基；lastmod 用快照日保持确定性） ----
  const snapAt = String(JSON.parse(read('analysis.json') || '{}').generatedAt || new Date().toISOString()).slice(0, 10)
  written.push(out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`))
  const walkHtml = (dir, prefix = '') => {
    const files = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) files.push(...walkHtml(join(dir, e.name), prefix + e.name + '/'))
      else if (e.name.endsWith('.html')) files.push(prefix + e.name)
    }
    return files
  }
  const smLocs = walkHtml(SITE).sort().map((p) => `${ORIGIN}/${p.replace(/(^|\/)index\.html$/, '')}`)
  written.push(out('sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    smLocs.map((loc) => `  <url><loc>${loc}</loc><lastmod>${snapAt}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`))
  console.log(`[pages] robots.txt + sitemap.xml（${smLocs.length} URLs）`)

  console.log(`[pages] ${written.length} 个产物：`)
  for (const w of written) console.log('  -', w)
}

main()
