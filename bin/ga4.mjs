#!/usr/bin/env node
/**
 * bin/ga4.mjs — 用服务账号从 GA4 Data API 拉一个资源的真实访问量，回答「站点到底有没有人访问」。
 *
 * 一次跑三份 runReport（只读，不写任何文件、不留任何状态）：
 *   R1 按天  date × activeUsers / screenPageViews / sessions   → 总计与日均
 *   R2 页面  pagePath × screenPageViews / activeUsers          → Top 15
 *   R3 渠道  sessionDefaultChannelGroup × sessions             → Top 10
 * 默认打印中文对齐文本；--json 只在 stdout 输出一个 JSON 对象（便于管线消费）。
 *
 * 用法（Run）:
 *   node bin/ga4.mjs --sa ~/keys/ga4-sa.json --property 123456789 [--days 28] [--json]
 *   等价：GA4_SA_JSON=~/keys/ga4-sa.json GA4_PROPERTY=123456789 node bin/ga4.mjs --days 7
 *
 * 环境变量：GA4_SA_JSON 服务账号 JSON 路径 · GA4_PROPERTY 数字资源 ID（可带 properties/ 前缀）。
 *
 * 口径与前提（重要）:
 *   - 必须是「数字资源 ID」（GA4 → 管理 → 资源设置），衡量 ID（G-XXXXXXXXXX）喂不进 Data API。
 *   - 服务账号邮箱要加为该 GA4 资源的「查看者」，并在 GCP 项目启用 Analytics Data API。
 *   - access_token 由自签 RS256 JWT 换发（node:crypto，无第三方依赖）。
 *   - activeUsers 是「当日去重」再逐日相加，故总计是上界而非区间去重人数 —— 这是只发三份
 *     报告（不额外发一份无 date 维度的总计报告）的取舍，summary 里照此口径读数。
 *
 * 失败纪律：参数/密钥文件问题 exit 2（用法错误）；HTTP 层问题 exit 1（401/403 附带中文排查提示）；
 * 成功 exit 0。私有密钥、JWT、access_token 一律不回显 —— 错误输出里也不出现，确需引用时只留前 6 位。
 *
 * @module dsh-insights/bin-ga4
 */

import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://analyticsdata.googleapis.com'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const AUD = 'https://oauth2.googleapis.com/token'
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const DAYS_DEFAULT = 28
const DAYS_MAX = 365
const TIMEOUT_MS = 30_000

/** 用法错误（参数 / 密钥文件）→ exit 2。 */
export class Ga4UsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'Ga4UsageError'
    this.exitCode = 2
  }
}

/** HTTP 层错误（token 端点 / runReport）→ exit 1，按 status 附中文排查提示。 */
export class Ga4HttpError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message)
    this.name = 'Ga4HttpError'
    this.status = status
    this.exitCode = 1
  }
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

/**
 * 自签 RS256 JWT：header.claims.signature，三段 base64url。
 * @param {object} claims 至少含 iss/scope/aud/iat/exp
 * @param {string} privateKeyPem PKCS#8/PKCS#1 PEM 私钥
 * @returns {string} JWT（调用方负责不落盘、不回显）
 */
export function buildJwt(claims, privateKeyPem) {
  if (!privateKeyPem || typeof privateKeyPem !== 'string') throw new Ga4UsageError('buildJwt 缺少 PEM 私钥')
  const signingInput = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  return `${signingInput}.${signer.sign(privateKeyPem).toString('base64url')}`
}

/**
 * GA4 资源 ID 归一化：接受 `123456789` 与 `properties/123456789`，返回纯数字串。
 * 衡量 ID（G-XXXXXXXXXX）或任何非数字一律抛 Ga4UsageError（exit 2）并点明去「管理 → 资源设置」取数字 ID。
 * @param {string|number} input
 * @returns {string} 纯数字资源 ID
 */
export function normalizeProperty(input) {
  const raw = String(input ?? '').trim()
  if (!raw) {
    throw new Ga4UsageError('缺少 GA4 资源 ID：用 --property <数字ID> 指定，或设 GA4_PROPERTY（GA4 → 管理 → 资源设置）')
  }
  const m = raw.match(/^(?:properties\/)?(\d+)$/)
  if (m) return m[1]
  const tail = 'Data API 需要的是数字资源 ID（GA4 → 管理 → 资源设置），不是衡量 ID。'
  if (/^G-[A-Z0-9]+$/i.test(raw)) {
    throw new Ga4UsageError(`「${raw}」是衡量 ID（Measurement ID），不是资源 ID —— ${tail}`)
  }
  throw new Ga4UsageError(`无法识别的 GA4 资源 ID「${raw}」：应为纯数字（如 123456789，可带 properties/ 前缀）。${tail}`)
}

