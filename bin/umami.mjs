#!/usr/bin/env node
/**
 * bin/umami.mjs — 用 Umami Cloud 的「公开分享链接」只读拉一个站点的真实访问量，回答「站点到底有没有人访问」。
 *
 * 分享接口（公开、无需登录，逆向自公开分享页）：
 *   1) 配置  GET /analytics/<region>/api/share/<slug>            → {shareId, shareType, parameters, websiteId, token}
 *   2) 数据  GET /analytics/<region>/api/websites/<websiteId>/<endpoint>?startAt=<epoch_ms>&endAt=<epoch_ms>
 *            请求头必须带 x-umami-share-token 与 x-umami-share-context（即 shareId）。
 *
 * 一次跑五份只读请求（顺序执行，不写任何文件、不留任何状态）：
 *   stats                              → 总计（pageviews/visitors/visits/bounces/totaltime）
 *   pageviews?unit=day                 → 按天曲线
 *   metrics?type=path&limit=15         → 页面 Top 15
 *   metrics?type=referrer&limit=10     → 来源 Top 10
 *   metrics?type=country&limit=10      → 国家 Top 10
 * 三个 metrics 调用容忍单点失败（该字段记为 null 并继续）；stats / pageviews 失败即整体失败。
 * 默认打印中文对齐文本；--json 只在 stdout 输出一个 JSON 对象（便于管线消费）。
 *
 * 用法（Run）:
 *   node bin/umami.mjs --share https://cloud.umami.is/analytics/us/share/<slug> [--days 30] [--json]
 *   等价：UMAMI_SHARE=<url|slug> UMAMI_REGION=eu node bin/umami.mjs --days 7
 *
 * 环境变量：UMAMI_SHARE 分享链接或 slug · UMAMI_REGION 区域覆盖（us/eu）。
 *
 * 口径与前提（重要）:
 *   - 分享链接在 Umami → Settings → Share 生成，是「公开只读」链接，任何人拿到即可读该站点聚合数据；
 *     本工具只读，绝不写文件、绝不改远端状态。链接被撤销/停用后 401/403。
 *   - token 是该公开分享页自行嵌入的 JWT —— 虽是公开信息，也一律不回显、不落盘；确需引用只留前 6 位。
 *   - 区域（us/eu）取自链接路径 /analytics/<region>/share/<slug>，可用 --region 显式覆盖；裸 slug 默认 us。
 *
 * 失败纪律：参数问题 exit 2（用法错误）；配置/HTTP 层问题 exit 1（401/403 提示链接可能已撤销，404 提示
 * slug/区域不对）；成功 exit 0。token / JWT 一律不出现在错误输出里。
 *
 * @module dsh-insights/bin-umami
 */

import { pathToFileURL } from 'node:url'

const CLOUD_BASE = 'https://cloud.umami.is'
export const REGIONS = ['us', 'eu']
const DEFAULT_REGION = 'us'
const DAYS_DEFAULT = 30
const DAYS_MAX = 365
const DAY_MS = 86_400_000
const TIMEOUT_MS = 30_000
const SLUG_RE = /^[A-Za-z0-9._-]+$/

/** 用法错误（参数 / 缺失分享链接）→ exit 2。 */
export class UmamiUsageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UmamiUsageError'
    this.exitCode = 2
  }
}

/** HTTP 层错误（分享配置 / 数据端点）→ exit 1，按 status 附中文排查提示。 */
export class UmamiHttpError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message)
    this.name = 'UmamiHttpError'
    this.status = status
    this.exitCode = 1
  }
}

/** 只留前 6 位（用于万不得已要引用 token 的场合）。 */
export function maskToken(token) {
  const s = String(token ?? '')
  return s ? `${s.slice(0, 6)}…` : ''
}

/** 从任意文本里抹掉已知 token 与 JWT 形状的串，避免上游错误文案把凭据带回终端。 */
export function maskSecrets(text, token = '') {
  let s = String(text ?? '')
  const t = String(token ?? '')
  if (t.length >= 8) s = s.split(t).join(maskToken(t))
  s = s.replace(/eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, (m) => maskToken(m))
  return s
}

