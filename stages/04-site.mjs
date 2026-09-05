#!/usr/bin/env node
/**
 * Stage 4 — generate a self-contained static analysis site (no build deps).
 *
 * Output: site/index.html with the analysis summary + a searchable table of
 * the authoritative set (embeds a trimmed dataset inline, links full JSONL).
 *
 * @module dsh-plugin-insights/stage-4
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

function main() {
  const plugins = readFileSync(join(ROOT, 'data', 'plugins.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  let analysis = {}
  try { analysis = JSON.parse(readFileSync(join(ROOT, 'data', 'analysis.json'), 'utf8')) } catch { /* ok */ }

  const rows = plugins.map((r) => ({
    repo: r.full_name,
    url: r.html_url,
    stars: r.stars || 0,
    desc: (r.description || '').slice(0, 120),
    npm: r.npm?.published ? `✅ ${r.npm.latest}` : '—',
    zh: (r.files?.readmeZh || r.metrics?.hasZhDocs) ? '✅' : '—',
    lib: (r.files?.libIndex && r.files?.libClient) ? '✅' : '~',
    active: r.metrics?.active30 ? '✅' : '—',
    created: (r.created_at || '').slice(0, 10),
  }))
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
table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td.d{white-space:normal;max-width:340px;color:var(--mut);overflow:hidden;text-overflow:ellipsis}
input{padding:8px 10px;border:1px solid var(--line);border-radius:8px;width:280px;margin:8px 0}
a{color:var(--brand);text-decoration:none}
</style></head><body>
<h1>dsh 插件生态洞察 <small style="color:var(--mut)">· dsh-plugin-insights</small></h1>
<p style="color:var(--mut)">权威集（通过 dsh.bundle manifest 校验）快照 · 生成 ${(analysis.generatedAt || '').slice(0, 10)} · <a href="https://github.com/ice5kysl/dsh-plugin-insights">仓库</a></p>
<div class="stats">
<div class="card"><b>${totals.authoritative ?? 0}</b><span>权威插件数</span></div>
<div class="card"><b>${dist.publish?.published ?? 0}</b><span>npm 已发布</span></div>
<div class="card"><b>${dist.docs?.both ?? 0}</b><span>中英/双语文档</span></div>
<div class="card"><b>${dist.lib?.both ?? 0}</b><span>host+client 双产物</span></div>
<div class="card"><b>${totals.active30Pct ?? 0}%</b><span>近30天活跃</span></div>
</div>
${monthsHtml}
<h2>插件列表（可搜索）</h2>
<input id="q" placeholder="过滤：名称 / 描述 / 是否发布…">
<table><thead><tr><th>repo</th><th>★</th><th>npm</th><th>中文/双语</th><th>lib 双产物</th><th>近30天活跃</th><th>描述</th><th>创建</th></tr></thead><tbody id="tb"></tbody></table>
<script>
const ROWS=${dataJson};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function fmt(r){return '<tr><td><a href="'+esc(r.url)+'" target="_blank">'+esc(r.repo)+'</a></td><td>'+r.stars+'</td><td>'+esc(r.npm)+'</td><td>'+r.zh+'</td><td>'+r.lib+'</td><td>'+r.active+'</td><td class="d">'+esc(r.desc)+'</td><td>'+r.created+'</td></tr>'}
function draw(q=''){const t=q.toLowerCase();const rows=ROWS.filter(r=>!t||(r.repo+' '+r.desc+' '+r.npm).toLowerCase().includes(t));document.getElementById('tb').innerHTML=rows.slice(0,500).map(fmt).join('')||'<tr><td colspan=8 style="color:var(--mut)">无匹配</td></tr>';}
document.getElementById('q').addEventListener('input',e=>draw(e.target.value));draw();
</script>
</body></html>`
  writeFileSync(join(ROOT, 'site', 'index.html'), html)
  console.log(`[site] ${plugins.length} rows → site/index.html`)
}

main()