/** 解析 CLI 参数（支持 --k v 与 --k=v）；未知参数抛 Ga4UsageError。 */
export function parseArgs(argv = []) {
  const out = { sa: null, property: null, days: DAYS_DEFAULT, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
    const key = eq > 0 ? arg.slice(0, eq) : arg
    const pick = () => {
      const v = eq > 0 ? arg.slice(eq + 1) : argv[++i]
      if (v == null || v === '') throw new Ga4UsageError(`参数 ${key} 缺少取值`)
      return v
    }
    switch (key) {
      case '--sa': out.sa = pick(); break
      case '--property': out.property = pick(); break
      case '--days': {
        const v = pick()
        if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > DAYS_MAX) {
          throw new Ga4UsageError(`--days 必须是 1..${DAYS_MAX} 的正整数，收到「${v}」`)
        }
        out.days = Number(v)
        break
      }
      case '--json': out.json = true; break
      case '-h':
      case '--help': out.help = true; break
      default: throw new Ga4UsageError(`未知参数「${arg}」；用 --help 查看用法`)
    }
  }
  return out
}

/** 读取并校验服务账号 JSON；任何问题抛 Ga4UsageError（exit 2），错误里绝不带文件内容。 */
function readServiceAccount(saPath) {
  let text
  try {
    text = readFileSync(saPath, 'utf8')
  } catch (e) {
    throw new Ga4UsageError(`服务账号 JSON 读取失败：${saPath}（${e?.code || e?.message || '未知错误'}）`)
  }
  let sa
  try {
    sa = JSON.parse(text)
  } catch {
    throw new Ga4UsageError(`服务账号 JSON 不是合法 JSON：${saPath}`)
  }
  if (!sa || typeof sa !== 'object' || typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') {
    throw new Ga4UsageError(`服务账号 JSON 缺少 client_email / private_key：${saPath}（应为 GCP 控制台下载的服务账号密钥）`)
  }
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(sa.private_key)) {
    throw new Ga4UsageError(`服务账号 JSON 的 private_key 不是 PEM 私钥：${saPath}`)
  }
  return sa
}

/** 自签 JWT → access_token（Bearer）。失败只报 HTTP 状态，绝不回显 assertion/token。 */
async function fetchAccessToken(sa, fetchImpl) {
  const now = Math.floor(Date.now() / 1000)
  const jwt = buildJwt({ iss: sa.client_email, scope: SCOPE, aud: AUD, iat: now, exp: now + 3600 }, sa.private_key)
  const body = new URLSearchParams({ grant_type: JWT_BEARER, assertion: jwt }).toString()
  let res
  try {
    res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new Ga4HttpError(`换取 access_token 失败（网络/超时）：${String(e?.message || e).slice(0, 120)}`)
  }
  if (!res.ok) throw new Ga4HttpError(`换取 access_token 被拒（HTTP ${res.status}）`, { status: res.status })
  const data = await res.json().catch(() => null)
  if (!data?.access_token) throw new Ga4HttpError('token 端点未返回 access_token')
  return data.access_token
}

/** 只透出 GA4 结构化错误码（如 PERMISSION_DENIED），不透传可能夹带 token 的原文。 */
async function readErrorStatus(res) {
  try {
    const txt = typeof res.text === 'function' ? await res.text() : ''
    const s = JSON.parse(txt)?.error?.status
    return typeof s === 'string' && /^[A-Z_]{3,40}$/.test(s) ? s : ''
  } catch {
    return ''
  }
}

/** POST 一份 runReport，返回原始响应 JSON。 */
async function runReport({ property, token, body, fetchImpl }) {
  const url = `${API_BASE}/v1beta/properties/${property}:runReport`
  let res
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new Ga4HttpError(`runReport 请求失败（网络/超时）：${String(e?.message || e).slice(0, 120)}`)
  }
  if (!res.ok) {
    const code = await readErrorStatus(res)
    throw new Ga4HttpError(`runReport 返回 HTTP ${res.status}${code ? `（${code}）` : ''}`, { status: res.status })
  }
  return res.json()
}

