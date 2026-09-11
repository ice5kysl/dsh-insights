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

export const DEFAULT_SQL_URL = 'https://api.db9.ai/customer/databases/wqxvoyf8yu05/sql'

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
