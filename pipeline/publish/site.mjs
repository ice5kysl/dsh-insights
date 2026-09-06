#!/usr/bin/env node
/**
 * pipeline/publish · site — generate the static analysis dashboard (site/index.html).
 *
 * Self-contained (no external assets). Single-page narrative layout:
 * hero stat → 生态趋势 (weekly area chart) → 质量 → 榜单 → 插件库 (full
 * table with search / filter / column toggles / URL-hash shareable state)
 * → per-plugin detail drawer. All data computed from data/analysis.json +
 * data/plugins.jsonl + data/enrich.json + data/llm.jsonl.
 *
 * @module dsh-insights/stage-4
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, SITE, readJsonl, readJson, loadEnrichMap, byFullName, loadPlugins } from '../../lib/data.mjs'

const OUT = join(SITE, 'index.html')

const SEVP = { fail: 20, major: 10, warn: 5, minor: 2 }
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function main() {
  const plugins = loadPlugins()
  const a = readJson(PATHS.analysis, {})
  const enMap = loadEnrichMap()
  // P1-1 单一快照约束：禁止发布混代产物（plugins 与 analysis/enrich 必须同代）
  const expected = a.totals?.authoritative
  if (expected != null && expected !== plugins.length) {
    console.error(`[site] 快照混代：plugins.jsonl ${plugins.length} 行 vs analysis.json authoritative ${expected}——请先重跑 analyze 再发布`)
    process.exit(1)
  }
  if (enMap.size && enMap.size !== plugins.length) {
    console.error(`[site] 快照混代：plugins.jsonl ${plugins.length} 行 vs enrich.json ${enMap.size} 条——请先重跑 analyze 再发布`)
    process.exit(1)
  }
  const llmMap = byFullName(readJsonl(PATHS.llm))
  const byStars = plugins.slice().sort((x, y) => (y.stars || 0) - (x.stars || 0))
  const t = a.totals || {}
  const d = a.distribution || {}
  const pub = d.publish || {}
  const doc = d.docs || {}
  const lib = d.lib || {}

  // ---- compact rows for the table -------------------------------------
  const rows = plugins.map((r) => [
    r.full_name, r.html_url || '', r.stars || 0, (r.created_at || '').slice(0, 10),
    r.npm?.published ? (r.npm.latest || '✓') : '', r.metrics?.hasZhDocs ? 1 : 0,
    r.files?.libIndex && r.files?.libClient ? 1 : 0, (r.pushed_at && (Date.now() - new Date(r.pushed_at).getTime()) < 7 * 86400000) ? 1 : 0,
    (r.description || '').slice(0, 110),
    enMap.get(r.full_name)?.grade || '',
    enMap.get(r.full_name)?.score ?? 0,
    (r.pushed_at || '').slice(0, 10),
  ])
  const dataJson = JSON.stringify(rows).replace(/</g, '\\u003c')

  // ---- weekly multi-line chart (inline SVG, hover handled client-side) --
  const wkGrade = t.byWeekGrades || {}
  const wkCand = a.coverage?.candidatesByWeek || {}
  const wkPresent = [...new Set([...Object.keys(t.byWeek || {}), ...Object.keys(wkCand), ...Object.keys(wkGrade.A || {}), ...Object.keys(wkGrade.B || {})])].sort()
  // 连续周轴：以最近一个有数据的周一为终点，向前补零 20 周（UTC，P2-13）
  const wkKeys = []
  if (wkPresent.length) {
    const pad = (x) => String(x).padStart(2, '0')
    const end = new Date(wkPresent[wkPresent.length - 1] + 'T00:00:00Z')
    for (let i = 19; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 7 * 86400000)
      wkKeys.push(d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()))
    }
  }
  const SERIES = [
    { key: 'cand', label: '候选新增', color: '#a1a1aa', data: wkCand },
    { key: 'auth', label: '权威集新增', color: 'var(--ink)', data: t.byWeek || {} },
    { key: 'ga', label: 'A 级新增', color: 'var(--ok)', data: wkGrade.A || {} },
    { key: 'gb', label: 'B 级新增', color: 'var(--accent)', data: wkGrade.B || {} },
  ]
  const CW = 960, CH = 210, PT = 12, PR = 6, PB = 26, PL = 34
  const iw = CW - PL - PR, ih = CH - PT - PB
  const xOf = (i) => +(PL + (wkKeys.length > 1 ? (i / (wkKeys.length - 1)) * iw : iw / 2)).toFixed(1)
  const wkRows = wkKeys.map((k, i) => {
    const r = { k: k.slice(5), full: k, x: xOf(i) }
    for (const s of SERIES) r[s.key] = s.data[k] || 0
    return r
  })
  const wkMax = Math.max(1, ...wkRows.flatMap((r) => SERIES.map((s) => r[s.key])))
  const yOf = (v) => +(PT + ih - (v / wkMax) * ih).toFixed(1)
  for (const r of wkRows) for (const s of SERIES) r[s.key + 'Y'] = yOf(r[s.key])
  const gridLines = [0, 1, 2, 3].map((i) => {
    const y = PT + (ih * i) / 3
    const v = Math.round(wkMax * (1 - i / 3))
    return '<line x1="' + PL + '" y1="' + y + '" x2="' + (CW - PR) + '" y2="' + y + '" class="grid"/>' +
      '<text x="' + (PL - 6) + '" y="' + (y + 3) + '" class="gly">' + v + '</text>'
  }).join('')
  const xLabels = wkRows.length
    ? [wkRows[0], wkRows[Math.floor(wkRows.length / 2)], wkRows[wkRows.length - 1]]
        .map((p) => '<text x="' + p.x + '" y="' + (CH - 8) + '" class="glx" text-anchor="middle">' + p.k + '</text>').join('')
    : ''
  const seriesPaths = SERIES.map((s) => {
    const d = wkRows.map((r, i) => (i ? 'L' : 'M') + r.x + ' ' + r[s.key + 'Y']).join(' ')
    return '<path d="' + d + '" class="line" style="stroke:' + s.color + '"' + (s.key === 'cand' ? ' stroke-dasharray="4 3"' : '') + '/>'
  }).join('')
  const seriesDots = SERIES.map((s) => '<circle id="ch-dot-' + s.key + '" r="3" class="dot" style="display:none;stroke:' + s.color + '"/>').join('')
  const legendHtml = SERIES.map((s) => '<span class="chlg"><i style="background:' + s.color + '"></i>' + s.label + '</span>').join('')
  const areaSvg = wkRows.length
    ? '<svg viewBox="0 0 ' + CW + ' ' + CH + '" style="width:100%;height:auto;display:block">' +
      gridLines + xLabels + seriesPaths + seriesDots +
      '<line id="ch-x" class="cross" style="display:none" y1="' + PT + '" y2="' + (PT + ih) + '"/>' +
      '</svg>'
    : '<div class="dim">数据积累中…</div>'
  const lastWeek = wkRows.length ? wkRows[wkRows.length - 1].auth : 0

  // ---- donuts ----------------------------------------------------------
  const donut = (parts, size = 118, sw = 21) => {
    const r = (size - sw) / 2
    const circ = 2 * Math.PI * r
    const total = parts.reduce((s2, p) => s2 + p.v, 0) || 1
    let off = 0
    const segs = parts.map((p, i) => {
      const len = Math.max(0, (p.v / total) * circ)
      const el = `<circle class="dseg" data-i="${i}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" data-tip="${esc(p.label)} · ${p.v}（${Math.round((p.v / total) * 1000) / 10}%）"/>`
      off += len
      return el
    }).join('')
    return `<svg class="donut" data-total="${total}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">${segs}<circle cx="${size / 2}" cy="${size / 2}" r="${r * 0.72}" fill="var(--card)"/><text class="dnum" x="${size / 2}" y="${size / 2 + 3}">${total}</text><text class="dlab" x="${size / 2}" y="${size / 2 + 16}">总计</text></svg>`
  }
  const donutPublish = donut([{ v: pub.published, c: 'var(--ink)', label: '已发布' }, { v: pub.unpublished, c: 'var(--track2)', label: '未发布' }])
  const donutDocs = donut([
    { v: doc.both, c: '#18181b', label: '双语(EN+中文)' },
    { v: Math.max(0, doc.zh - doc.both), c: '#52525b', label: '含中文' },
    { v: Math.max(0, doc.readme - doc.zh), c: '#a1a1aa', label: '单语' },
    { v: doc.none, c: '#e4e4e7', label: '无 README' },
  ])

  const bar = (label, count, max, color, title) =>
    '<div class="hbar" data-tip="' + esc(title || `${label} · ${count}`) + '"><span class="hbar-l"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(label) + '</span>' +
    '<div class="hbar-t"><div class="hbar-f" style="width:' + Math.max(2, Math.round((count / Math.max(1, max)) * 100)) + '%' + (color ? ';background:' + color : '') + '"></div></div>' +
    '<span class="hbar-v">' + count + '</span></div>'

  const topicBars = (a.topTopics || []).slice(0, 8).map((x) => bar(x.topic, x.count, (a.topTopics || [])[0]?.count || 1, null, x.topic)).join('')

  // ---- coverage funnel（口径透明：为什么权威集 ≪ topic 宇宙） -------------
  const cov = a.coverage || {}
  const uni = cov.topicUniverse?.count || 0
  const uniAt = (cov.topicUniverse?.at || '').slice(0, 10)
  const invalidTotal = (cov.invalidBuckets || []).reduce((s2, b) => s2 + b.count, 0)
  const bucketsTxt = (cov.invalidBuckets || []).slice(0, 5).map((b) => `${esc(b.reason)} ${b.count}`).join(' · ')
  const funnelHtml = uni ? [
    bar('topic 宇宙', uni, uni, null, `topic:dsh-plugin 全量（${uniAt} 实测）· 官方打标即入、零门槛`),
    bar('多源候选', cov.candidates || 0, uni, null, 'topic 分片全量抓取 + 策展目录 + npm 映射 · 去重'),
    bar('完成校验', cov.validated || 0, uni, null, 'manifest 门禁逐条核验（断点续跑）'),
    bar('权威集 ✓', cov.authoritative || 0, uni, 'var(--ok)', '非 fork/归档 + 声明 dsh.bundle.patch 且 patch 已提交'),
  ].join('') : ''

  const gCol = { S: '#7c3aed', A: 'var(--ok)', B: 'var(--accent)', C: 'var(--warn)', D: 'var(--err)' }
  const gMax = Math.max(1, ...Object.keys(gCol).map((k) => a.quality?.grades?.[k] || 0))
  const gradesHtml = Object.keys(gCol).map((k) => bar(k, a.quality?.grades?.[k] || 0, gMax, gCol[k])).join('')
  const catsMax = Math.max(1, ...(a.categories || []).map((x) => x.count))
  const catsHtml = (a.categories || []).slice(0, 8).map((x) => bar(x.category, x.count, catsMax, null, x.category)).join('')

  const staleRows = (a.npmStaleTop || []).map((s2) =>
    `<tr><td><a href="https://github.com/${esc(s2.repo)}" target="_blank" title="${esc(s2.repo)}">${esc(s2.repo)}</a></td><td class="num mono">${s2.stars}</td><td class="num warn mono">${esc(s2.repoVersion)} → ${esc(s2.npmLatest)}</td></tr>`).join('')
  const starRows = (a.topByStars || []).map((s2) =>
    `<tr><td><a href="https://github.com/${esc(s2.repo)}" target="_blank" title="${esc(s2.repo)}">${esc(s2.repo)}</a></td><td class="num mono">★ ${s2.stars}</td><td class="num">${s2.published ? '<span class="ok" title="npm 已发布">✓</span>' : '<span class="dim">—</span>'}</td><td class="num">${s2.zh ? '<span class="ok" title="中/双语文档">✓</span>' : '<span class="dim">—</span>'}</td></tr>`).join('')
  const suggestedHtml = (a.suggested || []).slice(0, 10).map((e) =>
    '<tr><td><a href="https://github.com/' + esc(e.full_name) + '" target="_blank">' + esc(e.full_name) + '</a></td><td class="num"><span class="grade ' + esc(e.grade) + '">' + esc(e.grade) + '</span></td><td class="num mono">★ ' + (e.stars || 0) + '</td><td class="ok">' + (e.weekly != null ? '⬇ ' + e.weekly : 'npm ✓') + '</td></tr>').join('')
  const authorRows = (a.authors || []).slice(0, 10).map((au) =>
    '<tr><td><a href="https://github.com/' + esc(au.owner) + '" target="_blank" title="' + esc(au.owner) + '"><img src="https://github.com/' + esc(au.owner) + '.png?size=40" width="18" height="18" loading="lazy" alt="" style="border-radius:50%;vertical-align:-3px;margin-right:6px">' + esc(au.owner) + '</a></td><td class="num mono">' + au.plugins + '</td><td class="num mono">' + au.ab + '</td><td class="num mono">★ ' + au.stars.toLocaleString() + '</td></tr>').join('')

  const topPickHtml = (a.categories || []).slice(0, 6).map((c) => {
    const pick = byStars.find((p) => enMap.get(p.full_name)?.category === c.category)
    if (!pick) return ''
    const g = enMap.get(pick.full_name)?.grade || ''
    return '<tr data-repo="' + esc(pick.full_name) + '"><td><a href="' + esc(pick.html_url || '') + '" target="_blank" title="' + esc(pick.full_name) + '">' + esc(pick.full_name) + '</a></td><td class="dim">' + esc(c.category) + '</td><td class="num mono">★ ' + (pick.stars || 0) + '</td><td class="num"><span class="grade ' + esc(g) + '">' + esc(g) + '</span></td></tr>'
  }).join('')

  const date = (a.generatedAt || '').slice(0, 10)

  const stat = (v, l, sub) =>
    '<div class="stat"><b class="mono">' + v + '</b><span>' + l + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DSH Insights · DeepSeek Harness 全景观察站</title>
<meta name="description" content="DeepSeek Harness (dsh) 插件生态全量索引、评估与分析仪表盘">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="logo.svg">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script defer src="https://cloud.umami.is/script.js" data-website-id="UMAMI_WEBSITE_ID"></script>
<style>
:root{
  --bg:#fafafa;--card:#ffffff;--ink:#18181b;--mut:#71717a;--faint:#a1a1aa;--line:#e4e4e7;--track:#f4f4f5;--track2:#e4e4e7;
  --accent:#2563eb;--ok:#059669;--warn:#d97706;--err:#dc2626;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --ease:cubic-bezier(.16,1,.3,1)
}
@media(prefers-color-scheme:dark){
  :root{--bg:#09090b;--card:#101012;--ink:#f4f4f5;--mut:#a1a1aa;--faint:#71717a;--line:#26262a;--track:#17171a;--track2:#27272a;--accent:#60a5fa}
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.dim{color:var(--faint)}.ok{color:var(--ok)}.warn{color:var(--warn)}
.wrap{max-width:1400px;margin:0 auto;padding:0 28px}

/* ---- topbar ---- */
.topbar{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;height:56px;gap:16px}
.subnav{position:sticky;top:56px;z-index:29;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.subnav .wrap{display:flex;align-items:center;gap:2px;height:38px;overflow-x:auto}
.subnav a{color:var(--mut);font-size:12.5px;padding:4px 10px;border-radius:7px;white-space:nowrap}
.subnav a:hover{color:var(--ink);background:var(--track);text-decoration:none}
.nav a.here{color:var(--ink);font-weight:650}
section[id],div[id="browse"]{scroll-margin-top:108px}
.brand{display:flex;align-items:center;gap:10px;font-weight:650;font-size:14px;color:var(--ink);white-space:nowrap}
.brand:hover{text-decoration:none}
.mark{width:22px;height:22px;display:inline-flex;flex:none}
.brand small{color:var(--faint);font-weight:400;font-size:12px}
.nav{display:flex;align-items:center;gap:2px}
.nav a{color:var(--mut);font-size:13px;padding:5px 10px;border-radius:7px}
.nav a:hover{color:var(--ink);background:var(--track);text-decoration:none}
.nav a.gh{border:1px solid var(--line);margin-left:6px}
@media(max-width:720px){.brand small{display:none}.topbar .wrap{flex-wrap:wrap;height:auto;padding:6px 28px;row-gap:2px}.nav{overflow-x:auto;width:100%;padding-bottom:4px;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}.nav a{padding:5px 7px;font-size:12.5px;white-space:nowrap;flex:none}}

/* ---- hero ---- */
.hero{border-bottom:1px solid var(--line);padding:56px 0 36px;background:var(--card)}
.kicker{font:600 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}
.hero h1{margin:0;font-size:clamp(26px,4vw,36px);font-weight:700;letter-spacing:-.03em;line-height:1.15;max-width:22ch}
.hero .lede{margin:12px 0 0;color:var(--mut);font-size:14.5px;max-width:68ch}
.hero .meta{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12.5px;color:var(--mut)}
.hero .meta b{color:var(--ink);font-weight:600}
.bignum{margin-top:34px;display:flex;align-items:baseline;gap:14px}
.bignum b{font:700 clamp(44px,7vw,64px)/1 var(--mono);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.bignum span{color:var(--mut);font-size:13px;max-width:24ch}
.stats{margin-top:28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-top:1px solid var(--line)}
.stat{padding:14px 18px 4px 0;display:flex;flex-direction:column;gap:1px}
.stat+.stat{border-left:1px solid var(--line);padding-left:18px}
.stat b{font-size:20px;font-weight:650;letter-spacing:-.02em}
.stat span{font-size:12.5px;color:var(--mut)}
.stat small{font-size:11px;color:var(--faint)}
@media(max-width:640px){.stat+.stat{border-left:none;padding-left:0}}

/* ---- sections ---- */
.sec{padding:40px 0 8px}
.sec-h{display:flex;align-items:baseline;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.sec-h h2{margin:0;font-size:18px;font-weight:650;letter-spacing:-.02em}
.sec-h .sub{margin:0;color:var(--faint);font-size:12.5px}
.sec-n{font:600 11px/1 var(--mono);color:var(--faint);letter-spacing:.06em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px}
.panel h3{margin:0;font-size:13.5px;font-weight:650}
.panel .p-sub{color:var(--faint);font-size:11.5px;margin:3px 0 14px}
.panel .p-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}

/* ---- charts ---- */
.hbar{display:flex;align-items:center;gap:10px;margin:7px 0}
.hbar-l{width:88px;flex:none;color:var(--mut);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbar-t{flex:1;background:var(--track);border-radius:4px;height:10px;overflow:hidden}
.hbar-f{height:100%;border-radius:4px;background:var(--ink)}
.hbar-v{width:36px;text-align:right;font:600 12px/1 var(--mono);font-variant-numeric:tabular-nums;flex:none;color:var(--mut)}
.donutwrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.legend{display:flex;flex-direction:column;gap:7px;font-size:12.5px;color:var(--mut)}
.legend b{color:var(--ink);font-family:var(--mono);font-weight:600;font-variant-numeric:tabular-nums}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2.5px;margin-right:7px;vertical-align:-1px}
.donut .dseg{transition:opacity .15s;cursor:pointer}
.donut.has-sel .dseg{opacity:.22}
.donut.has-sel .dseg.sel{opacity:1}
.donut .dnum{font:700 14px var(--mono);fill:var(--ink);text-anchor:middle}
.donut .dlab{font:9px var(--mono);fill:var(--faint);text-anchor:middle}
.dleg{cursor:pointer;border-radius:6px;padding:1px 5px;margin:-1px -5px}
.dleg:hover,.dleg.sel{background:var(--track);color:var(--ink)}
.hbar{transition:background .12s;border-radius:6px}
.hbar:hover{background:var(--track)}
.hbar:hover .hbar-f{filter:brightness(1.2)}
.dimrow{display:flex;align-items:center;gap:8px;font-size:12px;margin-top:5px}
.dimrow span{width:64px;color:var(--mut);flex:none;font-size:11.5px}
.dimt{flex:1;height:6px;background:var(--track);border-radius:3px;overflow:hidden}
.dimt i{display:block;height:100%;background:var(--accent);border-radius:3px}
.dimrow b{width:26px;text-align:right;font:600 11.5px var(--mono)}
.gtip{position:fixed;z-index:70;pointer-events:none;background:var(--ink);color:var(--bg);font:11.5px var(--mono);padding:4px 9px;border-radius:6px;display:none;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.chartbox{position:relative}
.chartbox .grid{stroke:var(--line);stroke-width:1}
.chartbox .gly{font:10px var(--mono);fill:var(--faint);text-anchor:end}
.chartbox .glx{font:10px var(--mono);fill:var(--faint)}
.chartbox .area{fill:color-mix(in srgb,var(--ink) 7%,transparent)}
.chartbox .line{fill:none;stroke:var(--ink);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
.chartbox .dot{fill:var(--card);stroke:var(--ink);stroke-width:2}
.chartbox .cross{stroke:var(--faint);stroke-width:1;stroke-dasharray:3 3}
.ch-tip{position:absolute;top:0;transform:translateX(-50%);background:var(--ink);color:var(--bg);font:600 11.5px/1.6 var(--mono);padding:7px 10px;border-radius:7px;pointer-events:none;display:none;min-width:132px}
.ch-tip i{vertical-align:-1px}
.chlg{display:inline-flex;align-items:center;gap:5px;margin-left:12px;font-size:11.5px}
.chlg i{display:inline-block;width:9px;height:9px;border-radius:2.5px}

/* ---- tables ---- */
table{width:100%;border-collapse:collapse;font-size:12.5px}
.cards table th,.cards table td{white-space:nowrap}
.cards .ptable td:first-child{max-width:260px;overflow:hidden;text-overflow:ellipsis}
.ptable th,.ptable td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:top}
.ptable th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em;cursor:pointer;user-select:none;background:var(--card);position:sticky;top:0;z-index:1}
.ptable th:hover{color:var(--ink)}
.ptable th .arr{font-size:9px;color:var(--accent)}
.ptable td.num,.ptable th.num{text-align:right}
.ptable td.desc{white-space:normal;max-width:320px;color:var(--mut);font-size:12px}
.ptable tbody tr{cursor:pointer;transition:background .12s}
.ptable tbody tr:hover{background:var(--track)}
.tbl-wrap{overflow:auto;max-height:600px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
.tbl-wrap .ptable th{top:0}
.grade{display:inline-block;min-width:22px;text-align:center;font:700 11px/1.5 var(--mono);border-radius:5px;padding:1px 6px;border:1px solid}
.grade.S{color:#7c3aed;background:color-mix(in srgb,#7c3aed 9%,transparent);border-color:color-mix(in srgb,#7c3aed 32%,transparent)}
.grade.A{color:var(--ok);background:color-mix(in srgb,var(--ok) 9%,transparent);border-color:color-mix(in srgb,var(--ok) 32%,transparent)}
.grade.B{color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,transparent);border-color:color-mix(in srgb,var(--accent) 32%,transparent)}
.grade.C{color:var(--warn);background:color-mix(in srgb,var(--warn) 10%,transparent);border-color:color-mix(in srgb,var(--warn) 35%,transparent)}
.grade.D{color:var(--err);background:color-mix(in srgb,var(--err) 9%,transparent);border-color:color-mix(in srgb,var(--err) 32%,transparent)}
#browse.hide-created .c-created,#browse.hide-zh .c-zh,#browse.hide-lib .c-lib,#browse.hide-act .c-act{display:none}

/* ---- toolbar ---- */
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.toolbar input[type=text]{flex:1;min-width:200px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;font-size:13px;outline:none;background:var(--card);color:var(--ink);transition:border-color .15s}
.toolbar input[type=text]:focus{border-color:var(--ink)}
.chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer;color:var(--mut);transition:all .15s var(--ease)}
.fsel{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 10px;font-size:12px;color:var(--mut);cursor:pointer;max-width:132px}
.fsel:hover{border-color:var(--faint);color:var(--ink)}
.fsel:focus{outline:none;border-color:var(--accent)}
.chip:hover{border-color:var(--faint);color:var(--ink)}
.chip.on{background:var(--ink);border-color:var(--ink);color:var(--bg);font-weight:600}
.cols{position:relative}
.cols summary{list-style:none;border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer;color:var(--mut);user-select:none}
.cols summary:hover{color:var(--ink);border-color:var(--faint)}
.cols summary::-webkit-details-marker{display:none}
.cols .menu{position:absolute;right:0;top:calc(100% + 6px);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px;z-index:10;min-width:128px;box-shadow:0 8px 24px -8px rgba(0,0,0,.14)}
.cols .menu label{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink);padding:5px 6px;border-radius:6px;cursor:pointer}
.cols .menu label:hover{background:var(--track)}
.pager{display:flex;align-items:center;gap:14px;margin-top:12px;justify-content:center;color:var(--mut);font-size:12.5px}
.pager button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:5px 13px;cursor:pointer;font-size:12.5px;transition:border-color .15s}
.pager button:hover:not(:disabled){border-color:var(--ink)}
.pager button:disabled{opacity:.35;cursor:default}
.pager #info{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:11.5px}
.datalinks{margin-top:14px;display:flex;gap:8px;flex-wrap:wrap}
.datalinks a{font-size:12px;border:1px solid var(--line);color:var(--mut);background:var(--card);border-radius:8px;padding:5px 11px}
.datalinks a:hover{color:var(--ink);border-color:var(--ink);text-decoration:none}

