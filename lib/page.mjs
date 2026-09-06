/**
 * Shared page chrome + zero-dependency Markdown renderer for the static
 * multi-page site (stage 20). Visual language mirrors the redesigned
 * dashboard (pipeline/publish/site.mjs): Zinc grayscale, single accent, mono digits.
 *
 * @module dsh-insights/lib/page
 */

export const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
:root{
  --bg:#fafafa;--card:#ffffff;--ink:#18181b;--mut:#71717a;--faint:#a1a1aa;--line:#e4e4e7;--track:#f4f4f5;
  --accent:#2563eb;--ok:#059669;--warn:#d97706;--err:#dc2626;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace
}
@media(prefers-color-scheme:dark){
  :root{--bg:#09090b;--card:#101012;--ink:#f4f4f5;--mut:#a1a1aa;--faint:#71717a;--line:#26262a;--track:#17171a;--accent:#60a5fa}
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1400px;margin:0 auto;padding:0 28px}
.topbar{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;height:56px;gap:16px}
[id]{scroll-margin-top:70px}
.brand{display:flex;align-items:center;gap:10px;font-weight:650;font-size:14px;color:var(--ink);white-space:nowrap}
.brand:hover{text-decoration:none}
.mark{width:22px;height:22px;border-radius:6px;background:var(--ink);color:var(--bg);display:grid;place-items:center;font:700 12px/1 var(--mono)}
.brand small{color:var(--faint);font-weight:400;font-size:12px}
.nav{display:flex;align-items:center;gap:2px}
.nav a{color:var(--mut);font-size:13px;padding:5px 10px;border-radius:7px}
.nav a:hover{color:var(--ink);background:var(--track);text-decoration:none}
.nav a.here{color:var(--ink);font-weight:650}
@media(max-width:720px){.brand small{display:none}.nav a{padding:5px 7px;font-size:12.5px}}
main.wrap{padding:48px 28px 8px}
.content{max-width:1200px;margin:0 auto}
.article{max-width:78ch}
.crumb{font:600 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:0 0 12px}
h1.pagetitle{margin:0 0 8px;font-size:clamp(22px,3.4vw,30px);font-weight:700;letter-spacing:-.02em;line-height:1.25}
.lede{color:var(--mut);font-size:14px;margin:0 0 28px;max-width:68ch}
.article h1{font-size:22px;margin:34px 0 10px;letter-spacing:-.02em}
.article h2{font-size:18px;margin:30px 0 8px;letter-spacing:-.01em}
.article h3{font-size:15px;margin:24px 0 6px}
.article h4{font-size:13.5px;margin:20px 0 6px}
.article p{margin:10px 0}
.article ul,.article ol{margin:10px 0;padding-left:22px}
.article li{margin:4px 0}
.article blockquote{margin:14px 0;padding:10px 14px;border-left:3px solid var(--line);color:var(--mut);background:var(--track);border-radius:0 8px 8px 0;font-size:13px}
.article code{font:12.5px var(--mono);background:var(--track);border-radius:5px;padding:1px 5px}
.article pre{background:var(--track);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow:auto;font-size:12.5px}
.article pre code{background:none;padding:0}
.article table{width:100%;border-collapse:collapse;font-size:12.5px;margin:14px 0}
.article th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em;text-align:left}
.article th,.article td{padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
.article hr{border:none;border-top:1px solid var(--line);margin:26px 0}
.article strong{font-weight:650}
.grade{display:inline-block;min-width:22px;text-align:center;font:700 11px/1.5 var(--mono);border-radius:5px;padding:1px 6px;border:1px solid}
.grade.A{color:var(--ok);background:color-mix(in srgb,var(--ok) 9%,transparent);border-color:color-mix(in srgb,var(--ok) 32%,transparent)}
.grade.B{color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,transparent);border-color:color-mix(in srgb,var(--accent) 32%,transparent)}
.grade.C{color:var(--warn);background:color-mix(in srgb,var(--warn) 10%,transparent);border-color:color-mix(in srgb,var(--warn) 35%,transparent)}
.grade.D{color:var(--err);background:color-mix(in srgb,var(--err) 9%,transparent);border-color:color-mix(in srgb,var(--err) 32%,transparent)}
.listrow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px 2px;border-bottom:1px solid var(--line)}
.listrow a{font-weight:600;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
.listrow a:hover{color:var(--accent)}
.listrow .meta{color:var(--faint);font:12px var(--mono);white-space:nowrap;flex:none}
.scrow{display:flex;flex-direction:column;gap:1px;padding:9px 2px;border-bottom:1px solid var(--line)}
.scrow a{font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scrow a:hover{color:var(--accent)}
.scrow .meta{color:var(--faint);font:11.5px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:16px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card b{display:block;font-size:13px;margin-bottom:4px}
.card code{font:12px var(--mono);color:var(--accent);word-break:break-all}
.card p{margin:6px 0 0;font-size:12px;color:var(--mut)}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:11.5px;color:var(--mut);margin:0 6px 6px 0}
footer{margin:40px 0 48px;padding-top:18px;border-top:1px solid var(--line);color:var(--faint);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
`

const NAV = [
  ['', '仪表盘'],
  ['dynamics/', '动态'],
  ['scenarios/', '场景'],
  ['authors/', '作者'],
  ['weekly/', '周报'],
  ['data/', '开放数据'],
  ['badge/', '徽章'],
  ['about/', '关于'],
]

/**
 * Render a full HTML page with shared chrome.
 * base = relative prefix back to site root ('./', '../', '../../../').
 * here = nav key to highlight ('', 'weekly/', 'data/', 'about/').
 */
export function page({ title, desc = '', base = './', here = null, body = '', og = {} }) {
  const nav = NAV.map(([href, label]) =>
    `<a href="${base}${href}"${here === href ? ' class="here"' : ''}>${label}</a>`).join('')
  const ogTags = [
    `<meta property="og:title" content="${escHtml(og.title || title)}">`,
    `<meta property="og:description" content="${escHtml(og.desc || desc)}">`,
    `<meta property="og:type" content="${og.type || 'website'}">`,
  ].join('\n')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} · DSH Insights</title>
<meta name="description" content="${escHtml(desc)}">
${ogTags}
<style>${CSS}</style>
</head>
<body>
<div class="topbar"><div class="wrap">
  <a class="brand" href="${base}"><span class="mark">d</span>DSH Insights<small>DeepSeek Harness 全景观察站</small></a>
  <nav class="nav">${nav}<a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub ↗</a></nav>
</div></div>
<main class="wrap">
<div class="content">
${body}
</div>
<footer>
  <span>由 <a href="https://github.com/ice5kysl/dsh-insights" target="_blank">DSH Insights</a> 管线自动生成</span>
  <span>零依赖 · 启发式评估，非安全审计 · 数据 CC BY 4.0 / 代码 MIT</span>
</footer>
</main>
</body>
</html>`
}

// ---- zero-dependency Markdown → HTML (headings, lists, tables, code, quotes, hr) ----

function inline(s) {
  return escHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function mdTable(rows) {
  const parse = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const head = parse(rows[0])
  let bodyRows = rows.slice(1)
  if (bodyRows.length && /^[\s|:-]+$/.test(bodyRows[0])) bodyRows = bodyRows.slice(1)
  return '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
    bodyRows.map((r) => '<tr>' + parse(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>'
}

export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let i = 0
  const isBlockStart = (l) => /^(#{1,4}\s|>\s?|```|\||[-*]\s|\d+\.\s|\s*(-{3,}|\*{3,})\s*$)/.test(l)
  while (i < lines.length) {
    const l = lines[i]
    if (/^```/.test(l)) {
      const buf = []; i++
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++
      html += '<pre><code>' + escHtml(buf.join('\n')) + '</code></pre>'
      continue
    }
    if (/^#{1,4}\s/.test(l)) {
      const m = l.match(/^(#{1,4})\s+(.*)$/)
      html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue
    }
    if (/^>\s?/.test(l)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''))
      html += '<blockquote>' + buf.map(inline).join('<br>') + '</blockquote>'; continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { html += '<hr>'; i++; continue }
    if (/^\|/.test(l)) {
      const buf = []
      while (i < lines.length && /^\|/.test(lines[i])) buf.push(lines[i++])
      html += mdTable(buf); continue
    }
    if (/^\d+\.\s/.test(l)) {
      const buf = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) buf.push(lines[i++].replace(/^\d+\.\s+/, ''))
      html += '<ol>' + buf.map((x) => `<li>${inline(x)}</li>`).join('') + '</ol>'; continue
    }
    if (/^[-*]\s/.test(l)) {
      const buf = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) buf.push(lines[i++].replace(/^[-*]\s+/, ''))
      html += '<ul>' + buf.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>'; continue
    }
    if (l.trim() === '') { i++; continue }
    const buf = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) buf.push(lines[i++])
    html += '<p>' + buf.map(inline).join(' ') + '</p>'
  }
  return html
}

/** Extract the first `# heading` text from Markdown (for page titles). */
export function mdTitle(md, fallback = '') {
  const m = String(md).match(/^#\s+(.+)$/m)
  return m ? m[1].replace(/[*`]/g, '').trim() : fallback
}
