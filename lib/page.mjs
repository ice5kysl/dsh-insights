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
:root[data-theme=dark]{--bg:#09090b;--card:#101012;--ink:#f4f4f5;--mut:#a1a1aa;--faint:#71717a;--line:#26262a;--track:#17171a;--accent:#60a5fa}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#09090b;--card:#101012;--ink:#f4f4f5;--mut:#a1a1aa;--faint:#71717a;--line:#26262a;--track:#17171a;--accent:#60a5fa}}
.theme{border:1px solid var(--line);background:var(--card);color:var(--mut);border-radius:7px;padding:4px 7px;height:26px;cursor:pointer;display:inline-flex;align-items:center}
.theme:hover{color:var(--ink)}
.theme .t-sun{display:none}
:root[data-theme=dark] .theme .t-sun{display:inline-flex}
:root[data-theme=dark] .theme .t-moon{display:none}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1400px;margin:0 auto;padding:0 28px}
.topbar{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;height:56px;gap:16px}
[id]{scroll-margin-top:70px}
.brand{display:flex;align-items:center;gap:10px;font-weight:650;font-size:14px;color:var(--ink);white-space:nowrap}
.brand:hover{text-decoration:none}
.mark{width:22px;height:22px;display:inline-flex;flex:none}
.brand small{color:var(--faint);font-weight:400;font-size:12px}
.nav{display:flex;align-items:center;gap:2px}
.nav a{color:var(--mut);font-size:13px;padding:5px 10px;border-radius:7px}
.nav a:hover{color:var(--ink);background:var(--track);text-decoration:none}
.nav a.here{color:var(--ink);font-weight:650}
@media(max-width:720px){.brand small{display:none}.topbar .wrap{flex-wrap:wrap;height:auto;padding:6px 28px;row-gap:2px}.nav{overflow-x:auto;width:100%;padding-bottom:4px;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}.nav a{padding:5px 7px;font-size:12.5px;white-space:nowrap;flex:none}}
main.wrap{padding:48px 28px 8px}
.article{max-width:1100px}
.crumb{font:600 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:0 0 12px}
h1.pagetitle{margin:0 0 8px;font-size:clamp(22px,3.4vw,30px);font-weight:700;letter-spacing:-.02em;line-height:1.25}
.lede{color:var(--mut);font-size:14px;margin:0 0 28px;max-width:1100px}
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
.grade.S{color:#7c3aed;background:color-mix(in srgb,#7c3aed 9%,transparent);border-color:color-mix(in srgb,#7c3aed 32%,transparent)}
.grade.A{color:var(--ok);background:color-mix(in srgb,var(--ok) 9%,transparent);border-color:color-mix(in srgb,var(--ok) 32%,transparent)}
.grade.B{color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,transparent);border-color:color-mix(in srgb,var(--accent) 32%,transparent)}
.grade.C{color:var(--warn);background:color-mix(in srgb,var(--warn) 10%,transparent);border-color:color-mix(in srgb,var(--warn) 35%,transparent)}
.grade.D{color:var(--err);background:color-mix(in srgb,var(--err) 9%,transparent);border-color:color-mix(in srgb,var(--err) 32%,transparent)}
.listrow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px 2px;border-bottom:1px solid var(--line)}
.listrow a{font-weight:600;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
.listrow a:hover{color:var(--accent)}
.listrow .meta{color:var(--faint);font:12px var(--mono);white-space:nowrap;flex:none}
.scrow{display:flex;flex-direction:column;gap:1px;padding:9px 2px;border-bottom:1px solid var(--line)}
.scsec{padding:22px 0 6px;border-top:1px solid var(--line)}
.sc-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:860px){.sc-cols{grid-template-columns:1fr}}
.scrow a{font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scrow a:hover{color:var(--accent)}
.scrow .meta{color:var(--faint);font:11.5px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:16px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card b{display:block;font-size:13px;margin-bottom:4px}
.card code{font:12px var(--mono);color:var(--accent);word-break:break-all}
.card p{margin:6px 0 0;font-size:12px;color:var(--mut)}
.wkbtn{display:inline-block;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 12px;font-size:12px;cursor:pointer;color:var(--mut)}
.wkbtn:hover{border-color:var(--faint);color:var(--ink);text-decoration:none}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:11.5px;color:var(--mut);margin:0 6px 6px 0}
footer{margin:40px 0 48px;padding-top:18px;border-top:1px solid var(--line);color:var(--faint);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
`

const NAV = [
  ['', '首页'],
  ['dashboard/', '插件'],
  ['scenarios/', '场景'],
  ['weekly/', '周报'],
  ['dynamics/', '动态'],
  ['authors/', '作者'],
  ['badge/', '徽章'],
  ['data/', '开放数据'],
  ['about/', '关于'],
]

// ---- inline SVG icon set（stroke 风格，与 zinc 极简一致；零依赖，不引外部图标库） ----
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18.4 5.6"/>',
  chart: '<path d="M4 19V9M10 19V5M16 19v-8"/><path d="M3 21h18"/>',
  star: '<path d="m12 3 2.8 5.9 6.2.8-4.6 4.3 1.2 6.1L12 17l-5.6 3.1 1.2-6.1L3 9.7l6.2-.8z"/>',
  check: '<path d="m4.5 12.5 5 5L19.5 7"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9.5v4"/><path d="M12 17.2h.01"/>',
  github: '<path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  plugin: '<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.3 3.3-5 6.5-5s5.9 1.7 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5c2.5 0 4.3 1.4 4.8 3.5"/>',
  book: '<path d="M12 6c-1.5-1.3-3.8-2-8-2v14c4.2 0 6.5.7 8 2 1.5-1.3 3.8-2 8-2V4c-4.2 0-6.5.7-8 2z"/><path d="M12 6v14"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  tag: '<path d="M3 11V4a1 1 0 0 1 1-1h7l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  pulse: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
}

/**
 * Inline stroke SVG icon（currentColor 描边，继承文字颜色）。
 * @param {string} name — one of: search mail radar chart star check alert github arrow plugin users book database tag pulse
 * @param {number} [size=14] — square width/height in px
 */
export function icon(name, size = 14) {
  const body = ICONS[name]
  if (!body) return ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px">${body}</svg>`
}

/**
 * 显示侧净化用户仓库描述里的 emoji（仅渲染时，不改数据）。保留 ★ ✓ → 等普通符号；
 * VS16（U+FE0F）/ keycap（U+20E3）单独出现时无渲染意义，一律移除。
 */
export const stripEmoji = (s) => String(s ?? '')
  .replace(/[0-9#*]\u{FE0F}?\u{20E3}/gu, '')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2705}\u{26A0}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim()

/**
 * Render a full HTML page with shared chrome.
 * base = relative prefix back to site root ('./', '../', '../../../').
 * here = nav key to highlight ('', 'weekly/', 'data/', 'about/').
 */
export function page({ title, desc = '', base = './', here = null, body = '', og = {} }) {
  const nav = NAV.map(([href, label]) =>
    `<a href="${base}${href}"${here === href ? ' class="here"' : ''}>${label}</a>`).join('')
  const ogTags = [
    og.url ? `<link rel="canonical" href="${escHtml(og.url)}">\n<meta property="og:url" content="${escHtml(og.url)}">` : '',
    `<meta property="og:title" content="${escHtml(og.title || title)}">`,
    `<meta property="og:description" content="${escHtml(og.desc || desc)}">`,
    `<meta property="og:type" content="${og.type || 'website'}">`,
    `<meta property="og:image" content="${escHtml(og.image || 'https://dsh-insights.com/og.png')}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escHtml(og.title || title)}">`,
    `<meta name="twitter:description" content="${escHtml(og.desc || desc)}">`,
  ].join('\n')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} · DSH Insights</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="icon" href="${base}favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="${base}logo.svg">
<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">
<script defer src="https://cloud.umami.is/script.js" data-website-id="7fc5eb24-1687-4827-9775-5326d957b46a"></script>
${ogTags}
<script>(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light')t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}})()</script>
<style>${CSS}</style>
</head>
<body>
<div class="topbar"><div class="wrap">
  <a class="brand" href="${base}"><span class="mark"><svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="var(--ink)"/><path d="M25 16H16v32h9" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M39 16h9v32h-9" fill="none" stroke="var(--bg)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="38.75" y="18" width="3.5" height="26" rx="1.75" fill="#4D6BFE"/><circle cx="30.5" cy="35" r="6.5" fill="none" stroke="#4D6BFE" stroke-width="3.5"/></svg></span>DSH Insights<small>DeepSeek Harness 全景观察站</small></a>
  <nav class="nav">${nav}<button class="theme" id="themeBtn" aria-label="切换深浅色" title="深 / 浅色切换"><span class="t-moon">${icon('moon', 13)}</span><span class="t-sun">${icon('sun', 13)}</span></button><a href="https://github.com/ice5kysl/dsh-insights" target="_blank">GitHub ↗</a></nav>
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
<script>(function(){var b=document.getElementById('themeBtn');if(!b)return;b.addEventListener('click',function(){var r=document.documentElement;var d=r.dataset.theme==='dark'?'light':'dark';r.dataset.theme=d;try{localStorage.setItem('theme',d)}catch(e){}})})()</script>
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