/* ---- drawer ---- */
.scrim{position:fixed;inset:0;background:rgba(9,9,11,.45);opacity:0;pointer-events:none;transition:opacity .2s;z-index:40}
.scrim.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(480px,94vw);background:var(--card);border-left:1px solid var(--line);z-index:41;transform:translateX(102%);transition:transform .3s var(--ease);overflow:auto}
.drawer.on{transform:none}
.dd-head{position:sticky;top:0;background:var(--card);border-bottom:1px solid var(--line);padding:15px 18px;z-index:2}
.dd-title{font:650 14.5px/1.4 var(--mono);word-break:break-all;padding-right:34px}
.dd-close{position:absolute;top:12px;right:12px;background:var(--track);border:1px solid var(--line);color:var(--mut);width:26px;height:26px;border-radius:7px;cursor:pointer;font-size:12px;transition:all .15s}
.dd-close:hover{color:var(--ink);border-color:var(--ink)}
.dd-body{padding:6px 18px 40px}
.dd-sec{margin-top:20px}
.dd-sec h3{margin:0 0 8px;font:600 11px/1 var(--mono);color:var(--faint);text-transform:uppercase;letter-spacing:.07em}
.dd-desc{font-size:13px}
.dd-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.dd-kpi{background:var(--track);border-radius:9px;padding:9px 10px;text-align:center}
.dd-kpi b{display:block;font:650 15px/1.2 var(--mono);font-variant-numeric:tabular-nums}
.dd-kpi span{font-size:10.5px;color:var(--mut)}
.chipset{display:flex;flex-wrap:wrap;gap:6px}
.chipset span{background:var(--track);color:var(--mut);border-radius:999px;padding:2px 9px;font-size:11.5px}
.flag{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:7px;padding:3px 8px;font-size:12px;margin:0 6px 6px 0}
.flag b{color:var(--ok)}
.dd-table{width:100%;font-size:12.5px;border-collapse:collapse}
.dd-table td{padding:5px 0;border-bottom:1px solid var(--line)}
.dd-table td:last-child{text-align:right;color:var(--mut);font-family:var(--mono);font-size:11.5px}
.linkrow{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.linkrow a{border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:5px 11px;font-size:12px}
.linkrow a:hover{border-color:var(--ink);text-decoration:none}
.loading{color:var(--faint);font-size:12px}
.qual{display:flex;align-items:center;gap:14px}
.qual .big{font:700 34px/1 var(--mono)}
.qualbar{height:6px;border-radius:4px;background:var(--track);margin-top:10px;overflow:hidden}
.qualbar i{display:block;height:100%;background:var(--ink)}
.peer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.peer .num{color:var(--mut);font:11.5px var(--mono)}
.score li{margin:3px 0;font-size:12px;display:flex;justify-content:space-between;gap:10px}
.score b{color:var(--ink);font-family:var(--mono);font-variant-numeric:tabular-nums}

footer{margin:36px 0 48px;padding-top:18px;border-top:1px solid var(--line);color:var(--faint);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<div class="topbar"><div class="wrap">
  <a class="brand" href="#top"><span class="mark"><svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="var(--ink)"/><rect x="16" y="34" width="8" height="14" rx="2" fill="var(--bg)"/><rect x="28" y="25" width="8" height="23" rx="2" fill="var(--bg)"/><rect x="40" y="14" width="8" height="34" rx="2" fill="var(--accent)"/></svg></span>DSH Insights<small>DeepSeek Harness 全景观察站</small></a>
  <nav class="nav"><a href="./" class="here">仪表盘</a><a href="dynamics/">动态</a><a href="scenarios/">场景</a><a href="authors/">作者</a><a href="weekly/">周报</a><a href="data/">开放数据</a><a href="badge/">徽章</a><a href="about/">关于</a><a class="gh" href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub ↗</a></nav>
</div></div>
<div class="subnav"><div class="wrap">
  <a href="#overview">趋势</a><a href="#quality">质量</a><a href="#rank">榜单</a><a href="#browse">插件库</a>
</div></div>

<header class="hero" id="top"><div class="wrap">
  <p class="kicker">DeepSeek Harness Plugin Ecosystem</p>
  <h1>DSH Insights · DeepSeek Harness 全景观察站</h1>
  <p class="lede">多源发现 → manifest 真伪校验 → 元数据评估（npm / 文档 / 构建产物 / 活跃度）→ 生态洞察。启发式评估，非安全审计。</p>
  <div class="meta"><span>快照 <b>${date}</b></span><span>最近一周新增 <b class="mono">+${lastWeek}</b></span><span><a href="https://github.com/ice5kysl/dsh-insights/blob/main/README.md" target="_blank">方法论 ↗</a></span></div>
  <div class="bignum"><b class="count mono" data-v="${t.authoritative ?? 0}">0</b><span>权威插件<br>通过 dsh.bundle manifest 校验</span></div>
  <div class="stats">
    ${stat((d.publishPct != null ? d.publishPct + '%' : '—'), 'npm 发布率', (pub.published ?? 0) + ' 已发布 · ' + (pub.stale ?? 0) + ' 滞后')}
    ${stat((d.zhPct != null ? d.zhPct + '%' : '—'), 'i18n 双语（中/英检出）', (doc.both ?? 0) + ' 份双语文档')}
    ${stat((t.active7Pct ?? 0) + '%', '近 7 天活跃', '以周为基准的生态活跃信号 · 30 天 ' + (t.active30Pct ?? 0) + '%')}
    ${stat(a.quality?.avgScore ?? '—', '平均质量分', 'A+B ' + (a.quality?.gradePct ?? 0) + '%')}
    ${stat(a.channels ? a.channels.coveredPct + '%' : '—', 'curated 收录率', (a.channels?.covered ?? 0) + ' 已进 awesome/imsai')}
    ${stat(doc.none ?? 0, '无 README', '建议补充基本文档')}
  </div>
</div></header>

<main class="wrap">

<section class="sec" id="overview">
  <div class="sec-h"><span class="sec-n">01</span><h2>生态趋势</h2><p class="sub">增长节奏 · 发布与文档覆盖 · 热门话题</p></div>
  ${funnelHtml ? `<div class="panel" style="margin-bottom:14px">
    <div class="p-h"><h3>覆盖漏斗 · ${cov.authoritative} 与 ${uni.toLocaleString()} 的关系</h3><span class="p-sub">分桶复核 ${invalidTotal}：${bucketsTxt}</span></div>
    ${funnelHtml}
    <p class="p-sub" style="margin-top:10px">topic 是「打标即入」的原始宇宙——含蹭标、无关仓库、fork、monorepo 子路径与已删除仓库；权威集是 manifest 门禁逐条核验后的可信子集，<b>校验按 API 预算滚动推进（断点续跑），权威集随快照持续扩大</b>。纯 tarball 分发等边界形态进分桶人工复核。口径详见 <a href="about/">方法论</a>。</p>
  </div>` : ''}
  <div class="panel" style="margin-bottom:14px">
    <div class="p-h"><h3>生态新增 · 按周</h3><span class="p-sub">按仓库创建时间归属到周一 · 最近 ${wkRows.length} 周 · ${legendHtml}</span></div>
    <div class="chartbox" id="chart-week">${areaSvg}<div class="ch-tip" id="ch-tip"></div></div>
  </div>
  <div class="cards">
    <div class="panel">
      <h3>npm 发布分布</h3><p class="p-sub">已发布 vs 未发布 · 版本滞后 ${pub.stale ?? 0}</p>
      <div class="donutwrap">${donutPublish}<div class="legend">
        <div class="dleg" data-i="0"><i style="background:var(--ink)"></i>已发布 <b>${pub.published ?? 0}</b></div>
        <div class="dleg" data-i="1"><i style="background:var(--track2)"></i>未发布 <b>${pub.unpublished ?? 0}</b></div>
        <div style="color:var(--warn)">版本滞后 ${pub.stale ?? 0}</div>
      </div></div>
    </div>
    <div class="panel">
      <h3>i18n · 文档语言足迹</h3><p class="p-sub">按 README 检出：双语 / 含中文 / 单语 / 无 · 多语言(ja/ko/…)检测规划见 M1</p>
      <div class="donutwrap">${donutDocs}<div class="legend">
        <div class="dleg" data-i="0"><i style="background:#18181b"></i>双语(EN+中文) <b>${doc.both ?? 0}</b></div>
        <div class="dleg" data-i="1"><i style="background:#52525b"></i>含中文（i18n 样本） <b>${Math.max(0, (doc.zh ?? 0) - (doc.both ?? 0))}</b></div>
        <div class="dleg" data-i="2"><i style="background:#a1a1aa"></i>单语（基础 README） <b>${Math.max(0, (doc.readme ?? 0) - (doc.zh ?? 0))}</b></div>
        <div class="dleg" data-i="3"><i style="background:#e4e4e7"></i>无 README <b>${doc.none ?? 0}</b></div>
      </div></div>
    </div>
    <div class="panel">
      <h3>Top topics</h3><p class="p-sub">仓库自声明 topic · Top 8</p>
      ${topicBars || '<div class="dim">暂无</div>'}
    </div>
  </div>
</section>

<section class="sec" id="quality">
  <div class="sec-h"><span class="sec-n">02</span><h2>质量分布</h2><p class="sub">启发式评分 · 功能分类 · 各场景首选</p></div>
  <div class="cards">
    <div class="panel">
      <h3>质量分级</h3><p class="p-sub">平均分 ${a.quality?.avgScore ?? 0} · A+B ${a.quality?.gradePct ?? 0}%</p>
      ${gradesHtml}
    </div>
    <div class="panel">
      <h3>功能分类</h3><p class="p-sub">按名称/描述归类 · Top 8</p>
      ${catsHtml}
    </div>
    <div class="panel">
      <h3>场景推荐 · 各分类首选</h3><p class="p-sub">每个分类里质量/活跃度最高 · 点击行看详情</p>
      <table class="ptable"><thead><tr><th>推荐</th><th>场景</th><th class="num">★</th><th class="num">质量</th></tr></thead><tbody>${topPickHtml || '<tr><td class="dim">暂无</td></tr>'}</tbody></table>
    </div>
  </div>
</section>

<section class="sec" id="rank">
  <div class="sec-h"><span class="sec-n">03</span><h2>榜单</h2><p class="sub">社区关注 · 发布健康 · 值得收录</p></div>
  <div class="cards">
    <div class="panel">
      <h3>Star 榜 Top 10</h3><p class="p-sub">社区关注度最高的权威插件</p>
      <table class="ptable"><thead><tr><th>仓库</th><th class="num">★</th><th class="num">npm</th><th class="num">i18n</th></tr></thead><tbody>${starRows || '<tr><td class="dim">暂无</td></tr>'}</tbody></table>
    </div>
    <div class="panel">
      <h3>npm 版本滞后榜</h3><p class="p-sub">仓库已领先于 npm 发布 · Top 10</p>
      <table class="ptable"><thead><tr><th>仓库</th><th class="num">★</th><th class="num">仓库 → npm</th></tr></thead><tbody>${staleRows || '<tr><td class="dim">暂无</td></tr>'}</tbody></table>
    </div>
    <div class="panel">
      <h3>优质未收录 · 建议收录</h3><p class="p-sub">A/B 级 · 已发布 npm · 尚未进 awesome/imsai · Top 10</p>
      <table class="ptable"><thead><tr><th>仓库</th><th class="num">质量</th><th class="num">★</th><th>npm / 周下载</th></tr></thead><tbody>
      ${suggestedHtml || '<tr><td class="dim">暂无（请先跑 00-lists + analyze）</td></tr>'}
      </tbody></table>
    </div>
    <div class="panel">
      <h3>作者榜 Top 10</h3><p class="p-sub">按 A/B 级插件数 · <a href="authors/">全部 ${a.authorStats?.total ?? ''} 位作者 →</a></p>
      <table class="ptable"><thead><tr><th>作者</th><th class="num">插件</th><th class="num">A/B</th><th class="num">★合计</th></tr></thead><tbody>${authorRows || '<tr><td class="dim">暂无</td></tr>'}</tbody></table>
    </div>
  </div>
</section>

<section class="sec" id="browse">
  <div class="sec-h"><span class="sec-n">04</span><h2>插件库</h2><p class="sub">搜索 / 筛选 / 排序 · 状态同步到 URL，可直接分享 · 已加载 ${plugins.length} 个</p></div>
  <div class="toolbar">
    <input type="text" id="q" placeholder="搜索仓库名 / 描述…" autocomplete="off">
    <select id="f-gr" class="fsel" title="质量等级筛选">
      <option value="">全部等级</option><option value="S">S 级</option><option value="A">A 级</option><option value="B">B 级</option><option value="C">C 级</option><option value="D">D 级</option>
    </select>
    <select id="f-npm" class="fsel" title="npm 状态筛选">
      <option value="">全部 npm</option><option value="pub">已发布</option><option value="unpub">未发布</option><option value="stale">版本滞后</option>
    </select>
    <button class="chip" data-zh="0">i18n·中英</button>
    <button class="chip" data-active="1">近 7 天活跃</button>
    <select id="f-sort" class="fsel" title="排序">
      <option value="">默认（★ 降序）</option><option value="stars-asc">★ 最少</option><option value="new">最新创建</option><option value="old">最早创建</option><option value="active">最近活跃</option><option value="score">质量分</option><option value="name">名称 A→Z</option>
    </select>
    <details class="cols"><summary>列 ▾</summary><div class="menu">
      <label><input type="checkbox" checked data-col="created">创建日期</label>
      <label><input type="checkbox" checked data-col="zh">i18n·中英</label>
      <label><input type="checkbox" checked data-col="lib">双产物</label>
      <label><input type="checkbox" checked data-col="act">活跃</label>
    </div></details>
  </div>
  <div class="tbl-wrap">
  <table class="ptable">
    <thead><tr>
      <th data-k="0">仓库</th><th data-k="2" class="num">★</th><th data-k="3" class="c-created">创建</th><th data-k="4">npm</th><th data-k="5" class="c-zh">i18n·中英</th><th data-k="6" class="c-lib">双产物</th><th data-k="7" class="c-act">活跃</th><th>质量</th><th>描述</th>
    </tr></thead>
    <tbody id="tb"></tbody>
  </table></div>
  <div class="pager"><button id="prev">‹ 上一页</button><span id="info"></span><button id="next">下一页 ›</button></div>
  <div class="datalinks">
    <a href="../data/plugins.jsonl" target="_blank">⬇ plugins.jsonl</a>
    <a href="../data/plugins.csv" target="_blank">⬇ plugins.csv</a>
    <a href="../data/invalid.jsonl" target="_blank">⬇ invalid.jsonl（噪声分桶）</a>
  </div>
</section>

<footer>
  <span>由 <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">dsh-insights</a> 管线自动生成 · ${date}</span>
  <span>零依赖 · GitHub API + npm · 启发式评估，非安全审计</span>
</footer>
</main>

<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-hidden="true">
  <div class="dd-head"><div class="dd-title" id="dd-title"></div><button class="dd-close" id="dd-close" title="关闭">✕</button></div>
  <div class="dd-body" id="dd-body"></div>
</aside>

<script>
const ROWS=${dataJson};
const WKS=${JSON.stringify(wkRows).replace(/</g, '\\u003c')};
const WSERIES=${JSON.stringify(SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color }))).replace(/</g, '\\u003c')};
const $=s=>document.querySelector(s);
let q='',npm='',zh='',act='',gr='',sort=-1,desc=false,page=0,PAGE=120;

