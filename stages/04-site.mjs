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
  let enrich = []
  try { enrich = JSON.parse(readFileSync(join(ROOT, 'data', 'enrich.json'), 'utf8')) } catch { /* ok */ }
  const enMap = new Map(enrich.map((x) => [x.full_name, x]))
  const byStars = plugins.slice().sort((x, y) => (y.stars || 0) - (x.stars || 0))
  const peersOf = (full) => {
    const cat = enMap.get(full)?.category
    if (!cat) return []
    return byStars.filter((o) => o.full_name !== full && enMap.get(o.full_name)?.category === cat).slice(0, 5)
      .map((o) => ({ repo: o.full_name, url: o.html_url, stars: o.stars }))
  }
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
    enMap.get(r.full_name)?.grade || '',
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


  const gCol = { A: '#0e9f6e', B: '#2d66f7', C: '#d97706', D: '#dc2626' }
  const gMax = Math.max(1, ...Object.keys(gCol).map((k) => a.quality?.grades?.[k] || 0))
  const gradesHtml = Object.keys(gCol).map((k) => {
    const c = a.quality?.grades?.[k] || 0
    return '<div class="hbar"><span class="hbar-l">' + k + '</span><div class="hbar-t"><div class="hbar-f" style="width:' + Math.max(2, Math.round((c / gMax) * 100)) + '%;background:' + gCol[k] + '"></div></div><span class="hbar-v">' + c + '</span></div>'
  }).join('')
  const catsMax = Math.max(1, ...(a.categories || []).map((x) => x.count))
  const catsHtml = (a.categories || []).slice(0, 8).map((x) =>
    '<div class="hbar"><span class="hbar-l" title="' + esc(x.category) + '">' + esc(x.category) + '</span><div class="hbar-t"><div class="hbar-f" style="width:' + Math.max(2, Math.round((x.count / catsMax) * 100)) + '%"></div></div><span class="hbar-v">' + x.count + '</span></div>').join('')

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

