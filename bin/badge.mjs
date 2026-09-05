#!/usr/bin/env node
/**
 * dsh-plugin-insights · health badge renderer (M2 author hook).
 *
 * Emits an SVG "health" badge for one plugin, resolved from the latest
 * scored snapshot (data/insights.json), so authors can paste it into their
 * README. Once the dataset is hosted, the badge URL form becomes:
 *   https://<host>/badge/<owner>/<repo>.svg
 *
 * Usage:
 *   node bin/badge.mjs omdsh-dev/DSH-better-sidebar          # SVG → stdout
 *   node bin/badge.mjs ice5kysl/dsh-workspace-kit -o health.svg
 *
 * @module dsh-plugin-insights/badge
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const INSIGHTS = join(import.meta.dirname, '..', 'data', 'insights.json')

const COLOR = { A: '#15803d', B: '#2d66f7', C: '#b45309', D: '#b91c1c' }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function main() {
  const args = process.argv.slice(2)
  const target = args.find((a) => a.includes('/'))
  const outIdx = args.indexOf('-o')
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null
  if (!target) { console.error('usage: node bin/badge.mjs owner/repo [-o file.svg]'); process.exit(1) }

  let doc
  try { doc = JSON.parse(readFileSync(INSIGHTS, 'utf8')) } catch { console.error('no data/insights.json yet — run npm run export:json first'); process.exit(1) }
  const p = (doc.plugins || []).find((x) => x.full_name === target)
  if (!p) { console.error(`plugin ${target} not in insights.json (not validated or rejected)`); process.exit(2) }
  const h = p.health || {}
  const color = COLOR[h.grade] || '#6b7280'
  const label = 'dsh health'
  const value = h.grade && h.score != null ? `${h.grade} · ${h.score}/100` : 'n/a'
  const lw = label.length * 6.5 + 12
  const vw = value.length * 6.5 + 12
  const w = lw + vw
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="dsh plugin health">
  <title>dsh plugin health: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect width="${w}" height="20" rx="3" fill="#555"/>
  <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
  <rect width="${w}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${esc(label)}</text>
    <text x="${lw + vw / 2}" y="14">${esc(value)}</text>
  </g>
</svg>`
  if (outFile) {
    writeFileSync(outFile, svg)
    console.log(`wrote ${outFile} (${target} ${value})`)
  } else {
    console.log(svg)
  }
}

main()