const sliceError = (e, max = 120) => String(e?.message ?? e ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** 区域归一化：空 → ''（表示未指定）；非 us/eu → 用法错误。 */
export function normalizeRegion(region) {
  const raw = String(region ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (!REGIONS.includes(raw)) {
    throw new UmamiUsageError(`不支持的区域「${String(region).trim()}」：目前只支持 us / eu（可用 --region 指定）`)
  }
  return raw
}

/**
 * 分享输入归一化：接受完整 URL（带/不带区域段）或裸 slug，返回 {slug, region}。
 * URL 形态：https://cloud.umami.is/analytics/<us|eu>/share/<slug> 或 https://cloud.umami.is/share/<slug>。
 * 显式 region（--region / UMAMI_REGION）优先于链接里的区域；裸 slug 默认 us。
 * @param {string} input 分享链接或 slug
 * @param {{region?:string}} [opts] region 为显式覆盖（空则忽略）
 * @returns {{slug:string, region:string}}
 */
export function normalizeShare(input, { region } = {}) {
  const raw = String(input ?? '').trim()
  if (!raw) {
    throw new UmamiUsageError('缺少分享链接：用 --share <url|slug> 指定，或设 UMAMI_SHARE（Umami → Settings → Share 生成公开只读分享链接）')
  }
  const forced = normalizeRegion(region)

  let slug = ''
  let parsedRegion = ''
  if (raw.includes('/')) {
    let url
    try {
      url = new URL(raw)
    } catch {
      try {
        url = new URL(`https://${raw}`)
      } catch {
        throw new UmamiUsageError(`无法解析分享链接「${raw.slice(0, 120)}」：应为 https://cloud.umami.is/analytics/<us|eu>/share/<slug>`)
      }
    }
    const segs = url.pathname.split('/').filter(Boolean)
    const i = segs.findIndex((s) => s.toLowerCase() === 'share')
    if (i >= 0 && segs[i + 1]) {
      slug = segs[i + 1]
      const prev = (segs[i - 1] || '').toLowerCase()
      if (REGIONS.includes(prev)) parsedRegion = prev
      else if (prev && prev !== 'analytics') {
        throw new UmamiUsageError(`不支持的区域「${segs[i - 1]}」：目前只支持 us / eu（可用 --region 覆盖）`)
      }
    }
  } else {
    slug = raw
  }

  if (!slug) {
    throw new UmamiUsageError(`分享链接里没有 slug「${raw.slice(0, 120)}」：应为 https://cloud.umami.is/analytics/<us|eu>/share/<slug>（Umami → Settings → Share）`)
  }
  if (!SLUG_RE.test(slug)) {
    throw new UmamiUsageError(`无法识别的分享 slug「${slug.slice(0, 120)}」：只允许字母、数字、点、下划线与连字符`)
  }
  return { slug, region: forced || parsedRegion || DEFAULT_REGION }
}

/** 解析 CLI 参数（支持 --k v 与 --k=v）；未知参数抛 UmamiUsageError。 */
export function parseArgs(argv = []) {
  const out = { share: null, region: null, days: DAYS_DEFAULT, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
    const key = eq > 0 ? arg.slice(0, eq) : arg
    const pick = () => {
      const v = eq > 0 ? arg.slice(eq + 1) : argv[++i]
      if (v == null || v === '') throw new UmamiUsageError(`参数 ${key} 缺少取值`)
      return v
    }
    switch (key) {
      case '--share': out.share = pick(); break
      case '--region': out.region = pick(); break
      case '--days': {
        const v = pick()
        if (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > DAYS_MAX) {
          throw new UmamiUsageError(`--days 必须是 1..${DAYS_MAX} 的正整数，收到「${v}」`)
        }
        out.days = Number(v)
        break
      }
      case '--json': out.json = true; break
      case '-h':
      case '--help': out.help = true; break
      default: throw new UmamiUsageError(`未知参数「${arg}」；用 --help 查看用法`)
    }
  }
  return out
}

/** 分享配置 URL（无鉴权头，公开接口）。 */
export function buildShareConfigUrl({ slug, region, base = CLOUD_BASE }) {
  return `${base}/analytics/${region}/api/share/${encodeURIComponent(slug)}`
}

/** 数据端点 URL（startAt/endAt 为 epoch 毫秒；其余参数如 unit/type/limit 依次追加）。 */
export function buildDataUrl({ region, websiteId, endpoint, params = {}, startAt, endAt, base = CLOUD_BASE }) {
  const qs = new URLSearchParams()
  qs.set('startAt', String(startAt))
  qs.set('endAt', String(endAt))
  for (const [k, v] of Object.entries(params)) {
    if (v != null) qs.set(k, String(v))
  }
  return `${base}/analytics/${region}/api/websites/${encodeURIComponent(websiteId)}/${endpoint}?${qs.toString()}`
}

/** ISO 时间戳 → YYYY-MM-DD（无法识别则原样返回）。 */
export function formatIsoDate(value) {
  const s = String(value ?? '')
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s
}

/** 秒 → `Xs`（>= 60s 时 `Mm Ss`）。 */
export function formatDuration(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return '0s'
  const total = Math.round(s)
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}m ${total % 60}s`
}

/** stats 响应 → totals（bounceRate / avgDuration 为比值与秒数，除零得 0）。 */
export function computeTotals(stats = {}) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const pageviews = n(stats.pageviews)
  const visitors = n(stats.visitors)
  const visits = n(stats.visits)
  const bounces = n(stats.bounces)
  const totaltime = n(stats.totaltime)
  return {
    pageviews,
    visitors,
    visits,
    bounces,
    totaltime,
    bounceRate: visits > 0 ? bounces / visits : 0,
    avgDuration: visits > 0 ? totaltime / visits : 0,
  }
}

const toList = (v) => {
  if (Array.isArray(v)) return v
  if (Array.isArray(v?.data)) return v.data
  return []
}

/** pageviews?unit=day 响应 → [{date:'YYYY-MM-DD', pageviews}]。 */
export function mapByDate(payload) {
  const list = Array.isArray(payload) ? payload : toList(payload?.pageviews)
  return list.map((r) => ({ date: formatIsoDate(r?.x), pageviews: Number(r?.y ?? 0) || 0 }))
}

/** metrics 响应 → [{<keyName>: x, <valueName>: y}]。 */
export function mapMetrics(payload, keyName, valueName) {
  return toList(payload).map((r) => ({ [keyName]: String(r?.x ?? ''), [valueName]: Number(r?.y ?? 0) || 0 }))
}

/**
 * 拉取分享配置；缺 websiteId/token、非 JSON、HTTP 失败一律 UmamiHttpError（exit 1）。
 * 网络异常只透出截断后的中文描述，绝不回显响应体。
 */
async function fetchShareConfig({ slug, region, fetchImpl }) {
  const url = buildShareConfigUrl({ slug, region })
  let res
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    throw new UmamiHttpError(`读取分享配置失败（网络/超时）：${maskSecrets(sliceError(e))}`)
  }
  if (!res?.ok) {
    throw new UmamiHttpError(`读取分享配置返回 HTTP ${res?.status ?? 0}`, { status: Number(res?.status) || 0 })
  }
  let conf
  try {
    conf = await res.json()
  } catch {
    throw new UmamiHttpError('分享配置不是合法 JSON：链接可能已失效，请在 Umami → Settings → Share 重新生成')
  }
  if (!conf || typeof conf !== 'object') {
    throw new UmamiHttpError('分享配置为空：链接可能已失效，请在 Umami → Settings → Share 重新生成')
  }
  const websiteId = conf.websiteId ?? conf?.parameters?.websiteId
  if (!websiteId || !conf.token) {
    throw new UmamiHttpError('分享配置缺少 websiteId / token：链接可能已失效或被停用，请在 Umami → Settings → Share 重新生成')
  }
  return { shareId: String(conf.shareId ?? ''), websiteId: String(websiteId), token: String(conf.token) }
}

/** 打一个数据端点（带两个分享头）。错误信息里绝不出现 token。 */
async function fetchData({ region, websiteId, token, shareId, endpoint, params, startAt, endAt, fetchImpl, label }) {
  const url = buildDataUrl({ region, websiteId, endpoint, params, startAt, endAt })
  let res
  try {
    res = await fetchImpl(url, {
      headers: { 'x-umami-share-token': token, 'x-umami-share-context': shareId },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new UmamiHttpError(`${label} 请求失败（网络/超时）：${maskSecrets(sliceError(e), token)}`)
  }
  if (!res?.ok) {
    throw new UmamiHttpError(`${label} 返回 HTTP ${res?.status ?? 0}`, { status: Number(res?.status) || 0 })
  }
  try {
    return await res.json()
  } catch {
    throw new UmamiHttpError(`${label} 响应不是合法 JSON`)
  }
}

/**
 * 按顺序拉取分享配置 + 五项数据（统计 / 按天 / 三个 metrics）。
 * stats 与 pageviews 失败即抛出；三个 metrics 各自失败只记 null 并继续。
 * @param {{slug:string, region:string, days?:number, fetchImpl?:Function, now?:Function}} opts
 * @returns {Promise<{share:string, region:string, websiteId:string, days:number, totals:object, byDate:Array, topPaths:Array|null, referrers:Array|null, countries:Array|null}>}
 */
export async function collectUmami({ slug, region, days = DAYS_DEFAULT, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cfg = await fetchShareConfig({ slug, region, fetchImpl })
  const endAt = Number(now())
  const startAt = endAt - days * DAY_MS
  const common = { region, websiteId: cfg.websiteId, token: cfg.token, shareId: cfg.shareId, startAt, endAt, fetchImpl }

  const stats = await fetchData({ ...common, endpoint: 'stats', label: 'stats' })
  const pvRaw = await fetchData({ ...common, endpoint: 'pageviews', label: 'pageviews', params: { unit: 'day' } })

  const metricSpecs = [
    ['path', { type: 'path', limit: 15 }],
    ['referrer', { type: 'referrer', limit: 10 }],
    ['country', { type: 'country', limit: 10 }],
  ]
  const metrics = {}
  for (const [key, params] of metricSpecs) {
    try {
      metrics[key] = await fetchData({ ...common, endpoint: 'metrics', label: `metrics(${params.type})`, params })
    } catch {
      metrics[key] = null
    }
  }

  return {
    share: slug,
    region,
    websiteId: cfg.websiteId,
    days,
    totals: computeTotals(stats),
    byDate: mapByDate(pvRaw),
    topPaths: metrics.path === null ? null : mapMetrics(metrics.path, 'path', 'pageviews'),
    referrers: metrics.referrer === null ? null : mapMetrics(metrics.referrer, 'referrer', 'visits'),
    countries: metrics.country === null ? null : mapMetrics(metrics.country, 'country', 'visits'),
  }
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

/** 紧凑对齐表（无表格库，CJK 按 2 列宽计算）；rows 为 null 表示该指标整体失败。 */
function table(headers, rows, aligns) {
  if (rows == null) return ['（指标获取失败）']
  if (!rows.length) return ['（无数据）']
  const cols = headers.map((h, c) => Math.max(width(h), ...rows.map((r) => width(r[c]))))
  const line = (cells) => '  ' + cells.map((v, c) => (aligns[c] === 'r' ? padStartW(v, cols[c]) : padEndW(v, cols[c]))).join('  ').trimEnd()
  return [line(headers), ...rows.map(line)]
}

const metricRows = (list, map) => (Array.isArray(list) ? list.map(map) : null)

/** 人类可读输出（中文）：一行汇总 + 四张表。 */
export function renderHuman(data) {
  const { days, totals, byDate, topPaths, referrers, countries } = data
  const num = (n) => Number(n || 0).toLocaleString('en-US')
  const bounce = `${(Number(totals?.bounceRate || 0) * 100).toFixed(1)}%`
  const lines = []
  lines.push(`近 ${days} 天：${num(totals?.pageviews)} 浏览 · ${num(totals?.visitors)} 访客 · ${num(totals?.visits)} 会话 · 跳出率 ${bounce} · 平均停留 ${formatDuration(totals?.avgDuration)}`)
  lines.push('')
  lines.push('按天')
  lines.push(...table(['日期', '浏览'], (byDate || []).map((r) => [r.date, num(r.pageviews)]), ['l', 'r']))
  lines.push('')
  lines.push('页面 Top 15')
  lines.push(...table(['路径', '浏览'], metricRows(topPaths, (r) => [truncate(r.path, 48), num(r.pageviews)]), ['l', 'r']))
  lines.push('')
  lines.push('来源 Top 10')
  lines.push(...table(['来源', '会话'], metricRows(referrers, (r) => [truncate(r.referrer || '(未设置)', 48), num(r.visits)]), ['l', 'r']))
  lines.push('')
  lines.push('国家 Top 10')
  lines.push(...table(['国家', '会话'], metricRows(countries, (r) => [truncate(r.country || '(未设置)', 32), num(r.visits)]), ['l', 'r']))
  return lines.join('\n')
}

const HELP_TEXT = `用法：node bin/umami.mjs --share <url|slug> [--days 30] [--json] [--region us|eu]

  --share <url|slug> Umami 公开分享链接或 slug（或环境变量 UMAMI_SHARE）
                     如 https://cloud.umami.is/analytics/us/share/TdcTmlPy8JqLnJHL
  --days <n>         统计窗口，1..365，默认 30
  --region <us|eu>   区域覆盖（默认取链接里的区域，无则 us；或 UMAMI_REGION）
  --json             只输出一个 JSON 对象到 stdout
  -h, --help         显示本帮助

分享链接在 Umami → Settings → Share 生成（公开只读）。本工具只读，不写任何文件。
`

/* ------------------------------- 入口 ------------------------------- */

const httpHint = (status) => {
  if (status === 401 || status === 403) return '分享链接可能已被撤销或停用：请在 Umami → Settings → Share 重新生成或启用公开分享链接。'
  if (status === 404) return '分享 slug 或区域不正确：确认链接里的 <slug> 与 --region（us/eu）。'
  return ''
}

/**
 * CLI 入口（返回 exit code，不调用 process.exit，便于单测直接 await）。
 * @param {string[]} argv 不含 node 与脚本名
 * @param {object} env 环境变量快照（默认 process.env）
 * @param {{out?:Function, err?:Function}} io 输出出口（默认 stdout/stderr）
 * @returns {Promise<number>} 0 成功 · 1 运行期失败 · 2 用法错误
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
    const shareInput = args.share || env.UMAMI_SHARE || ''
    const regionInput = args.region || env.UMAMI_REGION || ''
    const { slug, region } = normalizeShare(shareInput, { region: regionInput })
    const data = await collectUmami({ slug, region, days: args.days, fetchImpl: globalThis.fetch })
    out(args.json ? `${JSON.stringify(data)}\n` : `${renderHuman(data)}\n`)
    return 0
  } catch (e) {
    if (e instanceof UmamiUsageError) {
      errln(`[umami] ${e.message}`)
      return 2
    }
    if (e instanceof UmamiHttpError) {
      errln(`[umami] ${e.message}`)
      const hint = httpHint(e.status)
      if (hint) errln(`[umami] ${hint}`)
      return 1
    }
    errln(`[umami] 未预期失败：${maskSecrets(sliceError(e, 200))}`)
    return 1
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main()
    .then((code) => { process.exitCode = code })
    .catch((e) => {
      console.error(`[umami] 未预期失败：${maskSecrets(sliceError(e, 200))}`)
      process.exitCode = 1
    })
}
