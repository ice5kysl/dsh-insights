#!/usr/bin/env node
/**
 * Stage 4 — generate a self-contained static analysis site (no build deps).
 *
 * Output: site/index.html with the analysis summary + health-score stats +
 * a searchable, score-sorted table of the authoritative set (embeds a trimmed
 * dataset inline, links the full JSONL / insights.json / scored.jsonl).
 *
 * @module dsh-plugin-insights/stage-4
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scoreAll } from './08-score.mjs'

const ROOT = join(import.meta.dirname, '..')

function readRows(f) {
  const rows = []
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { /* tolerate partial append */ }
  }
  return rows
}

function main() {
  const plugins = readRows(join(ROOT, 'data', 'plugins.jsonl'))
  let analysis = {}
  try { analysis = JSON.parse(readFileSync(join(ROOT, 'data', 'analysis.json'), 'utf8')) } catch { /* ok */ }
  const { out: scoredRows, summary } = scoreAll(plugins)
  const healthBy = new Map(scoredRows.map((r) => [r.full_name, r.health]))

  const gradeColor = { A: '#15803d', B: '#2d66f7', C: '#b45309', D: '#b91c1c' }
  const rows = plugins.map((r) => {
    const h = healthBy.get(r.full_name)
    return {
      repo: r.full_name,
      url: r.html_url,
      stars: r.stars || 0,
      score: h?.score ?? null,
      grade: h?.grade ?? null,
      desc: (r.description || '').slice(0, 120),
      npm: r.npm?.published ? `✅ ${r.npm.latest}` : '—',
      zh: (r.files?.readmeZh || r.metrics?.hasZhDocs) ? '✅' : '—',
      lib: (r.files?.libIndex && r.files?.libClient) ? '✅' : '~',
      active: r.metrics?.active30 ? '✅' : '—',
      created: (r.created_at || '').slice(0, 10),
    }
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.stars - a.stars))
  const dataJson = JSON.stringify(rows).replace(/</g, '\\u003c')

  const months = Object.entries(analysis.totals?.byMonth || {}).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).slice(-10)
  const maxMonth = Math.max(1, ...months.map(([, c]) => c))
  let monthsHtml = ''
  if (months.length) {
    monthsHtml = '<h2>月度新增（权威集 · 按仓库创建）</h2><div style="margin:8px 0">'
    for (const [m, c] of months) {
      const w = Math.max(1, Math.round((c / maxMonth) * 100))
      monthsHtml += `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:64px;color:var(--mut)">${m}</span><div style="height:14px;background:var(--brand);border-radius:4px;width:${w}%"></div><span style="color:var(--mut);font-size:12px">${c}</span></div>\n`
    }
    monthsHtml += '</div>'
  }

  const totals = analysis.totals || {}
  const dist = analysis.distribution || {}
  const g = summary.grades || {}
  const gradeBar = ['A', 'B', 'C', 'D'].map((k) => {
    const n = g[k] ?? 0
    const pct = summary.total ? Math.round((n / summary.total) * 100) : 0
    return `<span style="color:${gradeColor[k]};font-weight:700">${k}</span> ${n} <small style="color:var(--mut)">(${pct}%)</small>`
  }).join(' · ')

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>dsh 插件生态洞察 · dsh-plugin-insights</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--fg:#1c2333;--mut:#6b7280;--line:#e5e7eb;--brand:#2d66f7}
*{box-sizing:border-box}body{font:14px/1.6 -apple-system,"PingFang SC",sans-serif;color:var(--fg);max-width:1080px;margin:0 auto;padding:24px}
h1{font-size:22px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid var(--line);padding-bottom:6px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}
.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.card b{display:block;font-size:24px;color:var(--brand)}.card span{color:var(--mut);font-size:12px}
.chip{display:inline-block;min-width:38px;text-align:center;padding:2px 6px;border-radius:999px;color:#fff;font-weight:700;font-size:12px;margin-right:6px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td.d{white-space:normal;max-width:320px;color:var(--mut);overflow:hidden;text-overflow:ellipsis}
input{padding:8px 10px;border:1px solid var(--line);border-radius:8px;width:280px;margin:8px 0}
a{color:var(--brand);text-decoration:none}
footer{margin-top:40px;color:var(--mut);font-size:12px}
</style></head><body>
<h1>dsh 插件生态洞察 <small style="color:var(--mut)">· dsh-plugin-insights</small></h1>
<p style="color:var(--mut)">权威集（通过 dsh.bundle manifest 校验）快照 · 生成 ${(new Date().toISOString()).slice(0, 16).replace('T', ' ')} · 规则 ${summary.ruleVersion} · 健康分为<b>客观启发式信号，非安全审计</b> · <a href="https://github.com/ice5kysl/dsh-plugin-insights">仓库</a></p>
<div class="stats">
<div class="card"><b>${totals.authoritative ?? plugins.length}</b><span>权威插件数</span></div>
<div class="card"><b>${dist.publish?.published ?? 0}</b><span>npm 已发布</span></div>
<div class="card"><b>${dist.docs?.both ?? 0}</b><span>中英/双语文档</span></div>
<div class="card"><b>${dist.lib?.both ?? 0}</b><span>host+client 双产物</span></div>
<div class="card"><b>${totals.active30Pct ?? 0}%</b><span>近30天活跃</span></div>
<div class="card"><b>${summary.avg ?? 0}</b><span>平均健康分 (中位 ${summary.median})</span></div>
</div>
<h2 style="margin-top:8px;border:none">健康分分布 <small style="color:var(--mut);font-weight:400">（A≥90 · B≥75 · C≥60 · D<60）</small></h2>
<p style="margin:4px 0 0">${gradeBar}</p>
${monthsHtml}
<h2>插件列表（按健康分排序，可搜索）</h2>
<input id="q" placeholder="过滤：名称 / 描述 / 评级…">
<table><thead><tr><th>健康</th><th>repo</th><th>★</th><th>npm</th><th>中文/双语</th><th>lib 双产物</th><th>近30天活跃</th><th>描述</th><th>创建</th></tr></thead><tbody id="tb"></tbody></table>
<script>
const ROWS=${dataJson};
const GC=${JSON.stringify(gradeColor)};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function chip(r){return r.grade?('<span class="chip" style="background:'+GC[r.grade]+'" title="'+r.score+'/100">'+r.grade+'</span>'+r.score):'<span style="color:var(--mut)">—</span>'}
function fmt(r){return '<tr><td>'+chip(r)+'</td><td><a href="'+esc(r.url)+'" target="_blank">'+esc(r.repo)+'</a></td><td>'+r.stars+'</td><td>'+esc(r.npm)+'</td><td>'+r.zh+'</td><td>'+r.lib+'</td><td>'+r.active+'</td><td class="d">'+esc(r.desc)+'</td><td>'+r.created+'</td></tr>'}
function draw(q=''){const t=q.toLowerCase();const rows=ROWS.filter(r=>!t||(r.repo+' '+r.desc+' '+(r.grade||'')).toLowerCase().includes(t));document.getElementById('tb').innerHTML=rows.slice(0,500).map(fmt).join('')||'<tr><td colspan=9 style="color:var(--mut)">无匹配</td></tr>';}
document.getElementById('q').addEventListener('input',e=>draw(e.target.value));draw();
</script>
<footer>数据开放：<a href="https://github.com/ice5kysl/dsh-plugin-insights/blob/main/data/plugins.jsonl">plugins.jsonl</a> · <a href="https://github.com/ice5kysl/dsh-plugin-insights/blob/main/data/insights.json">insights.json</a>（agent 可读）· 健康分规则见 docs/schema.md §health · 完整校验仍在跑批（持续追加中）</footer>
</body></html>`
  writeFileSync(join(ROOT, 'site', 'index.html'), html)
  console.log(`[site] ${plugins.length} rows (A${g.A}/B${g.B}/C${g.C}/D${g.D}, avg ${summary.avg}) → site/index.html`)
}

main()
