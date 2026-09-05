#!/usr/bin/env node
/**
 * Stage 4 — generate the professional static analysis dashboard (site/index.html).
 *
 * Self-contained (no external assets): KPI cards, charts (donut/bars), npm
 * drift & star leader panels, and a sortable/filterable/paginated plugin
 * table — all computed server-side from data/analysis.json + data/plugins.jsonl.
 *
 * @module dsh-plugin-insights/stage-4
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'site', 'index.html')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function main() {
  const plugins = readFileSync(join(ROOT, 'data', 'plugins.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  let a = {}
  try { a = JSON.parse(readFileSync(join(ROOT, 'data', 'analysis.json'), 'utf8')) } catch { /* ok */ }
  const t = a.totals || {}
  const d = a.distribution || {}
  const pub = d.publish || {}
  const doc = d.docs || {}
  const lib = d.lib || {}
  const months = Object.entries(t.byMonth || {}).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).slice(-12)

  // ---- compact rows for the table -------------------------------------
  const rows = plugins.map((r) => [
    r.full_name, r.html_url || '', r.stars || 0, (r.created_at || '').slice(0, 10),
    r.npm?.published ? (r.npm.latest || '✓') : '', r.metrics?.hasZhDocs ? 1 : 0,
    r.files?.libIndex && r.files?.libClient ? 1 : 0, r.metrics?.active30 ? 1 : 0,
    (r.description || '').slice(0, 110),
  ])
  const dataJson = JSON.stringify(rows).replace(/</g, '\\u003c')

  // ---- helpers for charts ----------------------------------------------
  const maxM = Math.max(1, ...months.map(([, c]) => c))
  const monthBars = months.map(([m, c]) =>
    `<div class="mbar"><span class="mbar-l">${m}</span><div class="mbar-t"><div class="mbar-f" style="width:${Math.max(2, Math.round((c / maxM) * 100))}%"></div></div><span class="mbar-v">${c}</span></div>`).join('')

  const donut = (parts, size = 118, sw = 21) => {
    const r = (size - sw) / 2
    const circ = 2 * Math.PI * r
    const total = parts.reduce((s2, p) => s2 + p.v, 0) || 1
    let off = 0
    const segs = parts.map((p) => {
      const len = Math.max(0, (p.v / total) * circ)
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`
      off += len
      return el
    }).join('')
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">${segs}<circle cx="${size / 2}" cy="${size / 2}" r="${r * 0.72}" fill="var(--card)"/></svg>`
  }
  const donutPublish = donut([{ v: pub.published, c: '#2d66f7' }, { v: pub.unpublished, c: '#e2e8f0' }])
  const donutDocs = donut([
    { v: doc.both, c: '#0e9f6e' },
    { v: Math.max(0, doc.zh - doc.both), c: '#0ea5e9' },
    { v: Math.max(0, doc.readme - doc.zh), c: '#94a3b8' },
    { v: doc.none, c: '#e2e8f0' },
  ])

  const topicBars = (a.topTopics || []).slice(0, 8).map((x) => {
    const w = Math.max(3, Math.round((x.count / ((a.topTopics || [])[0]?.count || 1)) * 100))
    return `<div class="hbar"><span class="hbar-l" title="${esc(x.topic)}">${esc(x.topic)}</span><div class="hbar-t"><div class="hbar-f" style="width:${w}%"></div></div><span class="hbar-v">${x.count}</span></div>`
  }).join('')

  const staleRows = (a.npmStaleTop || []).map((s2) =>
    `<tr><td><a href="https://github.com/${esc(s2.repo)}" target="_blank">${esc(s2.repo)}</a></td><td class="num">${s2.stars}</td><td class="num warn">${s2.repoVersion} → ${s2.npmLatest}</td></tr>`).join('')
  const starRows = (a.topByStars || []).map((s2) =>
    `<tr><td><a href="https://github.com/${esc(s2.repo)}" target="_blank">${esc(s2.repo)}</a></td><td class="num">★ ${s2.stars}</td><td class="ok">${s2.published ? 'npm ✓' : '—'}</td><td class="ok">${s2.zh ? '中/双语 ✓' : '—'}</td></tr>`).join('')

  const kpi = (v, l, sub = '') => `<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ''}</div>`

  const date = (a.generatedAt || '').slice(0, 10)

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>dsh 插件生态洞察 · dsh-plugin-insights</title>
<meta name="description" content="DeepSeek Harness (dsh) 插件生态全量索引、评估与分析仪表盘">
<style>
:root{
  --bg:#f5f6fa;--card:#ffffff;--ink:#0f172a;--mut:#64748b;--line:#e6e9f0;--brand:#2d66f7;
  --shadow:0 1px 2px rgba(15,23,42,.04),0 10px 30px -14px rgba(15,23,42,.14)
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.88);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.brand .dot{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#2d66f7,#7c3aed);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:800}
.brand small{color:var(--mut);font-weight:500;font-size:12px}
.nav a{color:var(--mut);margin-left:16px;font-size:13px}
.hero{background:linear-gradient(135deg,#15215e,#2d66f7 60%,#6d3fd1);color:#fff;padding:34px 0 30px}
.hero h1{margin:0 0 6px;font-size:25px;letter-spacing:.2px}
.hero p{margin:0;opacity:.86;font-size:14px}
.hero .meta{margin-top:14px;display:flex;flex-wrap:wrap;gap:20px;font-size:12.5px;opacity:.94}
.hero .meta b{font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:20px 0 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}
.kpi-v{font-size:23px;font-weight:800;letter-spacing:-.3px;color:var(--brand)}
.kpi-l{font-weight:600;font-size:13px;margin-top:2px}
.kpi-s{color:var(--mut);font-size:11.5px}
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;margin-top:16px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:16px 18px}
.panel h2{margin:0 0 4px;font-size:15px;font-weight:700}
.panel .sub{color:var(--mut);font-size:12px;margin:0 0 12px}
.span-5{grid-column:span 5}.span-6{grid-column:span 6}.span-7{grid-column:span 7}.span-12{grid-column:span 12}
.mbar,.hbar{display:flex;align-items:center;gap:8px;margin:6px 0}
.mbar-l,.hbar-l{width:62px;flex:none;color:var(--mut);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mbar-t,.hbar-t{flex:1;background:#eef1f6;border-radius:6px;height:12px;overflow:hidden}
.mbar-f{height:100%;border-radius:6px;background:linear-gradient(90deg,#2d66f7,#7c3aed)}
.hbar-f{height:100%;border-radius:6px;background:linear-gradient(90deg,#0ea5e9,#2d66f7)}
.mbar-v,.hbar-v{width:40px;text-align:right;font-weight:600;font-size:12px;flex:none}
.legend{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--mut)}
.legend b{color:var(--ink)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.donutwrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;font-size:12.5px}
.ptable th,.ptable td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
.ptable th{color:var(--mut);font-weight:600;cursor:pointer;user-select:none;background:var(--card)}
.ptable th:hover{color:var(--brand)}
.ptable td.num{text-align:right;font-variant-numeric:tabular-nums}
.ptable td.desc{white-space:normal;max-width:340px;color:var(--mut)}
.ok{color:#0e9f6e}.warn{color:#d97706}.dim{color:var(--mut)}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.toolbar input{flex:1;min-width:200px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;font-size:13px;outline:none}
.toolbar input:focus{border-color:var(--brand)}
.chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer;color:var(--mut)}
.chip.on{background:#eef2ff;border-color:#c7d2fe;color:var(--brand);font-weight:600}
.pager{display:flex;align-items:center;gap:12px;margin-top:12px;justify-content:center;color:var(--mut);font-size:12.5px}
.pager button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:5px 12px;cursor:pointer}
.pager button:disabled{opacity:.4;cursor:default}
.datalinks{margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}
.datalinks a{font-size:12.5px;border:1px solid #c7d2fe;color:var(--brand);background:#f5f7ff;border-radius:9px;padding:6px 12px}
footer{margin:26px 0 44px;color:var(--mut);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media (max-width:960px){.span-5,.span-6,.span-7,.span-12{grid-column:span 12}}
@media (prefers-color-scheme:dark){
  :root{--bg:#0b1220;--card:#121b2e;--ink:#e6edf7;--mut:#8ea0bc;--line:#22314d}
  .topbar{background:rgba(11,18,32,.88)}
  .chip.on{background:#1b2a55;border-color:#3b55a8}
  .mbar-t,.hbar-t{background:#1c2a44}
}
</style>
</head>
<body>
<div class="topbar"><div class="wrap">
  <div class="brand"><span class="dot">d</span><div>dsh 插件生态洞察<small> · dsh-plugin-insights</small></div></div>
  <div class="nav"><a href="#charts">洞察</a><a href="#rank">榜单</a><a href="#table">数据表</a><a href="https://github.com/ice5kysl/dsh-plugin-insights" target="_blank">GitHub ↗</a></div>
</div></div>

<div class="hero"><div class="wrap">
  <h1>DeepSeek Harness 插件生态 · 全量索引与质量评估</h1>
  <p>多源发现 → manifest 真伪校验 → 元数据评估（npm / 文档 / 双语文档 / 构建产物 / 活跃度）→ 生态洞察</p>
  <div class="meta"><span>权威插件 <b>${t.authoritative ?? 0}</b></span><span>快照 <b>${date}</b></span><span><a style="color:#c7d2fe" href="https://github.com/ice5kysl/dsh-plugin-insights/blob/main/README.md" target="_blank">方法论 ↗</a></span></div>
</div></div>

<div class="wrap">
  <div class="kpis">
    ${kpi(t.authoritative ?? 0, '权威插件数', '通过 dsh.bundle manifest 校验')}
    ${kpi(d.publishPct != null ? d.publishPct + '%' : '—', 'npm 发布率', `${pub.published} 已发布 · ${pub.stale} 滞后`)}
    ${kpi(d.zhPct != null ? d.zhPct + '%' : '—', '中/双语文档', `${doc.both} 双文档 · ${doc.zhFile} 中文文件`)}
    ${kpi(doc.none ?? 0, '无 README', '建议补充基本文档')}
    ${kpi(lib.both ?? 0, 'host+client 双产物', `index ${lib.index} · client ${lib.client}`)}
    ${kpi((t.active30Pct ?? 0) + '%', '近 30 天活跃', '生态活跃信号')}
  </div>

  <div class="grid" id="charts">
    <div class="panel span-7">
      <h2>权威集月度新增</h2><p class="sub">按仓库创建时间 · 最近 12 个月</p>
      ${monthBars || '<div class="dim">数据积累中…</div>'}
    </div>
    <div class="panel span-5">
      <h2>npm 发布分布</h2><p class="sub">已发布 vs 未发布</p>
      <div class="donutwrap">${donutPublish}<div class="legend">
        <div><i style="background:#2d66f7"></i>已发布 <b>${pub.published ?? 0}</b></div>
        <div><i style="background:#e2e8f0"></i>未发布 <b>${pub.unpublished ?? 0}</b></div>
        <div style="color:#d97706">版本滞后 ${pub.stale ?? 0}</div>
      </div></div>
    </div>
    <div class="panel span-6">
      <h2>文档覆盖</h2><p class="sub">双语文档 / 中文 / 仅英文 / 无</p>
      <div class="donutwrap">${donutDocs}<div class="legend">
        <div><i style="background:#0e9f6e"></i>中/双语 <b>${doc.both ?? 0}</b></div>
        <div><i style="background:#0ea5e9"></i>含中文内容 <b>${Math.max(0, (doc.zh ?? 0) - (doc.both ?? 0))}</b></div>
        <div><i style="background:#94a3b8"></i>仅英文 <b>${Math.max(0, (doc.readme ?? 0) - (doc.zh ?? 0))}</b></div>
        <div><i style="background:#e2e8f0"></i>无 README <b>${doc.none ?? 0}</b></div>
      </div></div>
    </div>
    <div class="panel span-6">
      <h2>Top topics</h2><p class="sub">仓库自声明 topic（Top 8）</p>
      ${topicBars || '<div class="dim">暂无</div>'}
    </div>
    <div class="panel span-6" id="rank">
      <h2>npm 版本滞后榜</h2><p class="sub">仓库已领先于 npm 发布（Top 10）</p>
      <table><thead><tr><th>仓库</th><th style="text-align:right">★</th><th style="text-align:right">仓库 → npm</th></tr></thead><tbody>${staleRows || '<tr><td class="dim">暂无</td></tr>'}</tbody></table>
    </div>
    <div class="panel span-6">
      <h2>Star 榜 Top 10</h2><p class="sub">社区关注度最高的权威插件</p>
      <table><thead><tr><th>仓库</th><th style="text-align:right">★</th><th>npm</th><th>中/双语</th></tr></thead><tbody>${starRows || '<tr><td class="dim">暂无</td></tr>'}</tbody></table>
    </div>

    <div class="panel span-12" id="table">
      <h2>全量插件表</h2>
      <p class="sub">搜索 / 筛选 / 点击表头排序 · 已加载 ${plugins.length} 个权威插件</p>
      <div class="toolbar">
        <input id="q" placeholder="搜索仓库名 / 描述…" autocomplete="off">
        <button class="chip on" data-npm="">全部 npm</button><button class="chip" data-npm="pub">已发布</button><button class="chip" data-npm="unpub">未发布</button><button class="chip" data-npm="stale">版本滞后</button>
        <button class="chip" data-zh="0">中/双语</button>
        <button class="chip" data-active="1">近 30 天活跃</button>
      </div>
      <div style="overflow:auto;max-height:560px">
      <table class="ptable">
        <thead><tr>
          <th data-k="0">仓库</th><th data-k="2" class="num">★</th><th data-k="3">创建</th><th data-k="4">npm</th><th data-k="5">中/双语</th><th data-k="6">双产物</th><th data-k="7">活跃</th><th>描述</th>
        </tr></thead>
        <tbody id="tb"></tbody>
      </table></div>
      <div class="pager"><button id="prev">‹ 上一页</button><span id="info"></span><button id="next">下一页 ›</button></div>
      <div class="datalinks">
        <a href="../data/plugins.jsonl" target="_blank">⬇ plugins.jsonl</a>
        <a href="../data/plugins.csv" target="_blank">⬇ plugins.csv</a>
        <a href="../data/invalid.jsonl" target="_blank">⬇ invalid.jsonl（噪声分桶）</a>
      </div>
    </div>
  </div>

  <footer>
    <span>由 <a href="https://github.com/ice5kysl/dsh-plugin-insights" target="_blank">dsh-plugin-insights</a> 管线自动生成 · ${date}</span>
    <span>零依赖 · GitHub API + npm · 启发式评估，非安全审计</span>
  </footer>
</div>

<script>
const ROWS=${dataJson};
const $=s=>document.querySelector(s);
let q='',npm='',zh='',act='',sort=-1,desc=false,page=0,PAGE=120;
function filtered(){
  let r=ROWS;
  if(q){const t=q.toLowerCase();r=r.filter(x=>(x[0]+' '+x[8]).toLowerCase().includes(t))}
  if(npm==='pub')r=r.filter(x=>x[4]);if(npm==='unpub')r=r.filter(x=>!x[4]);if(npm==='stale')r=r.filter(x=>x[4]);
  if(zh==='1')r=r.filter(x=>x[5]);if(act==='1')r=r.filter(x=>x[7]);
  if(sort>=0){r=r.slice().sort((a,b)=>{const va=a[sort],vb=b[sort];const c=typeof va==='number'&&typeof vb==='number'?va-vb:String(va).localeCompare(String(vb));return desc?-c:c})}
  return r;
}
const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function draw(){
  const list=filtered(),pages=Math.ceil(list.length/PAGE)||1;
  page=Math.min(page,pages-1);
  const seg=list.slice(page*PAGE,(page+1)*PAGE);
  $('#tb').innerHTML=seg.map(r=>'<tr><td><a href="'+e(r[1])+'" target="_blank">'+e(r[0])+'</a></td><td class="num">'+r[2]+'</td><td>'+r[3]+'</td><td>'+(r[4]?'<span class="ok">'+e(r[4])+'</span>':'<span class="dim">—</span>')+'</td><td>'+(r[5]?'✓':'')+'</td><td>'+(r[6]?'✓':'')+'</td><td>'+(r[7]?'✓':'')+'</td><td class="desc">'+e(r[8])+'</td></tr>').join('')||'<tr><td colspan="8" class="dim">无匹配</td></tr>';
  $('#info').textContent='第 '+(page+1)+'/'+pages+' 页 · 共 '+list.length+' 条';
  $('#prev').disabled=page===0;$('#next').disabled=page>=pages-1;
}
$('#q').addEventListener('input',e=>{q=e.target.value;page=0;draw()});
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
  if(c.dataset.npm!==undefined){npm=c.dataset.npm;document.querySelectorAll('[data-npm]').forEach(x=>x.classList.toggle('on',x===c))}
  if(c.dataset.zh!==undefined){zh=(zh==='1'?'':'1');document.querySelectorAll('[data-zh]').forEach(x=>x.classList.toggle('on',zh==='1'))}
  if(c.dataset.active!==undefined){act=(act==='1'?'':'1');c.classList.toggle('on',act==='1')}
  page=0;draw();
}));
document.querySelectorAll('.ptable th[data-k]').forEach(th=>th.addEventListener('click',()=>{const k=+th.dataset.k;if(sort===k)desc=!desc;else{sort=k;desc=false}page=0;draw()}));
$('#prev').onclick=()=>{page--;draw()};$('#next').onclick=()=>{page++;draw()};
draw();
</script>
</body>
</html>`
  mkdirSync(join(ROOT, 'site'), { recursive: true })
  writeFileSync(OUT, html)
  console.log(`[site] ${plugins.length} rows → site/index.html (${(html.length / 1024).toFixed(0)} KB)`)
}

main()
