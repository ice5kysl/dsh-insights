#!/usr/bin/env node
/**
 * pipeline/collect · downloads — fetch last-week npm downloads（node fetch 真并发；
 * 不经 lib/api.mjs 的 raw()，避免把 GitHub token 发往 npmjs.org）。
 *
 * 失败纪律（P1-4）：
 *   - 失败计数 + 明细日志（前 10 个失败包名）
 *   - 成功率 < 50% 时：有旧数据兜底则降级为告警（不阻塞管线与 pages 接力部署）；
 *     无旧数据可兜底才 exit 1（npm 对共享 CI 出口 IP 大面积断供时有发生，旧值可用时不应掀桌）
 *   - 与旧 downloads.json merge（新值覆盖同名键，失败的包保留旧值），绝不整覆写丢历史
 *
 * Output: data/downloads.json { fetchedAt, map }（map 值为 npm last-week 点数）
 *
 * @module dsh-insights/stage-7
 */

import { PATHS, readJson, writeJson, loadPlugins } from '../../lib/data.mjs'

const CONC = Number(process.env.CONC || 8)
const OK_FLOOR = Number(process.env.OK_FLOOR || 0.5)
const BULK = Number(process.env.BULK || 64)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// npm 限流（429）是常态：共享 CI 出口 IP 被所有人一起计 quota。遇 429/5xx 按
// Retry-After 或指数退避重试；其他 4xx（404 查无此包等）直接抛，不重试。
async function getJson(url, timeoutMs) {
  let err
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'dsh-insights' }, signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'))
        await sleep((Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) : [2, 5, 15, 30][attempt]) * 1000)
        err = new Error(`HTTP ${res.status}`)
        continue
      }
      throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      if (/^HTTP (?!429|5)\d{2}/.test(String(e?.message))) throw e // 非重试类 4xx
      err = e
      if (attempt < 3) await sleep([2, 5, 15][attempt] * 1000)
    }
  }
  throw err
}

async function fetchPoint(name) {
  const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name).replace(/%40/g, '@')}`
  const j = await getJson(url, 20000)
  if (typeof j.downloads !== 'number') throw new Error(j.error || 'bad payload')
  return { d: j.downloads, start: j.start, end: j.end }
}

// 批量端点：一次请求取 BULK 个非 scoped 包（npm 不支持 scoped 批量）——把数千次
// 单包请求压到几十次，绕开共享 CI 出口 IP 被 npm 限流大面积断供的老问题。
// 响应为 {pkg: {downloads,start,end}|null}；null = npm 查无此包，按失败计（保留旧值）。
async function fetchBulk(batch) {
  const url = `https://api.npmjs.org/downloads/point/last-week/${batch.map((n) => encodeURIComponent(n)).join(',')}`
  const j = await getJson(url, 30000)
  const out = new Map()
  for (const name of batch) {
    const v = j?.[name]
    if (v && typeof v.downloads === 'number') out.set(name, { d: v.downloads, start: v.start, end: v.end })
  }
  return out
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
  const scoped = names.filter((n) => n.startsWith('@'))
  const batches = []
  const plain = names.filter((n) => !n.startsWith('@'))
  for (let i = 0; i < plain.length; i += BULK) batches.push(plain.slice(i, i + BULK))
  console.log(`[downloads] 批量 ${batches.length} 组（${plain.length} 个）+ 单发 scoped ${scoped.length} 个`)
  let idx = 0
  const bump = () => { idx++; if (idx % 500 === 0) console.log(`[downloads] ${idx}/${names.length} (ok ${ok}, failed ${failed.length})`) }
  // scoped 单发（npm 批量端点不支持）；批量组失败时整组降级单发
  async function fetchOne(name) {
    try {
      map[name] = await fetchPoint(name)
      ok++
    } catch (e) {
      failed.push(`${name} (${String(e?.message || e).slice(0, 60)})`)
    }
    bump()
  }
  const queue = scoped.slice()
  async function worker() {
    while (queue.length) {
      const name = queue.shift()
      if (!name) return
      await fetchOne(name)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, scoped.length || 1) }, worker))
  const BULK_CONC = 2 // 批量组低速率推进，给 npm 限流留余地（重试兜底）
  for (let i = 0; i < batches.length; i += BULK_CONC) {
    await Promise.all(
      batches.slice(i, i + BULK_CONC).map(async (batch) => {
        let got
        try {
          got = await fetchBulk(batch)
        } catch {
          got = null // 整组请求失败 → 降级单发
        }
        if (got) {
          for (const name of batch) {
            if (got.has(name)) { map[name] = got.get(name); ok++ }
            else failed.push(`${name} (not-in-bulk-response)`)
            bump()
          }
        } else {
          await Promise.all(batch.map(fetchOne))
        }
      }),
    )
  }
  const okRate = names.length ? ok / names.length : 1
  if (failed.length) {
    console.error(`[downloads] failed ${failed.length}/${names.length}: ${failed.slice(0, 10).join('; ')}${failed.length > 10 ? ` …(+${failed.length - 10})` : ''}`)
    console.error(`[downloads] 失败/未采的包保留旧值（旧 map ${Object.keys(oldMap).length} 条，merge 后 ${Object.keys(map).length} 条）`)
  }
  writeJson(PATHS.downloads, { fetchedAt: new Date().toISOString(), map })
  const sum = Object.values(map).reduce((s, v) => s + v.d, 0)
  console.log(`[downloads] ok ${ok}/${names.length} (${Math.round(okRate * 1000) / 10}%) · 周下载合计 ${sum} → data/downloads.json`)
  if (names.length && okRate < OK_FLOOR) {
    const hasFallback = Object.keys(oldMap).length > 0
    console.error(`[downloads] 成功率 ${Math.round(okRate * 1000) / 10}% < ${OK_FLOOR * 100}% —— ${hasFallback ? '有旧数据兜底，降级为告警（不阻塞管线）' : '无旧数据兜底，判定采集失败'}`)
    if (!hasFallback) process.exit(1)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
