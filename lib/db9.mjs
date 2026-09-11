/**
 * lib/db9.mjs — db9（serverless Postgres）SQL-over-HTTP 客户端。
 *
 * 协议：POST { query } → { columns, rows, row_count }，Bearer token 鉴权
 * （与 dsh-crash-collect functions/admin/_layout.js 的 sql() 同一套）。
 * 零依赖：node fetch + AbortSignal.timeout（20s），网络/5xx 最多重试 2 次，
 * 4xx（SQL 语法/鉴权类错误）不重试直接抛。
 *
 * 调用方纪律：db9 是管线外的旁路存储，isEnabled() 为 false 时优雅跳过，
 * 任何 sql() 抛错都应降级为告警，绝不阻塞管线（对齐 collect/downloads.mjs）。
 *
 * @module dsh-insights/lib/db9
 */

// 默认指向 dsh-data 库；可用 DB9_SQL_URL 覆盖（如临时切回旧库或指向其他镜像）
export const DEFAULT_SQL_URL = process.env.DB9_SQL_URL || 'https://api.db9.ai/customer/databases/toc6zdt4vd7j/sql'

const TIMEOUT_MS = 20000
const MAX_RETRIES = 2

/** 无 DB9_TOKEN 时调用方应整体跳过（打印说明 + exit 0）。 */
export const isEnabled = () => Boolean(process.env.DB9_TOKEN)

/** 执行一条 SQL，返回完整响应体 { columns, rows, row_count, command }。 */
export async function sql(token, statement, { url = DEFAULT_SQL_URL } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: statement }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.rows === undefined) {
        const err = new Error(body?.message ?? `HTTP ${res.status}`)
        err.retryable = res.status >= 500 // 4xx 多为 SQL/鉴权错误，重试无意义
        throw err
      }
      return body
    } catch (e) {
      lastErr = e
      if (e.retryable === false || attempt >= MAX_RETRIES) break
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  throw lastErr
}

/**
 * SQL 字面量：null/undefined → NULL；有限数字/布尔原生写出；
 * 其余按字符串处理，单引号双写转义。
 */
export function lit(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return `'${String(v).replace(/'/g, "''")}'`
}

/** 数组/对象 → JSONB 字面量（'...'::jsonb）；null/undefined → NULL。 */
export function jsonLit(v) {
  if (v === null || v === undefined) return 'NULL'
  return `${lit(JSON.stringify(v))}::jsonb`
}

/** 按最后一个 @ 拆 npm 缓存键 'pkg@version'（scoped 包 '@scope/name@1.2.3' 也正确；无版本时 version 为 ''）。 */
export function splitPkgVersion(key) {
  const s = String(key)
  const i = s.lastIndexOf('@')
  if (i <= 0) return [s, '']
  return [s.slice(0, i), s.slice(i + 1)]
}

/** 同 key 多行取 timeFn 最新者（如 llm.jsonl 重打标：同 full_name 取 taggedAt 最新一行）。 */
export function latestBy(rows, keyFn, timeFn) {
  const m = new Map()
  for (const r of rows || []) {
    const k = keyFn(r)
    if (!k) continue
    const prev = m.get(k)
    if (!prev || String(timeFn(r) || '') > String(timeFn(prev) || '')) m.set(k, r)
  }
  return [...m.values()]
}

/**
 * dynamics.json → ecosystem_events 行 [{ type, key, occurred_at, payload }]。
 * 只抽带时间戳、属于"发生过的客观事实"的条目：
 *   shell_release        ← dsh.releases[]（key = tag）
 *   npm_publish          ← dsh.npm.versions[]（key = version）
 *   platform_release     ← platform[].latestRelease（key = repo@tag）
 *   api_model_first_seen ← models[]（仅 firstSeen 非空者，key = model id）
 * stars/forks/pushed_at/dist-tags/compatSignal 等纯状态快照不抽。
 */