/** 三份报告的请求体（口径固定：最近 N 天，dateRanges=[{startDate:'NdaysAgo',endDate:'today'}]）。 */
export function buildReports(days = DAYS_DEFAULT) {
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }]
  const desc = (metricName) => [{ metric: { metricName }, desc: true }]
  return {
    byDate: {
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }],
      limit: DAYS_MAX + 1,
    },
    topPages: {
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: desc('screenPageViews'),
      limit: 15,
    },
    channels: {
      dateRanges,
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: desc('sessions'),
      limit: 10,
    },
  }
}

/** runReport 响应 → [{ 维度名: 值, 指标名: number }]。 */
export function reportRows(report) {
  const dims = (report?.dimensionHeaders || []).map((h) => h.name)
  const mets = (report?.metricHeaders || []).map((h) => h.name)
  return (report?.rows || []).map((row) => {
    const o = {}
    dims.forEach((d, i) => { o[d] = row?.dimensionValues?.[i]?.value ?? '' })
    mets.forEach((m, i) => { o[m] = Number(row?.metricValues?.[i]?.value ?? 0) || 0 })
    return o
  })
}

/** GA4 的 YYYYMMDD → YYYY-MM-DD（无法识别则原样返回）。 */
export function formatGaDate(value) {
  const s = String(value ?? '')
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
}

/**
 * 拉取一个资源的全部三份报告。
 * @param {{property:string, sa:object, days?:number, fetchImpl?:Function}} opts
 * @returns {Promise<{property:string, days:number, totals:object, byDate:Array, topPages:Array, channels:Array}>}
 */
export async function collectGa4({ property, sa, days = DAYS_DEFAULT, fetchImpl = globalThis.fetch }) {
  const token = await fetchAccessToken(sa, fetchImpl)
  const reqs = buildReports(days)
  const [byDateRaw, topPagesRaw, channelsRaw] = await Promise.all([
    runReport({ property, token, body: reqs.byDate, fetchImpl }),
    runReport({ property, token, body: reqs.topPages, fetchImpl }),
    runReport({ property, token, body: reqs.channels, fetchImpl }),
  ])
  const byDate = reportRows(byDateRaw).map((r) => ({
    date: formatGaDate(r.date),
    activeUsers: r.activeUsers,
    screenPageViews: r.screenPageViews,
    sessions: r.sessions,
  }))
  const topPages = reportRows(topPagesRaw).map((r) => ({
    pagePath: r.pagePath,
    screenPageViews: r.screenPageViews,
    activeUsers: r.activeUsers,
  }))
  const channels = reportRows(channelsRaw).map((r) => ({
    channel: r.sessionDefaultChannelGroup,
    sessions: r.sessions,
  }))
  const totals = byDate.reduce(
    (a, r) => ({
      activeUsers: a.activeUsers + r.activeUsers,
      screenPageViews: a.screenPageViews + r.screenPageViews,
      sessions: a.sessions + r.sessions,
    }),
    { activeUsers: 0, screenPageViews: 0, sessions: 0 },
  )
  return { property, days, totals, byDate, topPages, channels }
}

/* ----------------------------- 文本渲染 ----------------------------- */

const WIDE_RE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/

const width = (s) => {
  let w = 0
  for (const ch of String(s ?? '')) w += WIDE_RE.test(ch) ? 2 : 1
  return w
}
const padEndW = (s, w) => String(s) + ' '.repeat(Math.max(0, w - width(s)))
const padStartW = (s, w) => ' '.repeat(Math.max(0, w - width(s))) + String(s)

function truncate(s, max) {
  const str = String(s ?? '')
  if (width(str) <= max) return str
  let out = ''
  let w = 0
  for (const ch of str) {
    const cw = WIDE_RE.test(ch) ? 2 : 1
    if (w + cw > max - 1) break
    out += ch
    w += cw
  }
  return `${out}…`
}

/** 紧凑对齐表（无表格库，CJK 按 2 列宽计算）。 */
function table(headers, rows, aligns) {
  if (!rows.length) return ['（无数据）']
  const cols = headers.map((h, c) => Math.max(width(h), ...rows.map((r) => width(r[c]))))
  const line = (cells) => '  ' + cells.map((v, c) => (aligns[c] === 'r' ? padStartW(v, cols[c]) : padEndW(v, cols[c]))).join('  ').trimEnd()
  return [line(headers), ...rows.map(line)]
}

