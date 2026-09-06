#!/usr/bin/env node
/**
 * pipeline/collect · downloads — fetch last-week npm downloads（node fetch 真并发；
 * 不经 lib/api.mjs 的 raw()，避免把 GitHub token 发往 npmjs.org）。
 *
 * 失败纪律（P1-4）：
 *   - 失败计数 + 明细日志（前 10 个失败包名）
 *   - 成功率 < 50% 时 exit 1
 *   - 与旧 downloads.json merge（新值覆盖同名键，失败的包保留旧值），绝不整覆写丢历史
 *
 * Output: data/downloads.json { fetchedAt, map }（map 值为 npm last-week 点数）
 *
 * @module dsh-insights/stage-7
 */

import { PATHS, readJson, writeJson, loadPlugins } from '../../lib/data.mjs'

const CONC = Number(process.env.CONC || 8)
const OK_FLOOR = Number(process.env.OK_FLOOR || 0.5)

async function fetchPoint(name) {
  const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name).replace(/%40/g, '@')}`
  const res = await fetch(url, { headers: { 'user-agent': 'dsh-insights' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (typeof j.downloads !== 'number') throw new Error(j.error || 'bad payload')
  return { d: j.downloads, start: j.start, end: j.end }
}

async function main() {
  const plugins = loadPlugins()
  const names = [...new Set(plugins.filter((p) => p.npm?.published && p.pkgName).map((p) => p.pkgName))]
  console.log(`[downloads] ${names.length} packages`)
  const old = readJson(PATHS.downloads, null)
  const oldMap = old?.map || {}
  const map = { ...oldMap }
  let ok = 0
  const failed = []
  let idx = 0
  const queue = names.slice()
  async function worker() {
    while (queue.length) {
      const name = queue.shift()
      if (!name) return
      try {
        map[name] = await fetchPoint(name)
        ok++
      } catch (e) {
        failed.push(`${name} (${String(e?.message || e).slice(0, 60)})`)
      }
      idx++
      if (idx % 100 === 0) console.log(`[downloads] ${idx}/${names.length} (ok ${ok}, failed ${failed.length})`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, names.length || 1) }, worker))
  const okRate = names.length ? ok / names.length : 1
  if (failed.length) {
    console.error(`[downloads] failed ${failed.length}/${names.length}: ${failed.slice(0, 10).join('; ')}${failed.length > 10 ? ` …(+${failed.length - 10})` : ''}`)
    console.error(`[downloads] 失败/未采的包保留旧值（旧 map ${Object.keys(oldMap).length} 条，merge 后 ${Object.keys(map).length} 条）`)
  }
  writeJson(PATHS.downloads, { fetchedAt: new Date().toISOString(), map })
  const sum = Object.values(map).reduce((s, v) => s + v.d, 0)
  console.log(`[downloads] ok ${ok}/${names.length} (${Math.round(okRate * 1000) / 10}%) · 周下载合计 ${sum} → data/downloads.json`)
  if (names.length && okRate < OK_FLOOR) {
    console.error(`[downloads] 成功率 ${Math.round(okRate * 1000) / 10}% < ${OK_FLOOR * 100}% —— 判定采集失败（已 merge 旧值，未丢历史）`)
    process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