// ---- count-up (hero number) ----
(function(){
  var els=document.querySelectorAll('.count');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.forEach(function(el){
    var v=+el.dataset.v||0;
    if(reduce||v===0){el.textContent=v.toLocaleString('en-US');return}
    var t0=null,D=900;
    function step(ts){ if(!t0)t0=ts; var p=Math.min(1,(ts-t0)/D); var e2=1-Math.pow(1-p,3);
      el.textContent=Math.round(v*e2).toLocaleString('en-US'); if(p<1)requestAnimationFrame(step) }
    requestAnimationFrame(step);
  });
})();

// ---- weekly multi-line chart hover ----
(function(){
  var box=$('#chart-week'); if(!box||!WKS.length)return;
  var cross=$('#ch-x'),tip=$('#ch-tip');
  var CW2=960,CH2=210;
  function hide(){ cross.style.display='none'; tip.style.display='none';
    WSERIES.forEach(function(s){ $('#ch-dot-'+s.key).style.display='none' }) }
  function onPoint(clientX){
    var r=box.getBoundingClientRect();
    var ratio=(clientX-r.left)/r.width;
    var i=Math.round(ratio*(WKS.length-1));
    i=Math.max(0,Math.min(WKS.length-1,i));
    var p=WKS[i];
    cross.style.display='';tip.style.display='';
    cross.setAttribute('x1',p.x);cross.setAttribute('x2',p.x);
    WSERIES.forEach(function(s){ var d=$('#ch-dot-'+s.key); d.style.display=''; d.setAttribute('cx',p.x); d.setAttribute('cy',p[s.key+'Y']) });
    tip.innerHTML='<b>'+p.full+'</b>'+WSERIES.map(function(s){
      return '<div><i style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:'+s.color+'"></i>'+s.label+' <b style="margin-left:6px">+'+p[s.key]+'</b></div>' }).join('');
    var left=p.x/CW2*r.width;
    left=Math.max(70,Math.min(r.width-70,left));
    tip.style.left=left+'px';
    tip.style.top='8px';
  }
  box.addEventListener('mousemove',function(ev){ onPoint(ev.clientX) });
  box.addEventListener('touchmove',function(ev){ if(ev.touches[0])onPoint(ev.touches[0].clientX) },{passive:true});
  box.addEventListener('mouseleave',hide);
})();

