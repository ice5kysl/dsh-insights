#!/usr/bin/env node
/**
 * bin/traffic-sync.mjs — 站点访问统计入 db9（**私有**：不写进公开仓库文件）。
 *
 * 为什么不在 data/metrics.jsonl 里：那份文件是公开的（站点 About 页也这么写着），
 * 而站点访问量属于运营数据。所以它单独落 db9 的 site_traffic 表，由
 * dsh-crash-collect 的 /admin/traffic 后台读取展示。
 *
 * 两个来源，各自独立、按需接入（未配置即跳过，不影响另一个）：
 *   umami  dsh-insights.com + dsh-why.com  ← UMAMI_SHARE（同一个 website，按 hostname 拆，见 bin/umami.mjs）
 *   ga4    dsh-why.com                     ← GA4_SA_JSON + GA4_PROPERTY（服务账号，见 bin/ga4.mjs）
 *          —— 2026-09-13 起 dsh-why.com 已改用 Umami，ga4 仅作历史来源保留
 *
 * 表结构（自建，幂等）：
 *   site_traffic(date, source, window_days, visitors, pageviews, sessions, bounces,
 *                avg_duration, daily, top_paths, referrers, countries, hostnames,
 *                windows, active, breakdowns, collected_at)
 *   PRIMARY KEY (date, source) —— 每天一行滚动窗口快照，重跑即覆盖（ON CONFLICT DO UPDATE）。
 *
 * hostnames：dsh-why.com 与 dsh-insights.com 共用同一个 Umami website（Domain 字段只是展示用，
 * 服务端不校验），靠 hostname 维度拆开——2026-09-13 起两站都走 umami 来源。
 * windows：近 1 天 / 近 7 天口径（与窗口同 endAt），供后台对比"近期 vs 全窗口"。
 * active：采集瞬间的实时在线访客。breakdowns：18 个维度（路径/入口/出口/来源/国家/地区/城市/
 * 浏览器/系统/设备/语言/屏幕/标题/事件/UTM），每项 {unit, rows:[{value,count}]}。
 *
 * 用法：
 *   DB9_TOKEN=… UMAMI_SHARE=<分享链接> node bin/traffic-sync.mjs
 *   DB9_TOKEN=… UMAMI_SHARE=… GA4_SA_JSON=~/keys/ga4-sa.json GA4_PROPERTY=123456789 node bin/traffic-sync.mjs
 *   node bin/traffic-sync.mjs --dry-run          # 只打印将要写入的行，不碰库（无需 DB9_TOKEN）
 *
 * 环境变量：DB9_TOKEN 必填（写库）· DB9_SQL_URL 可选 · UMAMI_SHARE · GA4_PROPERTY ·
 *          GA4_SA_JSON（服务账号 JSON 的**路径**，本地用）或 GA4_SA_KEY（JSON **内容**，CI secret 用）·
 *          TRAFFIC_WINDOW_DAYS 可选（默认 28）
 *
 * 失败纪律（同 db9-sync / crash-corpus）：无 DB9_TOKEN → 告警 exit 0；单个来源失败 → 告警继续；
 * 写库失败 → 告警 exit 0。旁路数据永不阻塞管线；只有用法错误 exit 2。
 *
 * @module dsh-insights/bin-traffic-sync
 */

import { readFileSync } from 'node:fs'
import { collectUmami, normalizeShare } from './umami.mjs'
import { collectGa4 } from './ga4.mjs'

const DEFAULT_SQL_URL = process.env.DB9_SQL_URL || 'https://api.db9.ai/customer/databases/toc6zdt4vd7j/sql'
const WINDOW_DEFAULT = 28

const DDL = `CREATE TABLE IF NOT EXISTS site_traffic (
  date DATE NOT NULL,
  source TEXT NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 28,
  visitors BIGINT,
  pageviews BIGINT,
  sessions BIGINT,
  bounces BIGINT,
  avg_duration INTEGER,
  daily JSONB,
  top_paths JSONB,
  referrers JSONB,
  countries JSONB,
  hostnames JSONB,
  windows JSONB,
  active INTEGER,
  breakdowns JSONB,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, source)
)`

