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
import { stripEmoji, icon } from '../../lib/page.mjs'
import { t, ph, titleAttr, langBlock, I18N_CSS, I18N_HEAD, I18N_BODY } from '../../lib/i18n.mjs'

const OUT = join(SITE, 'dashboard', 'index.html')

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
  // B2：对外契约 insights.json 同样纳入混代守卫（badge/agent 消费它，混代=新插件徽章 404）
  const insightsTotal = readJson(PATHS.insights, {})?.meta?.total
  if (insightsTotal != null && insightsTotal !== plugins.length) {
    console.error(`[site] 快照混代：plugins.jsonl ${plugins.length} 行 vs insights.json meta.total ${insightsTotal}——请重跑 export-json（snapshot）再发布`)
    process.exit(1)
  }
  const llmMap = byFullName(readJsonl(PATHS.llm))
  const byStars = plugins.slice().sort((x, y) => (y.stars || 0) - (x.stars || 0))
  const totals = a.totals || {}
  const d = a.distribution || {}
  const pub = d.publish || {}
  const doc = d.docs || {}
  const lib = d.lib || {}

  // ---- compact rows for the table -------------------------------------
  const rows = plugins.map((r) => [
    r.full_name, r.html_url || '', r.stars || 0, (r.created_at || '').slice(0, 10),
    r.npm?.published ? (r.npm.latest || '✓') : '', r.metrics?.hasZhDocs ? 1 : 0,
    r.files?.libIndex && r.files?.libClient ? 1 : 0, (r.pushed_at && (Date.now() - new Date(r.pushed_at).getTime()) < 7 * 86400000) ? 1 : 0,
    stripEmoji(r.description || '').slice(0, 110),
    enMap.get(r.full_name)?.grade || '',
    enMap.get(r.full_name)?.score ?? 0,
    (r.pushed_at || '').slice(0, 10),
  ])
  const dataJson = JSON.stringify(rows).replace(/</g, '\\u003c')

  // ---- weekly multi-line chart (inline SVG, hover handled client-side) --
  const wkGrade = totals.byWeekGrades || {}
  const wkCand = a.coverage?.candidatesByWeek || {}
  const wkPresent = [...new Set([...Object.keys(totals.byWeek || {}), ...Object.keys(wkCand), ...Object.keys(wkGrade.A || {}), ...Object.keys(wkGrade.B || {}), ...Object.keys(wkGrade.S || {})])].sort()
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
    { key: 'cand', label: '候选新增', labelEn: 'New candidates', color: '#a1a1aa', data: wkCand },
    { key: 'gs', label: 'S 级新增', labelEn: 'New S-grade', color: '#7c3aed', data: wkGrade.S || {} },
    { key: 'auth', label: '权威集新增', labelEn: 'New authoritative', color: 'var(--ink)', data: totals.byWeek || {} },
    { key: 'ga', label: 'A 级新增', labelEn: 'New A-grade', color: 'var(--ok)', data: wkGrade.A || {} },
    { key: 'gb', label: 'B 级新增', labelEn: 'New B-grade', color: 'var(--accent)', data: wkGrade.B || {} },
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
  const legendHtml = SERIES.map((s) => '<span class="chlg"><i style="background:' + s.color + '"></i>' + t(s.label, s.labelEn) + '</span>').join('')
  const areaSvg = wkRows.length
    ? '<svg viewBox="0 0 ' + CW + ' ' + CH + '" style="width:100%;height:auto;display:block">' +
      gridLines + xLabels + seriesPaths + seriesDots +
      '<line id="ch-x" class="cross" style="display:none" y1="' + PT + '" y2="' + (PT + ih) + '"/>' +
      '</svg>'
    : `<div class="dim">${t('数据积累中…', 'Collecting data…')}</div>`
  const lastWeek = wkRows.length ? wkRows[wkRows.length - 1].auth : 0

  // ---- donuts ----------------------------------------------------------
  const donut = (parts, size = 118, sw = 21) => {
    const r = (size - sw) / 2
    const circ = 2 * Math.PI * r
    const total = parts.reduce((s2, p) => s2 + p.v, 0) || 1
    let off = 0
    const segs = parts.map((p, i) => {
      const len = Math.max(0, (p.v / total) * circ)
      const el = `<circle class="dseg" data-i="${i}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" data-tip="${esc(p.label)} · ${p.v}（${Math.round((p.v / total) * 1000) / 10}%）" data-tip-en="${esc(p.labelEn || p.label)} · ${p.v} (${Math.round((p.v / total) * 1000) / 10}%)"/>`
      off += len
      return el
    }).join('')
    return `<svg class="donut" data-total="${total}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">${segs}<circle cx="${size / 2}" cy="${size / 2}" r="${r * 0.72}" fill="var(--card)"/><text class="dnum" x="${size / 2}" y="${size / 2 + 3}">${total}</text><text class="dlab" x="${size / 2}" y="${size / 2 + 16}">总计</text></svg>`
  }
  const donutPublish = donut([{ v: pub.published, c: 'var(--ink)', label: '已发布', labelEn: 'Published' }, { v: pub.unpublished, c: 'var(--track2)', label: '未发布', labelEn: 'Unpublished' }])
  const donutDocs = donut([
    { v: doc.both, c: '#18181b', label: '双语(EN+中文)', labelEn: 'Bilingual (EN+ZH)' },
    { v: Math.max(0, doc.zh - doc.both), c: '#52525b', label: '含中文', labelEn: 'Has Chinese' },
    { v: Math.max(0, doc.readme - doc.zh), c: '#a1a1aa', label: '单语', labelEn: 'Single-language' },
    { v: doc.none, c: '#e4e4e7', label: '无 README', labelEn: 'No README' },
  ])

  const bar = (label, count, max, color, title, en) => {
    const tip = esc(title || `${label} · ${count}`)
    const tipEn = en ? esc(en.tip || `${en.label} · ${count}`) : ''
    return '<div class="hbar" data-tip="' + tip + '"' + (tipEn ? ' data-tip-en="' + tipEn + '"' : '') + '><span class="hbar-l"' + (title ? ' title="' + tip + '"' + (tipEn ? ' data-en-title="' + tipEn + '"' : '') : '') + '>' + (en ? t(label, en.label) : esc(label)) + '</span>' +
      '<div class="hbar-t"><div class="hbar-f" style="width:' + Math.max(2, Math.round((count / Math.max(1, max)) * 100)) + '%' + (color ? ';background:' + color : '') + '"></div></div>' +
      '<span class="hbar-v">' + count + '</span></div>'
  }

  const topicBars = (a.topTopics || []).slice(0, 8).map((x) => bar(x.topic, x.count, (a.topTopics || [])[0]?.count || 1, null, x.topic)).join('')

  // ---- coverage funnel（口径透明：为什么权威集 ≪ topic 宇宙） -------------
  const cov = a.coverage || {}
  const uni = cov.topicUniverse?.count || 0
  const uniAt = (cov.topicUniverse?.at || '').slice(0, 10)
  const invalidTotal = (cov.invalidBuckets || []).reduce((s2, b) => s2 + b.count, 0)
  const bucketsTxt = (cov.invalidBuckets || []).slice(0, 5).map((b) => `${esc(b.reason)} ${b.count}`).join(' · ')
  const funnelHtml = uni ? [
    bar('topic 宇宙', uni, uni, null, `topic:dsh-plugin 全量（${uniAt} 实测）· 官方打标即入、零门槛`, { label: 'Topic universe', tip: `Full topic:dsh-plugin set (measured ${uniAt}) · official tag, zero barrier to entry` }),
    bar('多源候选', cov.candidates || 0, uni, null, 'topic 分片全量 ∪ 策展目录 ∪ npm 映射（含未打 dsh-plugin topic 的仓库，故候选数可超过 topic 宇宙）· 去重', { label: 'Multi-source candidates', tip: 'Full topic shards ∪ curated lists ∪ npm mapping (includes repos without the dsh-plugin topic, so candidates can exceed the topic universe) · deduplicated' }),
    bar('完成校验', cov.validated || 0, uni, null, 'manifest 门禁逐条核验（断点续跑）', { label: 'Validated', tip: 'Verified item by item through the manifest gate (resumable)' }),
    bar('权威集 ✓', cov.authoritative || 0, uni, 'var(--ok)', '非 fork/归档 + 声明 dsh.bundle.patch 且 patch 已提交', { label: 'Authoritative ✓', tip: 'Not a fork/archived + declares dsh.bundle.patch with the patch committed' }),
  ].join('') : ''

  const gCol = { S: '#7c3aed', A: 'var(--ok)', B: 'var(--accent)', C: 'var(--warn)', D: 'var(--err)' }
  const gMax = Math.max(1, ...Object.keys(gCol).map((k) => a.quality?.grades?.[k] || 0))
  const gradesHtml = Object.keys(gCol).map((k) => bar(k, a.quality?.grades?.[k] || 0, gMax, gCol[k])).join('')
  const catsMax = Math.max(1, ...(a.categories || []).map((x) => x.count))
  const catsHtml = (a.categories || []).slice(0, 8).map((x) => bar(x.category, x.count, catsMax, null, x.category)).join('')

  const staleRows = (a.npmStaleTop || []).map((s2) =>
    `<tr><td><a href="/p/${esc(s2.repo)}/" title="${esc(s2.repo)}">${esc(s2.repo)}</a></td><td class="num mono">${s2.stars}</td><td class="num warn mono">${esc(s2.repoVersion)} → ${esc(s2.npmLatest)}</td></tr>`).join('')
  const starRows = (a.topByStars || []).map((s2) =>
    `<tr><td><a href="/p/${esc(s2.repo)}/" title="${esc(s2.repo)}">${esc(s2.repo)}</a></td><td class="num mono">★ ${s2.stars}</td><td class="num">${s2.published ? '<span class="ok" title="npm 已发布" data-en-title="Published to npm">✓</span>' : '<span class="dim">—</span>'}</td><td class="num">${s2.zh ? '<span class="ok" title="中/双语文档" data-en-title="Chinese/bilingual docs">✓</span>' : '<span class="dim">—</span>'}</td></tr>`).join('')
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
<meta name="en-title" content="DSH Insights · The DeepSeek Harness Observatory">
<meta name="description" content="DeepSeek Harness (dsh) 插件生态全量索引、评估与分析仪表盘">
<meta property="og:title" content="DSH Insights · DeepSeek Harness 全景观察站">
<meta property="og:description" content="插件健康 · 官方动态 · 生态趋势——全量、客观、可复核的 DSH 生态观测。">
<meta property="og:type" content="website">
<meta property="og:image" content="https://dsh-insights.com/og.png">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="logo.svg">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script defer src="https://cloud.umami.is/script.js" data-website-id="7fc5eb24-1687-4827-9775-5326d957b46a"></script>
<script>(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light')t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}})()</script>
${I18N_HEAD}
<style>
:root{
  --bg:#fafafa;--card:#ffffff;--ink:#18181b;--mut:#71717a;--faint:#a1a1aa;--line:#e4e4e7;--track:#f4f4f5;--track2:#e4e4e7;
  --accent:#2563eb;--ok:#059669;--warn:#d97706;--err:#dc2626;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --ease:cubic-bezier(.16,1,.3,1)
}
:root[data-theme=dark]{--bg:#09090b;--card:#101012;--ink:#f4f4f5;--mut:#a1a1aa;--faint:#71717a;--line:#26262a;--track:#17171a;--track2:#27272a;--accent:#60a5fa}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#09090b;--card:#101012;--ink:#f4f4f5;--mut:#a1a1aa;--faint:#71717a;--line:#26262a;--track:#17171a;--track2:#27272a;--accent:#60a5fa}}
.theme{border:1px solid var(--line);background:var(--card);color:var(--mut);border-radius:7px;padding:4px 7px;height:26px;cursor:pointer;display:inline-flex;align-items:center;margin-left:6px}
.theme:hover{color:var(--ink)}
.theme .t-sun{display:none}
:root[data-theme=dark] .theme .t-sun{display:inline-flex}
:root[data-theme=dark] .theme .t-moon{display:none}
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
.hero .lede{margin:12px 0 0;color:var(--mut);font-size:14.5px;max-width:1100px}
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
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
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
.cards .ptable td:first-child{max-width:220px;overflow:hidden;text-overflow:ellipsis}
.cards .panel{min-width:0}
.cards .ptable{table-layout:fixed;width:100%}
.cards .ptable td{overflow:hidden;text-overflow:ellipsis;max-width:0}
.cards .ptable th:first-child,.cards .ptable td:first-child{width:44%;max-width:none}
.cards .ptable td:nth-child(2).pick-cat{max-width:96px;overflow:hidden;text-overflow:ellipsis;color:var(--mut)}
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
${I18N_CSS}
</style>
</head>
<body>
<div class="topbar"><div class="wrap">
  <a class="brand" href="/"><span class="mark"><svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="var(--ink)"/><path d="M25 16H16v32h9" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M39 16h9v32h-9" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="38.75" y="18" width="3.5" height="26" rx="1.75" fill="#4D6BFE"/><circle cx="30.5" cy="35" r="6.5" fill="none" stroke="#4D6BFE" stroke-width="3.5"/></svg></span>DSH Insights<small>${t('DeepSeek Harness 全景观察站', 'The DeepSeek Harness Observatory')}</small></a>
  <nav class="nav"><a href="/">${t('首页', 'Home')}</a><a href="./" class="here">${t('插件', 'Plugins')}</a><a href="/scenarios/">${t('场景', 'Scenarios')}</a><a href="/weekly/">${t('周报', 'Weekly')}</a><a href="/insights/">${t('洞察', 'Insights')}</a><a href="/dynamics/">${t('动态', 'Dynamics')}</a><a href="/authors/">${t('作者', 'Authors')}</a><a href="/badge/">${t('徽章', 'Badge')}</a><a href="/data/">${t('开放数据', 'Open Data')}</a><a href="/about/">${t('关于', 'About')}</a><button class="theme lang" id="langBtn" ${titleAttr('切换到 English', 'Switch to 中文')}>EN</button><button class="theme" id="themeBtn" ${titleAttr('深 / 浅色切换', 'Toggle dark / light')}><span class="t-moon">${icon('moon', 13)}</span><span class="t-sun">${icon('sun', 13)}</span></button><a class="gh" href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub ↗</a></nav>
</div></div>
<div class="subnav"><div class="wrap">
  <a href="#overview">${t('趋势', 'Trends')}</a><a href="#quality">${t('质量', 'Quality')}</a><a href="#rank">${t('榜单', 'Leaderboards')}</a><a href="#browse">${t('插件库', 'Directory')}</a>
</div></div>

<header class="hero" id="top"><div class="wrap">
  <p class="kicker">${t('Plugins · 客观索引与评分', 'Plugins · Objective Index & Scoring')}</p>
  <h1>${t('插件生态全景', 'The Plugin Ecosystem, in Full')}</h1>
  <p class="lede">${t('多源发现 → manifest 真伪校验 → 元数据评估（npm / 文档 / 构建产物 / 活跃度）→ 生态洞察。启发式评估，非安全审计。', 'Multi-source discovery → manifest authenticity checks → metadata evaluation (npm / docs / build artifacts / activity) → ecosystem insights. Heuristic evaluation, not a security audit.')}</p>
  <div class="meta"><span>${t('快照', 'Snapshot')} <b>${date}</b></span><span>${t('最近一周新增', 'Added last week')} <b class="mono">+${lastWeek}</b></span><span><a href="https://github.com/ice5kysl/dsh-insights/blob/main/README.md" target="_blank">${t('方法论 ↗', 'Methodology ↗')}</a></span></div>
  <div class="bignum"><b class="count mono" data-v="${totals.authoritative ?? 0}">0</b><span>${t('权威插件', 'Authoritative plugins')}<br>${t('通过 dsh.bundle manifest 校验', 'Verified via the dsh.bundle manifest gate')}</span></div>
  <div class="stats">
    ${stat((d.publishPct != null ? d.publishPct + '%' : '—'), t('npm 发布率', 'npm publish rate'), t(`${pub.published ?? 0} 已发布 · ${pub.stale ?? 0} 滞后`, `${pub.published ?? 0} published · ${pub.stale ?? 0} stale`))}
    ${stat((d.zhPct != null ? d.zhPct + '%' : '—'), t('i18n 双语（中/英检出）', 'i18n bilingual (ZH/EN detected)'), t(`${doc.both ?? 0} 份双语文档`, `${doc.both ?? 0} bilingual docs`))}
    ${stat((totals.active7Pct ?? 0) + '%', t('近 7 天活跃', 'Active in 7d'), t(`以周为基准的生态活跃信号 · 30 天 ${totals.active30Pct ?? 0}%`, `Weekly activity signal · 30d ${totals.active30Pct ?? 0}%`))}
    ${stat(a.quality?.avgScore ?? '—', t('平均质量分', 'Avg health score'), 'S+A ' + (a.quality?.gradePctSA ?? a.quality?.gradePct ?? 0) + '%')}
    ${stat(a.channels ? a.channels.coveredPct + '%' : '—', t('curated 收录率', 'Curated listing rate'), t(`${a.channels?.covered ?? 0} 已进 awesome/imsai`, `${a.channels?.covered ?? 0} in awesome/imsai`))}
    ${stat(doc.none ?? 0, t('无 README', 'No README'), t('建议补充基本文档', 'Basic docs recommended'))}
  </div>
</div></header>

<main class="wrap">

<section class="sec" id="overview">
  <div class="sec-h"><span class="sec-n">01</span><h2>${t('生态趋势', 'Ecosystem Trends')}</h2><p class="sub">${t('增长节奏 · 发布与文档覆盖 · 热门话题', 'Growth pace · publishing & docs coverage · hot topics')}</p></div>
  ${funnelHtml ? `<div class="panel" style="margin-bottom:14px">
    <div class="p-h"><h3>${t(`覆盖漏斗 · ${cov.authoritative} 与 ${uni.toLocaleString()} 的关系`, `Coverage Funnel · ${cov.authoritative} vs ${uni.toLocaleString()}`)}</h3><span class="p-sub">${t(`分桶复核 ${invalidTotal}：${bucketsTxt}`, `${invalidTotal} in review buckets: ${bucketsTxt}`)}</span></div>
    ${funnelHtml}
    <div class="p-sub" style="margin-top:10px">${langBlock(
      'topic 是「打标即入」的原始宇宙——含蹭标、无关仓库、fork、monorepo 子路径与已删除仓库；权威集是 manifest 门禁逐条核验后的可信子集，<b>校验按 API 预算滚动推进（断点续跑），权威集随快照持续扩大</b>；候选池 = topic ∪ 策展 ∪ npm，含未打 topic 的仓库，故可能大于 topic 宇宙。纯 tarball 分发等边界形态进分桶人工复核。口径详见 <a href="about/">方法论</a>。',
      'The topic universe is tag-and-you\'re-in raw data — it includes tag squatters, unrelated repos, forks, monorepo subpaths, and deleted repos. The authoritative set is the trusted subset verified item by item through the manifest gate; <b>verification rolls forward within an API budget (resumable), so the authoritative set grows with every snapshot</b>. The candidate pool = topic ∪ curated ∪ npm and includes repos without the topic, so it can exceed the topic universe. Edge cases such as pure tarball distribution go to bucketed manual review. Definitions: <a href="about/">Methodology</a>.'
    )}</div>
  </div>` : ''}
  <div class="panel" style="margin-bottom:14px">
    <div class="p-h"><h3>${t('生态新增 · 按周', 'New Additions · Weekly')}</h3><span class="p-sub">${langBlock(`按仓库创建时间归属到周一 · 最近 ${wkRows.length} 周`, `Grouped by repo creation week (Mondays) · last ${wkRows.length} weeks`, 'span')} · ${legendHtml}</span></div>
    <div class="chartbox" id="chart-week">${areaSvg}<div class="ch-tip" id="ch-tip"></div></div>
  </div>
  <div class="cards">
    <div class="panel">
      <h3>${t('npm 发布分布', 'npm Publish Status')}</h3><p class="p-sub">${t(`已发布 vs 未发布 · 版本滞后 ${pub.stale ?? 0}`, `Published vs unpublished · ${pub.stale ?? 0} stale`)}</p>
      <div class="donutwrap">${donutPublish}<div class="legend">
        <div class="dleg" data-i="0"><i style="background:var(--ink)"></i>${t('已发布', 'Published')} <b>${pub.published ?? 0}</b></div>
        <div class="dleg" data-i="1"><i style="background:var(--track2)"></i>${t('未发布', 'Unpublished')} <b>${pub.unpublished ?? 0}</b></div>
        <div style="color:var(--warn)">${t(`版本滞后 ${pub.stale ?? 0}`, `${pub.stale ?? 0} stale`)}</div>
      </div></div>
    </div>
    <div class="panel">
      <h3>${t('i18n · 文档语言足迹', 'i18n · Doc Language Footprint')}</h3><p class="p-sub">${t('按 README 检出：双语 / 含中文 / 单语 / 无 · 多语言(ja/ko/…)检测规划见 M1', 'Detected from README: bilingual / has Chinese / single-language / none · multi-language (ja/ko/…) detection planned in M1')}</p>
      <div class="donutwrap">${donutDocs}<div class="legend">
        <div class="dleg" data-i="0"><i style="background:#18181b"></i>${t('双语(EN+中文)', 'Bilingual (EN+ZH)')} <b>${doc.both ?? 0}</b></div>
        <div class="dleg" data-i="1"><i style="background:#52525b"></i>${t('含中文（i18n 样本）', 'Has Chinese (i18n sample)')} <b>${Math.max(0, (doc.zh ?? 0) - (doc.both ?? 0))}</b></div>
        <div class="dleg" data-i="2"><i style="background:#a1a1aa"></i>${t('单语（基础 README）', 'Single-language (basic README)')} <b>${Math.max(0, (doc.readme ?? 0) - (doc.zh ?? 0))}</b></div>
        <div class="dleg" data-i="3"><i style="background:#e4e4e7"></i>${t('无 README', 'No README')} <b>${doc.none ?? 0}</b></div>
      </div></div>
    </div>
    <div class="panel">
      <h3>Top topics</h3><p class="p-sub">${t('仓库自声明 topic · Top 8', 'Self-declared repo topics · Top 8')}</p>
      ${topicBars || `<div class="dim">${t('暂无', 'No data yet')}</div>`}
    </div>
  </div>
</section>

<section class="sec" id="quality">
  <div class="sec-h"><span class="sec-n">02</span><h2>${t('质量分布', 'Quality Distribution')}</h2><p class="sub">${t('启发式评分 · 功能分类 · 各场景首选', 'Heuristic scoring · categories · top pick per scenario')}</p></div>
  <div class="cards">
    <div class="panel">
      <h3>${t('质量分级', 'Quality Grades')}</h3><p class="p-sub">${t(`平均分 ${a.quality?.avgScore ?? 0} · S+A ${a.quality?.gradePctSA ?? a.quality?.gradePct ?? 0}%`, `Avg score ${a.quality?.avgScore ?? 0} · S+A ${a.quality?.gradePctSA ?? a.quality?.gradePct ?? 0}%`)}</p>
      ${gradesHtml}
    </div>
    <div class="panel">
      <h3>${t('功能分类', 'Categories')}</h3><p class="p-sub">${t('按名称/描述归类 · Top 8', 'Grouped by name/description · Top 8')}</p>
      ${catsHtml}
    </div>
    <div class="panel">
      <h3>${t('场景推荐 · 各分类首选', 'Scenario Picks · Top Pick by Category')}</h3><p class="p-sub">${t('每个分类里质量/活跃度最高 · 点击行看详情', 'Highest quality/activity per category · click a row for details')}</p>
      <table class="ptable"><thead><tr><th>${t('推荐', 'Pick')}</th><th>${t('场景', 'Scenario')}</th><th class="num">★</th><th class="num">${t('质量', 'Grade')}</th></tr></thead><tbody>${topPickHtml || `<tr><td class="dim">${t('暂无', 'No data yet')}</td></tr>`}</tbody></table>
    </div>
  </div>
</section>

<section class="sec" id="rank">
  <div class="sec-h"><span class="sec-n">03</span><h2>${t('榜单', 'Leaderboards')}</h2><p class="sub">${t('社区关注 · 发布健康 · 值得收录', 'Community attention · release health · worth listing')}</p></div>
  <div class="cards">
    <div class="panel">
      <h3>${t('Star 榜 Top 10', 'Top 10 by Stars')}</h3><p class="p-sub">${t('社区关注度最高的权威插件', 'Most-starred authoritative plugins')}</p>
      <table class="ptable"><thead><tr><th>${t('仓库', 'Repository')}</th><th class="num">★</th><th class="num">npm</th><th class="num">i18n</th></tr></thead><tbody>${starRows || `<tr><td class="dim">${t('暂无', 'No data yet')}</td></tr>`}</tbody></table>
    </div>
    <div class="panel">
      <h3>${t('npm 版本滞后榜', 'npm Version Lag')}</h3><p class="p-sub">${t('仓库已领先于 npm 发布 · Top 10', 'Repo ahead of the npm release · Top 10')}</p>
      <table class="ptable"><thead><tr><th>${t('仓库', 'Repository')}</th><th class="num">★</th><th class="num">${t('仓库 → npm', 'Repo → npm')}</th></tr></thead><tbody>${staleRows || `<tr><td class="dim">${t('暂无', 'No data yet')}</td></tr>`}</tbody></table>
    </div>
    <div class="panel">
      <h3>${t('优质未收录 · 建议收录', 'Quality & Unlisted · Suggested')}</h3><p class="p-sub">${t('A/B 级 · 已发布 npm · 尚未进 awesome/imsai · Top 10', 'Grade A/B · published to npm · not yet in awesome/imsai · Top 10')}</p>
      <table class="ptable"><thead><tr><th>${t('仓库', 'Repository')}</th><th class="num">${t('质量', 'Grade')}</th><th class="num">★</th><th>${t('npm / 周下载', 'npm / Weekly Downloads')}</th></tr></thead><tbody>
      ${suggestedHtml || `<tr><td class="dim">${t('暂无（请先跑 00-lists + analyze）', 'None yet (run 00-lists + analyze first)')}</td></tr>`}
      </tbody></table>
    </div>
    <div class="panel">
      <h3>${t('作者榜 Top 10', 'Top 10 Authors')}</h3><p class="p-sub">${langBlock('按 A/B 级插件数', 'By A/B-grade plugin count', 'span')} · <a href="authors/">${t(`全部 ${a.authorStats?.total ?? ''} 位作者 →`, `All ${a.authorStats?.total ?? ''} authors →`)}</a></p>
      <table class="ptable"><thead><tr><th>${t('作者', 'Author')}</th><th class="num">${t('插件', 'Plugins')}</th><th class="num">A/B</th><th class="num">${t('★合计', '★ Total')}</th></tr></thead><tbody>${authorRows || `<tr><td class="dim">${t('暂无', 'No data yet')}</td></tr>`}</tbody></table>
    </div>
  </div>
</section>

<section class="sec" id="browse">
  <div class="sec-h"><span class="sec-n">04</span><h2>${t('插件库', 'Plugin Directory')}</h2><p class="sub">${t(`搜索 / 筛选 / 排序 · 状态同步到 URL，可直接分享 · 已加载 ${plugins.length} 个`, `Search / filter / sort · state synced to the URL, shareable · ${plugins.length} loaded`)}</p></div>
  <div class="toolbar">
    <input type="text" id="q" ${ph('搜索仓库名 / 描述…', 'Search repo name / description…')} autocomplete="off">
    <select id="f-gr" class="fsel" ${titleAttr('质量等级筛选', 'Filter by quality grade')}>
      <option value="">${t('全部等级', 'All grades')}</option><option value="S">${t('S 级', 'Grade S')}</option><option value="A">${t('A 级', 'Grade A')}</option><option value="B">${t('B 级', 'Grade B')}</option><option value="C">${t('C 级', 'Grade C')}</option><option value="D">${t('D 级', 'Grade D')}</option>
    </select>
    <select id="f-npm" class="fsel" ${titleAttr('npm 状态筛选', 'Filter by npm status')}>
      <option value="">${t('全部 npm', 'All npm')}</option><option value="pub">${t('已发布', 'Published')}</option><option value="unpub">${t('未发布', 'Unpublished')}</option><option value="stale">${t('版本滞后', 'Stale')}</option>
    </select>
    <button class="chip" data-zh="0">${t('i18n·中英', 'i18n zh/en')}</button>
    <button class="chip" data-active="1">${t('近 7 天活跃', 'Active in 7d')}</button>
    <select id="f-sort" class="fsel" ${titleAttr('排序', 'Sort')}>
      <option value="">${t('默认（★ 降序）', 'Default (★ desc)')}</option><option value="stars-asc">${t('★ 最少', '★ fewest')}</option><option value="new">${t('最新创建', 'Newest')}</option><option value="old">${t('最早创建', 'Oldest')}</option><option value="active">${t('最近活跃', 'Recently active')}</option><option value="score">${t('质量分', 'Score')}</option><option value="name">${t('名称 A→Z', 'Name A→Z')}</option>
    </select>
    <details class="cols"><summary>${t('列 ▾', 'Columns ▾')}</summary><div class="menu">
      <label><input type="checkbox" checked data-col="created">${t('创建日期', 'Created')}</label>
      <label><input type="checkbox" checked data-col="zh">${t('i18n·中英', 'i18n zh/en')}</label>
      <label><input type="checkbox" checked data-col="lib">${t('双产物', 'Dual artifacts')}</label>
      <label><input type="checkbox" checked data-col="act">${t('活跃', 'Active')}</label>
    </div></details>
  </div>
  <div class="tbl-wrap">
  <table class="ptable">
    <thead><tr>
      <th data-k="0">${t('仓库', 'Repository')}</th><th data-k="2" class="num">★</th><th data-k="3" class="c-created">${t('创建', 'Created')}</th><th data-k="4">npm</th><th data-k="5" class="c-zh">${t('i18n·中英', 'i18n zh/en')}</th><th data-k="6" class="c-lib">${t('双产物', 'Dual artifacts')}</th><th data-k="7" class="c-act">${t('活跃', 'Active')}</th><th>${t('质量', 'Grade')}</th><th>${t('描述', 'Description')}</th>
    </tr></thead>
    <tbody id="tb"></tbody>
  </table></div>
  <div class="pager"><button id="prev">${t('‹ 上一页', '‹ Prev')}</button><span id="info"></span><button id="next">${t('下一页 ›', 'Next ›')}</button></div>
</section>

<footer>
  <span>${t('由', 'Built by')} <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">dsh-insights</a> ${t('管线自动生成', 'pipeline, generated automatically')} · ${date}</span>
  <span>${t('零依赖 · GitHub API + npm · 启发式评估，非安全审计', 'Zero-dependency · GitHub API + npm · heuristic evaluation, not a security audit')} · <a href="/changelog/">${t('更新日志', 'Changelog')}</a></span>
</footer>
</main>


<script>
const ROWS=${dataJson};
const WKS=${JSON.stringify(wkRows).replace(/</g, '\\u003c')};
const WSERIES=${JSON.stringify(SERIES.map((s) => ({ key: s.key, label: s.label, labelEn: s.labelEn, color: s.color }))).replace(/</g, '\\u003c')};
const $=s=>document.querySelector(s);
// i18n helpers — I18N_BODY loads after this script, so fall back to :root[data-lang] (set by I18N_HEAD in <head>)
var __lang=window.__lang||function(){return document.documentElement.dataset.lang==='en'?'en':'zh'};
var __t=window.__t||function(zh,en){return __lang()==='en'?en:zh};
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
      return '<div><i style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:'+s.color+'"></i>'+__t(s.label,s.labelEn)+' <b style="margin-left:6px">+'+p[s.key]+'</b></div>' }).join('');
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
    if(!t)return; tip.textContent=(__lang()==='en'&&t.getAttribute('data-tip-en'))||t.getAttribute('data-tip'); tip.style.display='block'; move(ev);
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
      var raw=(__lang()==='en'&&seg.getAttribute('data-tip-en'))||seg.getAttribute('data-tip')||'';
      var t=raw.split(' · ');
      dnum.textContent=t[1]?t[1].split(/[（(]/)[0]:''; dlab.textContent=t[0]||''; }
    else { dnum.textContent=total; dlab.textContent=__t('总计','Total') }
  }
  segs.forEach(function(s){
    s.addEventListener('mouseenter',function(){ sel(s.getAttribute('data-i'),true) });
    s.addEventListener('mouseleave',function(){ sel(0,false) });
  });
  wrap.querySelectorAll('.dleg').forEach(function(l){
    l.addEventListener('mouseenter',function(){ sel(l.getAttribute('data-i'),true) });
    l.addEventListener('mouseleave',function(){ sel(0,false) });
  });
  dlab.textContent=__t('总计','Total');
  document.addEventListener('langchange',function(){ if(!svg.classList.contains('has-sel'))dlab.textContent=window.__t('总计','Total') });
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
  $('#tb').innerHTML=seg.map(r=>'<tr data-repo="'+e(r[0])+'"><td><a href="/p/'+e(r[0])+'/">'+e(r[0])+'</a></td><td class="num mono">'+r[2]+'</td><td class="c-created mono" style="color:var(--mut)">'+r[3]+'</td><td>'+(r[4]?'<span class="ok mono">'+e(r[4])+'</span>':'<span class="dim">—</span>')+'</td><td class="c-zh">'+(r[5]?'✓':'')+'</td><td class="c-lib">'+(r[6]?'✓':'')+'</td><td class="c-act">'+(r[7]?'✓':'')+'</td><td>'+(r[9]?'<span class="grade '+e(r[9])+'">'+e(r[9])+'</span>':'')+'</td><td class="desc">'+e(r[8])+'</td></tr>').join('')||'<tr><td colspan="9" class="dim" style="padding:24px;text-align:center">'+__t('无匹配 — 试试放宽筛选条件','No matches — try loosening the filters')+'</td></tr>';
  $('#info').textContent=__t('第 '+(page+1)+'/'+pages+' 页 · 共 '+list.length+' 条','Page '+(page+1)+'/'+pages+' · '+list.length+' plugins');
  $('#prev').disabled=page===0;$('#next').disabled=page>=pages-1;
  document.querySelectorAll('.ptable th[data-k]').forEach(th=>{
    const k=+th.dataset.k;
    th.querySelectorAll('.arr').forEach(x=>x.remove());
    if(sort===k){const s=document.createElement('span');s.className='arr';s.textContent=' '+(desc?'↓':'↑');th.appendChild(s)}
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

function repoOfTr(tr){ var a=tr.querySelector('a'); if(!a)return null; var m=a.getAttribute('href')||''; var i=m.indexOf('/p/'); if(i<0)return null; m=m.slice(i+3); if(m.indexOf('?')>=0)m=m.slice(0,m.indexOf('?')); while(m.slice(-1)==='/')m=m.slice(0,-1); return m }
document.addEventListener('click',function(ev){ var tr=ev.target.closest('tr'); if(!tr||tr.closest('#tb'))return; if(ev.target.closest('a'))return; var rp=tr.getAttribute('data-repo')||repoOfTr(tr); if(rp)location.href='/p/'+rp+'/' });

readHash();
draw();
document.addEventListener('langchange',function(){ draw() });
(function(){var b=document.getElementById('themeBtn');if(!b)return;b.addEventListener('click',function(){var r=document.documentElement;var d=r.dataset.theme==='dark'?'light':'dark';r.dataset.theme=d;try{localStorage.setItem('theme',d)}catch(e){}})})();
</script>
${I18N_BODY}
</body>
</html>`
  mkdirSync(join(SITE, 'dashboard'), { recursive: true })
  writeFileSync(OUT, html)

  // ---- /plugins/ → /dashboard/#browse 永久跳转（已并入「插件」页，2026-09-06） ----
  // 旧 URL 已被外发/README 引用过，保留为 0 秒跳转页而不是 404。
  const pluginsHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=/dashboard/#browse">
<link rel="canonical" href="/dashboard/">
<title>插件库 · DSH Insights</title>
<meta name="en-title" content="Plugin Directory · DSH Insights">
<meta name="robots" content="noindex">
${I18N_HEAD}
</head>
<body style="margin:0;background:#fafafa;color:#18181b;font:14px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<p>${t('已并入「插件」页——正在跳转', 'Merged into the Plugins page — redirecting')} <a href="/dashboard/#browse">/dashboard/#browse</a> ……</p>
${I18N_BODY}
</body>
</html>
`
  mkdirSync(join(SITE, 'plugins'), { recursive: true })
  writeFileSync(join(SITE, 'plugins', 'index.html'), pluginsHtml)
  console.log(`[site] ${plugins.length} rows → dashboard/index.html (${(html.length / 1024).toFixed(0)} KB) + plugins/index.html（跳转页，插件库已并入 /dashboard/#browse）`)
}

main()