// ---- global tooltip ([data-tip]) ----
(function(){
  var tip=document.createElement('div'); tip.className='gtip'; document.body.appendChild(tip);
  function move(ev){ var x=ev.clientX+12,y=ev.clientY+14;
    if(x+tip.offsetWidth>innerWidth-8)x=ev.clientX-tip.offsetWidth-12;
    if(y+tip.offsetHeight>innerHeight-8)y=ev.clientY-tip.offsetHeight-14;
    tip.style.left=x+'px'; tip.style.top=y+'px' }
  document.addEventListener('mouseover',function(ev){
    var t=ev.target.closest&&ev.target.closest('[data-tip]');
    if(!t)return; tip.textContent=t.getAttribute('data-tip'); tip.style.display='block'; move(ev);
  });
  document.addEventListener('mousemove',function(ev){ if(tip.style.display==='block')move(ev) });
  document.addEventListener('mouseout',function(ev){
    if(ev.target.closest&&ev.target.closest('[data-tip]'))tip.style.display='none';
  });
})();

// ---- donut segment ↔ legend sync ----
document.querySelectorAll('.donutwrap').forEach(function(wrap){
  var svg=wrap.querySelector('svg.donut'); if(!svg)return;
  var segs=svg.querySelectorAll('.dseg');
  var dnum=svg.querySelector('.dnum'),dlab=svg.querySelector('.dlab');
  var total=svg.getAttribute('data-total');
  function sel(i,on){
    svg.classList.toggle('has-sel',on);
    segs.forEach(function(s){ s.classList.toggle('sel',on&&s.getAttribute('data-i')===String(i)) });
    wrap.querySelectorAll('.dleg').forEach(function(l){ l.classList.toggle('sel',on&&l.getAttribute('data-i')===String(i)) });
    if(on){ var seg=svg.querySelector('.dseg[data-i="'+i+'"]');
      var t=(seg.getAttribute('data-tip')||'').split(' · ');
      dnum.textContent=t[1]?t[1].split('（')[0]:''; dlab.textContent=t[0]||''; }
    else { dnum.textContent=total; dlab.textContent='总计' }
  }
  segs.forEach(function(s){
    s.addEventListener('mouseenter',function(){ sel(s.getAttribute('data-i'),true) });
    s.addEventListener('mouseleave',function(){ sel(0,false) });
  });
  wrap.querySelectorAll('.dleg').forEach(function(l){
    l.addEventListener('mouseenter',function(){ sel(l.getAttribute('data-i'),true) });
    l.addEventListener('mouseleave',function(){ sel(0,false) });
  });
});