/** 人类可读输出（中文）。 */
export function renderHuman(data) {
  const { property, days, totals, byDate, topPages, channels } = data
  const num = (n) => Number(n || 0).toLocaleString('en-US')
  const perDay = days > 0 ? (totals.screenPageViews / days).toFixed(1) : '0.0'
  const lines = []
  lines.push(`近 ${days} 天：${num(totals.activeUsers)} 活跃用户 · ${num(totals.screenPageViews)} 浏览量 · ${num(totals.sessions)} 会话 · 日均 ${perDay} 浏览`)
  lines.push(`资源：${property}（activeUsers 为逐日去重后相加，总计是上界）`)
  lines.push('')
  lines.push('按天')
  lines.push(...table(['日期', '活跃用户', '浏览量', '会话'], byDate.map((r) => [r.date, num(r.activeUsers), num(r.screenPageViews), num(r.sessions)]), ['l', 'r', 'r', 'r']))
  lines.push('')
  lines.push('页面 Top 15')
  lines.push(...table(['页面路径', '浏览量', '活跃用户'], topPages.map((r) => [truncate(r.pagePath, 48), num(r.screenPageViews), num(r.activeUsers)]), ['l', 'r', 'r']))
  lines.push('')
  lines.push('渠道 Top 10')
  lines.push(...table(['渠道', '会话'], channels.map((r) => [r.channel || '(未设置)', num(r.sessions)]), ['l', 'r']))
  return lines.join('\n')
}

const HELP_TEXT = `用法：node bin/ga4.mjs --sa <service-account.json> --property <数字ID> [--days 28] [--json]

  --sa <path>        服务账号 JSON 密钥路径（或环境变量 GA4_SA_JSON）
  --property <id>    GA4 数字资源 ID，如 123456789 或 properties/123456789（或 GA4_PROPERTY）
  --days <n>         统计窗口，1..365，默认 28
  --json             只输出一个 JSON 对象到 stdout
  -h, --help         显示本帮助

前提：服务账号邮箱需加为该 GA4 资源的「查看者」，并在 GCP 项目启用 Analytics Data API。
`

/* ------------------------------- 入口 ------------------------------- */

const httpHint = (status) => {
  if (status === 401) return '鉴权失败：服务账号密钥可能错误、已撤销或已过期，或本机时间偏差过大；请重新下载密钥 JSON。'
  if (status === 403) return '权限不足：把服务账号邮箱加为该 GA4 资源的「查看者」，并在 GCP 项目启用 Analytics Data API。'
  if (status === 404) return '资源不存在：确认数字资源 ID 是否正确（不要填衡量 ID G-XXXXXXXXXX）。'
  if (status === 400) return '请求被拒：服务账号密钥可能无效，或资源 ID 不正确；也可能尚未启用 Analytics Data API。'
  return ''
}

/**
 * CLI 入口（返回 exit code，不调用 process.exit，便于单测直接 await）。
 * @param {string[]} argv 不含 node 与脚本名
 * @param {object} env 环境变量快照（默认 process.env）
 * @param {{out?:Function, err?:Function}} io 输出出口（默认 stdout/stderr）
 * @returns {Promise<number>} 0 成功 · 1 运行期失败 · 2 用法/密钥错误
 */
export async function main(argv = process.argv.slice(2), env = process.env, io = {}) {
  const out = io.out || ((s) => process.stdout.write(s))
  const err = io.err || ((s) => process.stderr.write(s))
  const errln = (s) => err(String(s).endsWith('\n') ? s : `${s}\n`)

  try {
    const args = parseArgs(argv)
    if (args.help) {
      out(HELP_TEXT)
      return 0
    }
    const saPath = args.sa || env.GA4_SA_JSON || ''
    if (!saPath) throw new Ga4UsageError('缺少服务账号 JSON 路径：用 --sa <path> 指定，或设 GA4_SA_JSON')
    const property = normalizeProperty(args.property ?? env.GA4_PROPERTY ?? '')
    const sa = readServiceAccount(saPath)
    const data = await collectGa4({ property, sa, days: args.days, fetchImpl: globalThis.fetch })
    out(args.json ? `${JSON.stringify(data)}\n` : `${renderHuman(data)}\n`)
    return 0
  } catch (e) {
    if (e instanceof Ga4UsageError) {
      errln(`[ga4] ${e.message}`)
      return 2
    }
    if (e instanceof Ga4HttpError) {
      errln(`[ga4] ${e.message}`)
      const hint = httpHint(e.status)
      if (hint) errln(`[ga4] ${hint}`)
      return 1
    }
    errln(`[ga4] 未预期失败：${String(e?.message || e).slice(0, 200)}`)
    return 1
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main()
    .then((code) => { process.exitCode = code })
    .catch((e) => {
      console.error(`[ga4] 未预期失败：${String(e?.message || e).slice(0, 200)}`)
      process.exitCode = 1
    })
}
