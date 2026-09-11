#!/usr/bin/env node
/**
 * bin/backfill-plugin-events.mjs — ecosystem_events 插件级事件一次性回填（幂等可重跑）。
 *
 * 回填两类（持续增量由 pipeline/publish/db9-sync.mjs 的 plugins diff 负责）：
 *   plugin_created     ← plugins.jsonl（valid && kind='repo'，occurred_at = 仓库 created_at）
 *   npm_first_publish  ← npm registry time.created（对 npm.published && pkgName 的包逐个拉取，
 *                        并发 12，失败计数告警不中断 —— 失败纪律同 collect/downloads.mjs）
 *
 * upsert 语义与 db9-sync 的 ecosystem_events 完全一致：ON CONFLICT 只刷 payload，
 * occurred_at/first_seen 不动。npm 拉取用裸 fetch 而非 lib/api.mjs 的 raw() ——
 * 避免把 GitHub token 发往 npmjs.org（同 downloads.mjs 的理由）。
 *
 * 失败纪律：无 DB9_TOKEN 跳过 exit 0；任何错误只告警，exit 恒 0。
 *
 * @module dsh-insights/bin-backfill-plugin-events
 */

import { pathToFileURL } from 'node:url'
import { loadPlugins } from '../lib/data.mjs'
import { isEnabled, sql, lit, jsonLit, pluginCreatedEvent } from '../lib/db9.mjs'

const BATCH = 200
const CONC = 12

const UPSERT_EVENTS = `INSERT INTO ecosystem_events (type, key, occurred_at, payload, first_seen)
VALUES %s
ON CONFLICT (type, key) DO UPDATE SET payload = EXCLUDED.payload`

const eventRow = (e) => `(${[lit(e.type), lit(e.key), lit(e.occurred_at), jsonLit(e.payload), 'now()'].join(', ')})`

async function upsertBatches(token, rows) {
  let ok = 0
  let failed = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await sql(token, UPSERT_EVENTS.replace('%s', batch.join(',\n')))
      ok += batch.length
    } catch (e) {
      failed += batch.length
      console.error(`[backfill-plugin-events] 第 ${i / BATCH + 1} 批（${batch.length} 行）写入失败：${String(e?.message || e).slice(0, 200)}`)
    }
  }
  return { ok, failed }
}

/** npm registry 文档的 time.created（包首次发布时间）。 */
async function npmCreated(pkgName) {
  const url = `https://registry.npmjs.org/${String(pkgName).replace(/^@/, '%40')}`
  const res = await fetch(url, { headers: { 'user-agent': 'dsh-insights' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (!j?.time?.created) throw new Error('no time.created')
  return j.time.created
}

async function main() {
  if (!isEnabled()) {
    console.log('[backfill-plugin-events] 未配置 DB9_TOKEN，跳过（exit 0）')
    return
  }
  const token = process.env.DB9_TOKEN
  const now = new Date().toISOString()
  const plugins = loadPlugins().filter((p) => p.valid && p.kind === 'repo')

  // plugin_created：有 created_at 的全量生成（本地数据 10762 行全有）
  const events = plugins.filter((p) => p.created_at).map((p) => pluginCreatedEvent(p, now)).filter(Boolean)
  console.log(`[backfill-plugin-events] plugin_created 候选 ${events.length}`)

  // npm_first_publish：同 pkgName 多插件时取第一个（payload 只需一个 full_name 归属）
  const byPkg = new Map()
  for (const p of plugins) {
    if (p.npm?.published && p.pkgName && !byPkg.has(p.pkgName)) byPkg.set(p.pkgName, p)
  }
  console.log(`[backfill-plugin-events] npm_first_publish 候选 ${byPkg.size} 包（并发 ${CONC} 拉 registry）`)
  let npmOk = 0
  const npmFailed = []
  let idx = 0
  const queue = [...byPkg.entries()]
  async function worker() {
    while (queue.length) {
      const item = queue.shift()
      if (!item) return
      const [pkgName, p] = item
      try {
        const created = await npmCreated(pkgName)
        events.push({ type: 'npm_first_publish', key: pkgName, occurred_at: created, payload: { full_name: p.full_name, version: p.version ?? null } })
        npmOk++
      } catch (e) {
        npmFailed.push(`${pkgName} (${String(e?.message || e).slice(0, 40)})`)
      }
      idx++
      if (idx % 200 === 0) console.log(`[backfill-plugin-events] npm ${idx}/${byPkg.size}（ok ${npmOk}, failed ${npmFailed.length}）`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker))
  if (npmFailed.length) {
    console.error(`[backfill-plugin-events] npm 拉取失败 ${npmFailed.length}/${byPkg.size}: ${npmFailed.slice(0, 10).join('; ')}${npmFailed.length > 10 ? ` …(+${npmFailed.length - 10})` : ''}（降级为告警，已拉到的照写）`)
  }

  const r = await upsertBatches(token, events.map(eventRow))
  console.log(`[backfill-plugin-events] upsert ${r.ok}/${events.length}${r.failed ? `（失败 ${r.failed} 行）` : ''}`)

  try {
    const res = await sql(token, `SELECT type, count(*), min(occurred_at)::date, max(occurred_at)::date FROM ecosystem_events WHERE type IN ('plugin_created', 'npm_first_publish') GROUP BY type ORDER BY type`)
    for (const [t, c, minD, maxD] of res.rows) console.log(`[backfill-plugin-events] ${t}: ${c} 条 · ${minD} → ${maxD}`)
  } catch { /* 汇总查询失败不影响结果 */ }
  if (r.failed || npmFailed.length) console.error('[backfill-plugin-events] 存在失败（已降级为告警，exit 0）')
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((e) => {
    console.error(`[backfill-plugin-events] 失败（已降级为告警，exit 0）：${String(e?.stack || e).slice(0, 500)}`)
  })
}
