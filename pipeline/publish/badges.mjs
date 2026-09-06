#!/usr/bin/env node
/**
 * pipeline/publish · badges — generate all health badges → site/badge/<owner>/<repo>.svg
 *
 * Turns every plugin in data/insights.json into a static SVG badge so the
 * GitHub Pages site can serve hotlinkable URLs:
 *   https://dsh-insights.com/badge/<owner>/<repo>.svg
 *
 * Usage: npm run badges   (after export:json / score)
 *
 * @module dsh-insights/stage-12
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { escHtml } from '../../lib/page.mjs'
import { PATHS, SITE } from '../../lib/data.mjs'

const SRC = PATHS.insights
const OUT_DIR = join(SITE, 'badge')

const COLOR = { A: '#15803d', B: '#2d66f7', C: '#b45309', D: '#b91c1c' }
const esc = escHtml

function svg(label, value, color) {
  const lw = label.length * 6.5 + 12
  const vw = value.length * 6.5 + 12
  const w = lw + vw
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="plugin health">
  <title>plugin health: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect width="${w}" height="20" rx="3" fill="#555"/>
  <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
  <rect width="${w}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${esc(label)}</text>
    <text x="${lw + vw / 2}" y="14">${esc(value)}</text>
  </g>
</svg>`
}

function main() {
  const doc = JSON.parse(readFileSync(SRC, 'utf8'))
  const plugins = doc.plugins || []
  mkdirSync(OUT_DIR, { recursive: true })
  let n = 0
  for (const p of plugins) {
    if (!p.full_name || !p.full_name.includes('/')) continue
    const h = p.health || {}
    if (!h.grade || h.score == null) continue
    const [owner, repo] = p.full_name.split('/')
    const color = COLOR[h.grade] || '#6b7280'
    const sub = join(OUT_DIR, owner)
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(sub, `${repo}.svg`), svg('dsh health', `${h.grade} · ${h.score}/100`, color))
    n++
  }
  console.log(`[badges] ${n} svg badges → site/badge/ (rule ${doc.ruleVersion})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
