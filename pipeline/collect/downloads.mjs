#!/usr/bin/env node
/**
 * pipeline/collect · downloads — fetch last-week npm downloads (via curl; node fetch to
 * api.npmjs.org is blocked in some sandboxes).
 * Output: data/downloads.json { fetchedAt, map }
 *
 * @module dsh-insights/stage-7
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const CONC = Number(process.env.CONC || 12)

function curl(name) {
  const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name).replace(/%40/g, '@')}`
  try {
    const out = execFileSync('curl', ['-sS', '--max-time', '20', url], { encoding: 'utf8', timeout: 25000 })
    const j = JSON.parse(out)
    return { d: j.downloads || 0, start: j.start, end: j.end }
  } catch { return null }
}

async function main() {
  const plugins = readFileSync(join(ROOT, 'data', 'plugins.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const names = [...new Set(plugins.filter((p) => p.npm?.published && p.pkgName).map((p) => p.pkgName))]
  console.log(`[downloads] ${names.length} packages`)
  const map = {}
  let ok = 0
  let idx = 0
  const queue = names.slice()
  async function worker() {
    while (queue.length) {
      const name = queue.shift()
      if (!name) return
      const r = curl(name)
      idx++
      if (r) { map[name] = r; ok++ }
      if (idx % 100 === 0) console.log(`[downloads] ${idx}/${names.length} (ok ${ok})`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, names.length || 1) }, worker))
  writeFileSync(join(ROOT, 'data', 'downloads.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), map }))
  const sum = Object.values(map).reduce((s, v) => s + v.d, 0)
  console.log(`[downloads] ok ${ok}/${names.length} · 周下载合计 ${sum} → data/downloads.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