// ---- table ----
function filtered(){
  let r=ROWS;
  if(q){const t=q.toLowerCase();r=r.filter(x=>(x[0]+' '+x[8]).toLowerCase().includes(t))}
  if(npm==='pub')r=r.filter(x=>x[4]);if(npm==='unpub')r=r.filter(x=>!x[4]);if(npm==='stale')r=r.filter(x=>x[4]);
  if(zh==='1')r=r.filter(x=>x[5]);if(act==='1')r=r.filter(x=>x[7]);if(gr)r=r.filter(x=>x[9]===gr);
  if(sort>=0){r=r.slice().sort((a,b)=>{const va=a[sort],vb=b[sort];const c=typeof va==='number'&&typeof vb==='number'?va-vb:String(va).localeCompare(String(vb));return desc?-c:c})}
  return r;
}
const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function draw(){
  const list=filtered(),pages=Math.ceil(list.length/PAGE)||1;
  page=Math.min(page,pages-1);
  const seg=list.slice(page*PAGE,(page+1)*PAGE);
  $('#tb').innerHTML=seg.map(r=>'<tr data-repo="'+e(r[0])+'" data-url="'+e(r[1])+'"><td><a href="'+e(r[1])+'" target="_blank">'+e(r[0])+'</a></td><td class="num mono">'+r[2]+'</td><td class="c-created mono" style="color:var(--mut)">'+r[3]+'</td><td>'+(r[4]?'<span class="ok mono">'+e(r[4])+'</span>':'<span class="dim">—</span>')+'</td><td class="c-zh">'+(r[5]?'✓':'')+'</td><td class="c-lib">'+(r[6]?'✓':'')+'</td><td class="c-act">'+(r[7]?'✓':'')+'</td><td>'+(r[9]?'<span class="grade '+e(r[9])+'">'+e(r[9])+'</span>':'')+'</td><td class="desc">'+e(r[8])+'</td></tr>').join('')||'<tr><td colspan="9" class="dim" style="padding:24px;text-align:center">无匹配 — 试试放宽筛选条件</td></tr>';
  $('#info').textContent='第 '+(page+1)+'/'+pages+' 页 · 共 '+list.length+' 条';
  $('#prev').disabled=page===0;$('#next').disabled=page>=pages-1;
  document.querySelectorAll('.ptable th[data-k]').forEach(th=>{
    const k=+th.dataset.k;const base=th.textContent.replace(/ [↑↓]$/,'');
    th.innerHTML=e(base)+(sort===k?' <span class="arr">'+(desc?'↓':'↑')+'</span>':'');
  });
  syncHash();
}
function syncHash(){
  const p=new URLSearchParams();
  if(q)p.set('q',q);if(npm)p.set('npm',npm);if(zh)p.set('zh','1');if(act)p.set('act','1');if(gr)p.set('gr',gr);
  const sv=$('#f-sort').value;if(sv)p.set('sort',sv);
  const s=p.toString();
  // only pin a hash when filters are active — a bare #browse would make
  // reloads/native fragment navigation jump past the hero for no reason
  history.replaceState(null,'',s?'#browse?'+s:location.pathname+location.search);
}
function readHash(){
  if(location.hash.indexOf('#browse?')!==0)return;
  const p=new URLSearchParams(location.hash.split('?')[1]||'');
  q=p.get('q')||'';npm=p.get('npm')||'';zh=p.get('zh')?'1':'';act=p.get('act')?'1':'';gr=p.get('gr')||'';
  $('#q').value=q;
  $('#f-npm').value=npm;$('#f-gr').value=gr;
  var sv=p.get('sort')||'';if(SORTMAP[sv]){$('#f-sort').value=sv;sort=SORTMAP[sv][0];desc=SORTMAP[sv][1]}
  document.querySelectorAll('[data-zh]').forEach(x=>x.classList.toggle('on',zh==='1'));
  document.querySelectorAll('[data-active]').forEach(x=>x.classList.toggle('on',act==='1'));
  setTimeout(()=>{const el=document.getElementById('browse');if(el)el.scrollIntoView({behavior:'instant',block:'start'})},60);
}
$('#q').addEventListener('input',ev=>{q=ev.target.value;page=0;draw()});
$('#f-gr').addEventListener('change',ev=>{gr=ev.target.value;page=0;draw()});
$('#f-npm').addEventListener('change',ev=>{npm=ev.target.value;page=0;draw()});
var SORTMAP={'':[-1,true],'stars-asc':[2,false],'new':[3,true],'old':[3,false],'active':[11,true],'score':[10,true],'name':[0,false]};
$('#f-sort').addEventListener('change',ev=>{var m=SORTMAP[ev.target.value]||[-1,true];sort=m[0];desc=m[1];page=0;draw()});
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
  if(c.dataset.zh!==undefined){zh=(zh==='1'?'':'1');document.querySelectorAll('[data-zh]').forEach(x=>x.classList.toggle('on',zh==='1'))}
  if(c.dataset.active!==undefined){act=(act==='1'?'':'1');c.classList.toggle('on',act==='1')}
  page=0;draw();
}));
document.querySelectorAll('.cols input').forEach(cb=>cb.addEventListener('change',()=>{
  document.getElementById('browse').classList.toggle('hide-'+cb.dataset.col,!cb.checked);
}));
document.querySelectorAll('.ptable th[data-k]').forEach(th=>th.addEventListener('click',()=>{const k=+th.dataset.k;if(sort===k)desc=!desc;else{sort=k;desc=false}$('#f-sort').value='';page=0;draw()}));
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
  if(histCache[repo]){ h.innerHTML=histCache[repo]; return }
  var done=function(html){ histCache[repo]=html; h.innerHTML=html };
  if(d.pkgName){
    fetch('https://registry.npmjs.org/'+encodeURIComponent(d.pkgName).replace(/%40/g,'@')).then(function(r){return r.ok?r.json():null}).then(function(doc){
      if(!doc||!doc.time){h.innerHTML='<div class="dim">无 npm 版本历史</div>';return}
      var vs=[];for(var k in doc.time){if(/^\d/.test(k))vs.push({v:k,t:(doc.time[k]||'').slice(0,10)})}
      vs.sort(function(a,b){return a.t<b.t?-1:a.t>b.t?1:0}).reverse();
      done('<table class="dd-table">'+vs.slice(0,8).map(function(x){return ddRow('<span class="warn">'+escA(x.v)+'</span>',escA(x.t))}).join('')+'</table>'+(vs.length>8?'<div class="dim" style="font-size:11px;margin-top:4px">共 '+vs.length+' 个版本 · 最早 '+escA(vs[vs.length-1].t)+'</div>':''));
    }).catch(function(){done('<div class="dim">版本历史不可用</div>')})
  } else {
    fetch('https://api.github.com/repos/'+encodeURIComponent(repo)+'/releases?per_page=6').then(function(r){return r.ok?r.json():null}).then(function(rel){
      if(!rel||!rel.length){done('<div class="dim">无 GitHub Release（或未发布 / 接口限流）</div>');return}
      done('<table class="dd-table">'+rel.map(function(x){return ddRow(escA(x.tag_name||x.name),(x.published_at||'').slice(0,10))}).join('')+'</table>');
    }).catch(function(){done('<div class="dim">Release 历史不可用</div>')})
  }
}
function openDrawer(repo){
  $('#dd-title').textContent=repo;
  var b=$('#dd-body');b.innerHTML='<div class="loading">加载详情…</div>';
  $('#drawer').classList.add('on');$('#scrim').classList.add('on');document.body.style.overflow='hidden';
  detMap().then(function(m){
    var d=m[repo]; if(!d){b.innerHTML='<div class="dd-sec"><h3>详情</h3><div class="dd-desc">暂无本地详情（可能晚于当前快照）。</div></div>';return}
    var flags='<div class="dd-sec"><h3>清单与构建产物</h3>'+ddFlag(d.files.rd,'README')+ddFlag(d.files.zh,'中文 README')+ddFlag(d.files.lic,'LICENSE')+ddFlag(d.files.cp,'cordis.patch.yml')+ddFlag(d.files.idx,'lib/index.js')+ddFlag(d.files.cli,'lib/client.js')+(d.hasClientExport?ddFlag(true,'exports["./client"]'):'')+'</div>'
    var npmHtml=d.npm&&d.npm.published
      ? '<table class="dd-table">'+ddRow('latest','<span class="ok">'+escA(d.npm.latest)+'</span>')+ddRow('发布版本数',d.npm.versions)+ddRow('最近发布',escA((d.npm.latestTime||'').slice(0,10)||'—'))+'</table>'+(d.version&&d.npm.latest&&d.npm.latest!==d.version?'<div class="warn" style="font-size:12px;margin-top:6px">⚠ 版本滞后：仓库 '+escA(d.version)+' vs npm '+escA(d.npm.latest)+'</div>':'')
      : '<div class="dim">未发布到 npm</div>'
    b.innerHTML=''
      +'<div class="dd-sec"><h3>描述</h3><div class="dd-desc">'+escA(d.desc||'—')+'</div>'+(d.topics&&d.topics.length?'<div class="chipset" style="margin-top:10px">'+d.topics.map(function(t){return '<span>'+escA(t)+'</span>'}).join('')+'</div>':'')+'</div>'
      +'<div class="dd-kpis">'+ddK('★',d.stars)+ddK('fork',d.forks)+ddK('仓库年龄',Math.round(d.ageDays)+' 天')+'</div>'
      +'<div class="dd-sec"><h3>npm</h3>'+npmHtml+'</div>'
      +'<div class="dd-sec"><h3>收录 / 下载</h3>'+(d.channels?(d.channels.aw?'<span class="flag"><b>✓</b> awesome-dsh-plugin</span>':'')+(d.channels.im?'<span class="flag"><b>✓</b> imsai</span>':'')+(!d.channels.aw&&!d.channels.im?'<span class="flag">curated 未收录</span>':''):'')+(d.weekly!=null?'<span class="flag"><b>⬇</b> 周下载 '+escA(d.weekly)+'</span>':'')+'</div>'
      +'<div class="dd-sec"><h3>LLM 解读</h3>'+(d.llm?('<div class="dd-desc">'+escA(d.llm.summaryZh||d.llm.summaryEn||'—')+'</div>'+(d.llm.category?'<div class="chipset" style="margin-top:8px"><span>'+escA(d.llm.category)+'</span></div>':'')+(d.llm.capabilityTags&&d.llm.capabilityTags.length?'<div class="chipset" style="margin-top:6px">'+d.llm.capabilityTags.map(function(t){return '<span>'+escA(t)+'</span>'}).join('')+'</div>':'')+(d.llm.claims&&d.llm.claims.length?'<div class="dd-desc" style="margin-top:8px;color:var(--mut)">宣称：'+d.llm.claims.map(escA).join(' · ')+'</div>':'')):'<div class="dim">未标注 · 待 LLM 标注轮</div>')+'</div>'
      +flags
      +'<div class="dd-sec"><h3>质量评分（启发式）</h3><div class="qual"><div class="big" style="color:'+(d.grade==='S'?'#7c3aed':d.grade==='A'?'var(--ok)':d.grade==='B'?'var(--accent)':d.grade==='C'?'var(--warn)':'var(--err)')+'">'+escA(d.grade||'—')+'</div><div class="meta">'+escA(d.score!=null?d.score+' / 100':'未评分')+'<br>分类：'+escA(d.category||'其它')+'</div></div><div class="qualbar"><i style="width:'+escA(d.score!=null?d.score:0)+'%"></i></div>'+(function(){var DM=[['eng','工程质量'],['docs','文档完整性'],['discover','可发现性'],['maint','维护活跃']];var rows=DM.map(function(dm){var v=(d.dims&&d.dims[dm[0]]!=null)?d.dims[dm[0]]:null;return '<div class="dimrow"><span>'+dm[1]+'</span><div class="dimt"><i style="width:'+(v==null?0:v)+'%"></i></div><b>'+(v==null?'—':v)+'</b></div>'}).join('');return '<div style="margin-top:10px">'+rows+'</div><div class="dim" style="font-size:11px;margin-top:6px">安全卫生（深检抽样）与采用度（★/下载/收录）为展示信号、不进总分；兼容性维度随 rc 雷达（M2）上线。</div>'})()+'</div>'
  +'<div class="dd-sec"><h3>同类插件 · 同分类按 ★</h3><div id="dd-peers" class="loading">计算中…</div></div>'+'<div class="dd-sec"><h3>仓库</h3><table class="dd-table">'+ddRow('创建',escA((d.created||'').slice(0,10)))+ddRow('最近 push',escA((d.pushed||'').slice(0,10)))+ddRow('默认分支',escA(d.branch||'—'))+ddRow('数据来源',escA(d.source||'—'))+'</table><div class="linkrow"><a href="'+escA(d.url)+'" target="_blank">GitHub ↗</a>'+(d.pkgName?'<a href="https://www.npmjs.com/package/'+escA(d.pkgName)+'" target="_blank">npm ↗</a>':'')+'</div></div>'
      +'<div class="dd-sec"><h3>版本历史</h3><div id="dd-hist" class="loading">加载中…</div></div>';
    loadHist(repo,d);
    if(d.parts&&d.parts.length){ var li=d.parts.map(function(p){return '<li><span>'+escA(p.label)+'</span><b>'+escA(p.v)+'</b></li>'}).join(''); b.insertAdjacentHTML('beforeend','<div class="dd-sec"><h3>扣分明细</h3><ul class="score" style="margin:0;padding:0;list-style:none">'+li+'</ul><div class="dim" style="font-size:11px;margin-top:6px">100 起扣 · fail −20 / 较重 −10 / 中 −5 / 轻 −2（S≥95 · A≥90 · B≥75 · C≥60）。未列出的项表示未扣分；探测不到的数据不虚构不扣分。</div></div>') }
    loadPeers(repo,d);
  })
}
var histCache={};
var rowsBy=null;
function rowsIndex(){ if(!rowsBy){ rowsBy={}; ROWS.forEach(function(r){ rowsBy[r[0]]=r }) } return rowsBy }
var catsCache=null;
function catsMap(){ if(!catsCache){ catsCache=fetch('plugins-cats.json').then(function(r){return r.ok?r.json():null}) } return catsCache }
function loadPeers(repo,d){
  var el=$('#dd-peers'); if(!el) return;
  if(!d.category){ el.innerHTML='<div class="dim">暂无分类</div>'; return }
  catsMap().then(function(cj){
    var ri=rowsIndex(); var list=(cj&&cj.cats&&cj.cats[d.category])||[];
    var peers=list.filter(function(x){return x!==repo}).map(function(x){var r=ri[x];return r?{repo:x,url:r[1],stars:r[2]}:null}).filter(Boolean)
      .sort(function(a,b){return b.stars-a.stars}).slice(0,5);
    el.innerHTML=peers.length?('<div>'+peers.map(function(pp){return '<div class="peer"><a href="'+escA(pp.url)+'" target="_blank">'+escA(pp.repo)+'</a><span class="num">★ '+pp.stars+'</span></div>'}).join('')+'</div>'):'<div class="dim">暂无同类</div>';
  }).catch(function(){el.innerHTML='<div class="dim">同类加载失败</div>'})
}
function closeDrawer(){$('#drawer').classList.remove('on');$('#scrim').classList.remove('on');document.body.style.overflow=''}
$('#dd-close').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;
document.addEventListener('keydown',function(ev){if(ev.key==='Escape')closeDrawer()});
$('#tb').addEventListener('click',function(ev){ if(ev.target.closest('a'))return; var tr=ev.target.closest('tr[data-repo]'); if(tr)openDrawer(tr.getAttribute('data-repo')) });
function repoOfTr(tr){ var a=tr.querySelector('a'); if(!a)return null; var m=a.getAttribute('href')||''; var i=m.indexOf('github.com/'); if(i<0)return null; m=m.slice(i+11); if(m.indexOf('?')>=0)m=m.slice(0,m.indexOf('?')); while(m.slice(-1)==='/')m=m.slice(0,-1); return m }
document.addEventListener('click',function(ev){ var tr=ev.target.closest('tr'); if(!tr||tr.closest('#tb'))return; if(ev.target.closest('a'))return; var rp=tr.getAttribute('data-repo')||repoOfTr(tr); if(rp)openDrawer(rp) });