// 建表语句之外的历史表补列（幂等，逐条执行——db9 HTTP API 一次只吃一条语句）
const MIGRATIONS = [
  'ALTER TABLE site_traffic ADD COLUMN IF NOT EXISTS hostnames JSONB',
  'ALTER TABLE site_traffic ADD COLUMN IF NOT EXISTS windows JSONB',
  'ALTER TABLE site_traffic ADD COLUMN IF NOT EXISTS active INTEGER',
  'ALTER TABLE site_traffic ADD COLUMN IF NOT EXISTS breakdowns JSONB',
]

/** 数字字面量（null/undefined/NaN → NULL）。 */
export function numLit(v) {
  const n = Number(v)
  return v == null || Number.isNaN(n) ? 'NULL' : String(Math.round(n))
}

/** JSONB 字面量：单引号双写转义，null → NULL（文案里可能带引号，不能直接拼）。 */
export function jsonLit(v) {
  if (v == null) return 'NULL'
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
}

/** 一行快照 → 幂等 upsert（同 date+source 覆盖）。所有值都过 numLit/jsonLit。 */
export function buildUpsert(row) {
  const cols = ['date', 'source', 'window_days', 'visitors', 'pageviews', 'sessions', 'bounces',
    'avg_duration', 'daily', 'top_paths', 'referrers', 'countries', 'hostnames', 'windows', 'active', 'breakdowns']
  const vals = [
    `'${row.date}'`, `'${row.source}'`, numLit(row.window_days), numLit(row.visitors),
    numLit(row.pageviews), numLit(row.sessions), numLit(row.bounces), numLit(row.avg_duration),
    jsonLit(row.daily), jsonLit(row.top_paths), jsonLit(row.referrers), jsonLit(row.countries),
    jsonLit(row.hostnames), jsonLit(row.windows), numLit(row.active), jsonLit(row.breakdowns),
  ]
  const updates = cols.filter((c) => c !== 'date' && c !== 'source')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ')
  return `INSERT INTO site_traffic (${cols.join(', ')}) VALUES (${vals.join(', ')})
ON CONFLICT (date, source) DO UPDATE SET ${updates}, collected_at = now()`
}