.scrim{position:fixed;inset:0;background:rgba(9,14,32,.45);opacity:0;pointer-events:none;transition:opacity .2s;z-index:40}
.scrim.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(480px,94vw);background:var(--card);z-index:41;transform:translateX(102%);transition:transform .24s ease;box-shadow:-12px 0 40px rgba(9,14,32,.3);overflow:auto;display:flex;flex-direction:column}
.drawer.on{transform:none}
.dd-head{position:sticky;top:0;background:linear-gradient(135deg,#15215e,#2d66f7);color:#fff;padding:16px 18px 12px}
.dd-title{font-size:15px;font-weight:700;word-break:break-all;padding-right:28px}
.dd-close{position:absolute;top:12px;right:12px;background:rgba(255,255,255,.18);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px}
.dd-body{padding:14px 18px 36px}
.dd-sec{margin-top:18px}
.dd-sec h3{margin:0 0 8px;font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.dd-desc{font-size:13px}
.dd-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
.dd-kpi{background:#f2f5fb;border:1px solid var(--line);border-radius:10px;padding:8px 10px;text-align:center}
.dd-kpi b{display:block;font-size:16px}
.dd-kpi span{font-size:10.5px;color:var(--mut)}
.chipset{display:flex;flex-wrap:wrap;gap:6px}
.chipset span{background:#eef2ff;color:#2d66f7;border-radius:999px;padding:2px 9px;font-size:11.5px}
.flag{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:8px;padding:3px 8px;font-size:12px;margin:0 6px 6px 0}
.flag b{color:#0e9f6e}
.dd-table{width:100%;font-size:12.5px;border-collapse:collapse}
.dd-table td{padding:4px 0;border-bottom:1px solid var(--line)}
.dd-table td:last-child{text-align:right;color:var(--mut)}
.ptable tbody tr{cursor:pointer}
.linkrow{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.linkrow a{border:1px solid #c7d2fe;background:#f5f7ff;color:#2d66f7;border-radius:8px;padding:5px 11px;font-size:12px}
.loading{color:var(--mut);font-size:12px}
@media(prefers-color-scheme:dark){.dd-kpi{background:#16213a}.chipset span{background:#1b2a55;color:#93b4ff}.linkrow a{background:#16213a;border-color:#3b55a8}}
.g{display:inline-block;min-width:20px;text-align:center;font-weight:800;border-radius:6px;padding:1px 6px;font-size:11.5px;background:#eef2ff;color:#2d66f7}
.peer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.peer .num{color:var(--mut);font-size:11.5px}
.qual{display:flex;align-items:center;gap:12px}
.qual .big{font-size:34px;font-weight:800;line-height:1}
.qualbar{height:8px;border-radius:6px;background:#eef1f6;margin-top:10px;overflow:hidden}
.qualbar i{display:block;height:100%;background:linear-gradient(90deg,#2d66f7,#0e9f6e)}
@media(prefers-color-scheme:dark){.g{background:#1b2a55;color:#93b4ff}.qualbar{background:#1c2a44}}
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
    ${kpi(a.quality?.avgScore ?? '—', '平均质量分', `A+B ${a.quality?.gradePct ?? 0}%`)}
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
      <h2>质量分级（启发式评分）</h2><p class="sub">平均分 ${a.quality?.avgScore ?? 0} · A+B ${a.quality?.gradePct ?? 0}%</p>
      ${gradesHtml}
    </div>
    <div class="panel span-6">
      <h2>功能分类（启发式）</h2><p class="sub">按名称/描述归类 · Top 8</p>
      ${catsHtml}
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
          <th data-k="0">仓库</th><th data-k="2" class="num">★</th><th data-k="3">创建</th><th data-k="4">npm</th><th data-k="5">中/双语</th><th data-k="6">双产物</th><th data-k="7">活跃</th><th>质量</th><th>描述</th>
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


<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-hidden="true">
  <div class="dd-head"><div class="dd-title" id="dd-title"></div><button class="dd-close" id="dd-close" title="关闭">✕</button></div>
  <div class="dd-body" id="dd-body"></div>
</aside>
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
  $('#tb').innerHTML=seg.map(r=>'<tr data-repo="'+e(r[0])+'" data-url="'+e(r[1])+'"><td><a href="'+e(r[1])+'" target="_blank">'+e(r[0])+'</a></td><td class="num">'+r[2]+'</td><td>'+r[3]+'</td><td>'+(r[4]?'<span class="ok">'+e(r[4])+'</span>':'<span class="dim">—</span>')+'</td><td>'+(r[5]?'✓':'')+'</td><td>'+(r[6]?'✓':'')+'</td><td>'+(r[7]?'✓':'')+'</td><td>'+(r[9]?'<span class="g">'+e(r[9])+'</span>':'')+'</td><td class="desc">'+e(r[8])+'</td></tr>').join('')||'<tr><td colspan="9" class="dim">无匹配</td></tr>';
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

// ---- plugin detail drawer ----
function escA(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var detCache=null;
function detMap(){ if(!detCache){ detCache=fetch('plugins-detail.json').then(function(r){return r.ok?r.json():[]}).then(function(arr){var m={};arr.forEach(function(d){m[d.full_name]=d});return m}).catch(function(){return {}}) } return detCache }
function ddK(l,v){return '<div class="dd-kpi"><b>'+escA(v)+'</b><span>'+l+'</span></div>'}
function ddRow(k,v){return '<tr><td>'+k+'</td><td>'+v+'</td></tr>'}
function ddFlag(ok,l){return '<span class="flag"'+(ok?'':' style="opacity:.42"')+'><b>'+(ok?'✓':'·')+'</b> '+escA(l)+'</span>'}
function loadHist(repo,d){
  var h=$('#dd-hist'); if(!h) return;
  if(d.pkgName){
    fetch('https://registry.npmjs.org/'+encodeURIComponent(d.pkgName).replace(/%40/g,'@')).then(function(r){return r.ok?r.json():null}).then(function(doc){
      if(!doc||!doc.time){h.innerHTML='<div class="dim">无 npm 版本历史</div>';return}
      var vs=[];for(var k in doc.time){if(/^\d/.test(k))vs.push({v:k,t:(doc.time[k]||'').slice(0,10)})}
      vs.sort(function(a,b){return a.t<b.t?-1:a.t>b.t?1:0}).reverse();
      h.innerHTML='<table class="dd-table">'+vs.slice(0,8).map(function(x){return ddRow('<span class="warn">'+escA(x.v)+'</span>',escA(x.t))}).join('')+'</table>'+(vs.length>8?'<div class="dim" style="font-size:11px;margin-top:4px">共 '+vs.length+' 个版本 · 最早 '+escA(vs[vs.length-1].t)+'</div>':'')
    }).catch(function(){h.innerHTML='<div class="dim">版本历史不可用</div>'})
  } else {
    fetch('https://api.github.com/repos/'+encodeURIComponent(repo)+'/releases?per_page=6').then(function(r){return r.ok?r.json():null}).then(function(rel){
      if(!rel||!rel.length){h.innerHTML='<div class="dim">无 GitHub Release（或未发布 / 接口限流）</div>';return}
      h.innerHTML='<table class="dd-table">'+rel.map(function(x){return ddRow(escA(x.tag_name||x.name),(x.published_at||'').slice(0,10))}).join('')+'</table>'
    }).catch(function(){h.innerHTML='<div class="dim">Release 历史不可用</div>'})
  }
}
function openDrawer(repo){
  $('#dd-title').textContent=repo;
  var b=$('#dd-body');b.innerHTML='<div class="loading">加载详情…</div>';
  $('#drawer').classList.add('on');$('#scrim').classList.add('on');document.body.style.overflow='hidden';
  detMap().then(function(m){
    var d=m[repo]; if(!d){b.innerHTML='<div class="dd-sec"><h3>详情</h3><div class="dd-desc">暂无本地详情（可能晚于当前快照）。</div></div>';return}
    var flags='<div class="dd-sec"><h3>清单与构建产物</h3>'+ddFlag(d.files.rd,'README')+ddFlag(d.files.zh,'中文 README')+ddFlag(d.files.lic,'LICENSE')+ddFlag(d.files.cp,'cordis.patch.yml')+ddFlag(d.files.idx,'lib/index.js')+ddFlag(d.files.cli,'lib/client.js')+(d.hasClientExport?ddFlag(true,'exports["./client"]'):'')+'</div>'
    var npmHtml=d.npm&&d.npm.pub
      ? '<table class="dd-table">'+ddRow('latest','<span class="ok">'+escA(d.npm.latest)+'</span>')+ddRow('发布版本数',d.npm.versions)+ddRow('最近发布',escA((d.npm.latestTime||'').slice(0,10)||'—'))+'</table>'+(d.version&&d.npm.latest&&d.npm.latest!==d.version?'<div class="warn" style="font-size:12px;margin-top:6px">⚠ 版本滞后：仓库 '+escA(d.version)+' vs npm '+escA(d.npm.latest)+'</div>':'')
      : '<div class="dim">未发布到 npm</div>'
    b.innerHTML=''
      +'<div class="dd-sec"><h3>描述</h3><div class="dd-desc">'+escA(d.desc||'—')+'</div>'+(d.topics&&d.topics.length?'<div class="chipset" style="margin-top:10px">'+d.topics.map(function(t){return '<span>'+escA(t)+'</span>'}).join('')+'</div>':'')+'</div>'
      +'<div class="dd-kpis">'+ddK('★',d.stars)+ddK('fork',d.forks)+ddK('仓库年龄',Math.round(d.ageDays)+' 天')+'</div>'
      +'<div class="dd-sec"><h3>npm</h3>'+npmHtml+'</div>'
      +flags
      +'<div class="dd-sec"><h3>质量评分（启发式）</h3><div class="qual"><div class="big" style="color:'+(d.grade==='A'?'#0e9f6e':d.grade==='B'?'#2d66f7':d.grade==='C'?'#d97706':'#dc2626')+'">'+escA(d.grade||'—')+'</div><div class="meta">'+escA(d.score!=null?d.score+' / 100':'未评分')+'<br>分类：'+escA(d.category||'其它')+'</div></div><div class="qualbar"><i style="width:'+escA(d.score!=null?d.score:0)+'%"></i></div></div>'
  +'<div class="dd-sec"><h3>同类插件 · 同分类按 ★</h3>'+(d.peers&&d.peers.length?'<div>'+d.peers.map(function(p){return '<div class="peer"><a href="'+escA(p.url)+'" target="_blank">'+escA(p.repo)+'</a><span class="num">★ '+p.stars+'</span></div>'}).join('')+'</div>':'<div class="dim">暂无同类</div>')+'</div>'+'<div class="dd-sec"><h3>仓库</h3><table class="dd-table">'+ddRow('创建',escA((d.created||'').slice(0,10)))+ddRow('最近 push',escA((d.pushed||'').slice(0,10)))+ddRow('默认分支',escA(d.branch||'—'))+ddRow('数据来源',escA(d.source||'—'))+'</table><div class="linkrow"><a href="'+escA(d.url)+'" target="_blank">GitHub ↗</a>'+(d.pkgName?'<a href="https://www.npmjs.com/package/'+escA(d.pkgName)+'" target="_blank">npm ↗</a>':'')+'</div></div>'
      +'<div class="dd-sec"><h3>版本历史</h3><div id="dd-hist" class="loading">加载中…</div></div>';
    loadHist(repo,d);
  })
}
function closeDrawer(){$('#drawer').classList.remove('on');$('#scrim').classList.remove('on');document.body.style.overflow=''}
$('#dd-close').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;
document.addEventListener('keydown',function(ev){if(ev.key==='Escape')closeDrawer()});
$('#tb').addEventListener('click',function(ev){ if(ev.target.closest('a'))return; var tr=ev.target.closest('tr[data-repo]'); if(tr)openDrawer(tr.getAttribute('data-repo')) });

draw();
</script>
</body>
</html>`
  mkdirSync(join(ROOT, 'site'), { recursive: true })
  writeFileSync(OUT, html)
  // ---- per-plugin detail file for the drawer (keeps index.html light) ----
  const detail = plugins.map((r) => ({
    full_name: r.full_name,
    url: r.html_url || '',
    stars: r.stars || 0,
    forks: r.forks || 0,
    created: r.created_at || '',
    pushed: r.pushed_at || '',
    branch: r.default_branch || '',
    source: r.source || '',
    license: r.license || null,
    topics: r.topics || [],
    desc: (r.description || '').slice(0, 600),
    pkgName: r.pkgName || null,
    version: r.version || null,
    dshPlatform: r.eval?.dshPlatform || null,
    hasClientExport: Boolean(r.eval?.hasClientExport),
    files: {
      cp: Boolean(r.files?.cordisPatch), idx: Boolean(r.files?.libIndex), cli: Boolean(r.files?.libClient),
      rd: Boolean(r.files?.readme), zh: Boolean(r.files?.readmeZh), lic: Boolean(r.files?.license),
    },
    ageDays: r.metrics?.ageDays ?? 0,
    active30: Boolean(r.metrics?.active30),
    score: enMap.get(r.full_name)?.score ?? null,
    grade: enMap.get(r.full_name)?.grade ?? null,
    category: enMap.get(r.full_name)?.category || null,
    peers: peersOf(r.full_name),
    npm: r.npm || { pub: false },
  }))
  writeFileSync(join(ROOT, 'site', 'plugins-detail.json'), JSON.stringify(detail))
  console.log(`[site] ${plugins.length} rows → site/index.html (${(html.length / 1024).toFixed(0)} KB) + plugins-detail.json (${(JSON.stringify(detail).length / 1024).toFixed(0)} KB)`)
}

main()