export function extractDynamicsEvents(d) {
  const events = []
  for (const r of d?.dsh?.releases || []) {
    if (r?.tag && r?.published_at) events.push({ type: 'shell_release', key: r.tag, occurred_at: r.published_at, payload: r })
  }
  for (const v of d?.dsh?.npm?.versions || []) {
    if (v?.version && v?.time) events.push({ type: 'npm_publish', key: v.version, occurred_at: v.time, payload: { pkg: d.dsh.npm.pkg, ...v } })
  }
  for (const p of d?.platform || []) {
    const rel = p?.latestRelease
    if (p?.repo && rel?.tag && rel?.published_at) {
      events.push({ type: 'platform_release', key: `${p.repo}@${rel.tag}`, occurred_at: rel.published_at, payload: { repo: p.repo, ...rel } })
    }
  }
  for (const m of d?.models || []) {
    if (m?.id && m?.firstSeen) events.push({ type: 'api_model_first_seen', key: m.id, occurred_at: m.firstSeen, payload: m })
  }
  return events
}

/** insight-reports/<week>.json → weekly_letters 记录；extra 存剩余字段（防漏字段），无 week 返回 null。 */
export function letterToRecord(j) {
  if (!j || typeof j !== 'object' || !j.week) return null
  const { week, range, generatedAt, model, usage, ...extra } = j
  return { week, range: range ?? null, generatedAt: generatedAt ?? null, model: model ?? null, usage: usage ?? null, extra }
}

/**
 * plugins.jsonl 行 → plugin_created 事件（occurred_at = 仓库 created_at，缺失回退 nowIso）。
 * payload 刻意小：description 截 200 字符、topics 截 10 个。无 full_name 返回 null。
 */
export function pluginCreatedEvent(p, nowIso) {
  if (!p?.full_name) return null
  return {
    type: 'plugin_created',
    key: p.full_name,
    occurred_at: p.created_at || nowIso,
    payload: {
      stars: p.stars ?? null,
      description: p.description ? String(p.description).slice(0, 200) : null,
      topics: Array.isArray(p.topics) ? p.topics.slice(0, 10) : [],
      pkgName: p.pkgName ?? null,
    },
  }
}

/**
 * db9 plugins 现存量（oldMap: full_name → {version, archived, npmPublished}）与
 * plugins.jsonl 当批对比，产出插件级事件：
 *   新 full_name             → plugin_created（occurred_at = created_at || now）
 *   version 变化（两侧都有值）→ plugin_release（key full_name@新版本，occurred_at = now）
 *   archived false→true      → plugin_archived
 *   npm published false→true → npm_first_publish（occurred_at 置 null，调用方拉 registry
 *                              time.created 补齐，失败回退 now）
 * 口径：oldMap 为空（新库首灌）时只会产生 plugin_created —— 与 backfill-plugin-events
 * 同键同 occurred_at（仓库创建时间），ON CONFLICT 去重，无"幽灵事件"；其余三类都要求
 * 旧行存在，空表 diff 不可能产生。
 */
export function diffPluginEvents(oldMap, newRows, nowIso) {
  const events = []
  for (const p of newRows || []) {
    if (!p?.full_name) continue
    const old = oldMap?.get(p.full_name)
    if (!old) {
      const e = pluginCreatedEvent(p, nowIso)
      if (e) events.push(e)
      continue
    }
    if (p.version && old.version && p.version !== old.version) {
      events.push({ type: 'plugin_release', key: `${p.full_name}@${p.version}`, occurred_at: nowIso, payload: { from: old.version, to: p.version } })
    }
    if (!old.archived && p.archived) {
      events.push({ type: 'plugin_archived', key: p.full_name, occurred_at: nowIso, payload: { archived: true } })
    }
    if (!old.npmPublished && p.npm?.published && p.pkgName) {
      events.push({ type: 'npm_first_publish', key: p.pkgName, occurred_at: null, payload: { full_name: p.full_name, version: p.version ?? null } })
    }
  }
  return events
}