readHash();
draw();
</script>
</body>
</html>`
  mkdirSync(SITE, { recursive: true })
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
    desc: (r.description || '').slice(0, 300),
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
    channels: { aw: enMap.get(r.full_name)?.inAwesome ? 1 : 0, im: enMap.get(r.full_name)?.inImsai ? 1 : 0 },
    weekly: enMap.get(r.full_name)?.weekly ?? null,
    llm: llmMap.get(r.full_name) ?? null,
    parts: (enMap.get(r.full_name)?.drops || []).map((d) => ({ label: d.label, v: -(SEVP[d.sev] || 5) })),
    dims: enMap.get(r.full_name)?.dimScores || {},
    npm: r.npm || { published: false },
  }))
  writeFileSync(join(SITE, 'plugins-detail.json'), JSON.stringify(detail))
  const cats = {}
  for (const pl of byStars) { const cat = enMap.get(pl.full_name)?.category; if (cat) (cats[cat] ??= []).push(pl.full_name) }
  writeFileSync(join(SITE, 'plugins-cats.json'), JSON.stringify({ generatedAt: new Date().toISOString(), cats }) + '\n')
  console.log(`[site] ${plugins.length} rows → site/index.html (${(html.length / 1024).toFixed(0)} KB) + plugins-detail.json (${(JSON.stringify(detail).length / 1024).toFixed(0)} KB) + plugins-cats.json (${(JSON.stringify(cats).length / 1024).toFixed(0)} KB)`)
}

main()