async function sql(url, token, query, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.error || body?.message) {
    throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`)
  }
  return body
}

/** 服务账号：既接受 JSON 文件路径（本地），也接受 JSON 内容本身（CI secret 里放不下路径）。 */
export function readServiceAccount(spec) {
  const s = String(spec ?? '').trim()
  if (!s) throw new Error('服务账号未配置')
  if (s.startsWith('{')) return JSON.parse(s)
  return JSON.parse(readFileSync(s, 'utf8'))
}

/** dsh-insights.com + dsh-why.com（Umami 公开分享链接，同一个 website，按 hostname 拆）→ site_traffic 行。 */
function umamiRow(d, date, windowDays) {
  return {
    date,
    source: 'umami',
    window_days: windowDays,
    visitors: d.totals.visitors,
    pageviews: d.totals.pageviews,
    sessions: d.totals.visits,
    bounces: d.totals.bounces,
    avg_duration: Math.round(d.totals.avgDuration),
    daily: (d.byDate || []).map((x) => ({ date: x.date, pageviews: x.pageviews })),
    top_paths: (d.topPaths || []).map((x) => ({ path: x.path, pageviews: x.pageviews })),
    referrers: (d.referrers || []).map((x) => ({ referrer: x.referrer, sessions: x.visits })),
    countries: (d.countries || []).map((x) => ({ country: x.country, sessions: x.visits })),
    hostnames: (d.hostnames || []).map((x) => ({ host: x.hostname, visitors: x.visitors })),
    // 近 1 天 / 近 7 天窗口（同一 endAt），给后台做"近期 vs 全窗口"对比。
    // 注意窗口字段沿用 computeTotals 命名：sessions 在那边叫 visits。
    windows: d.windows
      ? Object.fromEntries(Object.entries(d.windows).map(([k, w]) => [k, w && {
        visitors: w.visitors, pageviews: w.pageviews, sessions: w.visits, bounces: w.bounces,
        avg_duration: Math.round(w.avgDuration || 0),
      }]))
      : null,
    active: Number.isFinite(d.active) ? d.active : null,
    // 18 个维度（unit + rows[{value,count}]），见 bin/umami.mjs
    breakdowns: d.breakdowns || null,
  }
}

/** dsh-why.com（GA4）→ site_traffic 行。GA4 没有 bounces/平均停留，记 NULL。 */
function ga4Row(d, date, windowDays) {
  return {
    date,
    source: 'ga4',
    window_days: windowDays,
    visitors: d.totals.activeUsers,
    pageviews: d.totals.screenPageViews,
    sessions: d.totals.sessions,
    bounces: null,
    avg_duration: null,
    daily: (d.byDate || []).map((x) => ({ date: x.date, pageviews: x.screenPageViews })),
    top_paths: (d.topPages || []).map((x) => ({ path: x.pagePath, pageviews: x.screenPageViews })),
    referrers: (d.channels || []).map((x) => ({ referrer: x.channel, sessions: x.sessions })),
    countries: null,
    hostnames: null,
    windows: null,
    active: null,
    breakdowns: null,
  }
}

/**
 * 采集 + 入库。返回 { date, rows:[{source, ok, error?}], written }；不抛异常（除用法错误）。
 * @param {{env?:object, fetchImpl?:Function, dryRun?:boolean, now?:Function, log?:Function}} opts
 */
export async function syncTraffic({ env = process.env, fetchImpl = globalThis.fetch, dryRun = false, now = () => new Date(), log = console.log } = {}) {
  const url = env.DB9_SQL_URL || DEFAULT_SQL_URL
  const token = env.DB9_TOKEN
  const windowDays = Number(env.TRAFFIC_WINDOW_DAYS || WINDOW_DEFAULT)
  const date = now().toISOString().slice(0, 10)
  const rows = []

  const wantUmami = Boolean(env.UMAMI_SHARE)
  const saSpec = env.GA4_SA_KEY || env.GA4_SA_JSON
  const wantGa4 = Boolean(saSpec && env.GA4_PROPERTY)
  if (!wantUmami && !wantGa4) {
    log('[traffic] 未配置任何来源（UMAMI_SHARE / GA4_SA_JSON+GA4_PROPERTY），跳过')
    return { date, rows, written: 0 }
  }

  if (wantUmami) {
    try {
      const { slug, region } = normalizeShare(env.UMAMI_SHARE, { region: env.UMAMI_REGION })
      const d = await collectUmami({ slug, region, days: windowDays, fetchImpl, now: () => now().getTime() })
      rows.push({ row: umamiRow(d, date, windowDays), source: 'umami' })
    } catch (e) {
      log(`[traffic] umami 采集失败（跳过）：${String(e?.message || e).slice(0, 160)}`)
      rows.push({ source: 'umami', error: true })
    }
  }
  if (wantGa4) {
    try {
      const sa = readServiceAccount(saSpec)
      const d = await collectGa4({ property: env.GA4_PROPERTY, sa, days: windowDays, fetchImpl })
      rows.push({ row: ga4Row(d, date, windowDays), source: 'ga4' })
    } catch (e) {
      log(`[traffic] ga4 采集失败（跳过）：${String(e?.message || e).slice(0, 160)}`)
      rows.push({ source: 'ga4', error: true })
    }
  }

  const collected = rows.filter((r) => r.row)
  if (dryRun) {
    for (const r of collected) log(`[traffic][dry-run] ${r.source} → ${JSON.stringify(r.row).slice(0, 400)}`)
    return { date, rows, written: 0 }
  }
  if (!token) {
    log('[traffic] 未配置 DB9_TOKEN，只采集不入库（exit 0）')
    return { date, rows, written: 0 }
  }

  let written = 0
  try {
    await sql(url, token, DDL, fetchImpl)
    for (const ddl of MIGRATIONS) await sql(url, token, ddl, fetchImpl)
    for (const r of collected) {
      await sql(url, token, buildUpsert(r.row), fetchImpl)
      written++
      log(`[traffic] ${r.row.source} ${r.row.date}：${r.row.visitors} 访客 · ${r.row.pageviews} 浏览 · ${r.row.sessions} 会话`)
    }
    if (!collected.length) log('[traffic] 没有采集到任何来源的数据，未写入')
  } catch (e) {
    log(`[traffic] 写库失败（降级为告警，exit 0）：${String(e?.message || e).slice(0, 200)}`)
  }
  return { date, rows, written }
}

const isMain = process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href
if (isMain) {
  const dryRun = process.argv.slice(2).includes('--dry-run')
  const unknown = process.argv.slice(2).filter((a) => a !== '--dry-run')
  if (unknown.length) {
    console.error(`[traffic] 未知参数：${unknown.join(' ')}（只支持 --dry-run）`)
    process.exit(2)
  }
  await syncTraffic({ dryRun })
}
