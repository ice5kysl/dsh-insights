/**
 * Shared HTTP/rate-limit helpers for dsh-insights (zero deps).
 *
 * - Reads GITHUB_TOKEN from env (or falls back to GH_TOKEN). Real quotas:
 *     · 个人 PAT / OAuth token: 5000 req/hr
 *     · GitHub Actions 内置 GITHUB_TOKEN: 1000 req/hr/repo
 *     · 无 token: 60 req/hr（validate/discover 会大面积假阴性，启动即警告）
 * - Returns parsed JSON plus the rate-limit envelope so callers can pace.
 * - Waits on 403/429/secondary limits; honours x-ratelimit-remaining.
 *
 * @module lib/api
 */

const GITHUB_API = 'https://api.github.com'
const NPM = 'https://registry.npmjs.org'

/** Last observed core-API remaining budget (live binding for callers). */
export let lastRemaining = -1

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
}

if (!token()) {
  console.error('[api] 未配置 GITHUB_TOKEN/GH_TOKEN —— 匿名配额仅约 60 req/hr，validate/discover 会大面积假阴性/漏采；请配置 token（PAT 5000/hr，Actions 内置 1000/hr/repo）')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function raw(url, { retry = 3 } = {}) {
  const headers = { 'user-agent': 'dsh-insights', accept: 'application/vnd.github+json' }
  if (token()) headers.authorization = `Bearer ${token()}`
  let res
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  } catch (e) {
    if (retry > 0) {
      await sleep(1500 * (4 - retry))
      return raw(url, { retry: retry - 1 })
    }
    throw e
  }
  const text = await res.text()
  let body = text
  try { body = JSON.parse(text) } catch { /* keep raw */ }
  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? NaN)
  const reset = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000
  const retryAfter = Number(res.headers.get('retry-after') ?? 0) * 1000

  if (res.status === 403 || res.status === 429) {
    const secondary = /abuse|secondary/i.test(String(body?.message || ''))
    if (secondary || retryAfter > 0) {
      if (retry > 0) {
        const wait = retryAfter > 0 ? Math.min(retryAfter + 500, 60_000) : 20_000
        console.error(`[api] secondary rate limit; retrying in ${Math.round(wait / 1000)}s`)
        await sleep(wait)
        return raw(url, { retry: retry - 1 })
      }
    } else if (reset && reset > Date.now() && retry > 0) {
      const wait = Math.min(reset - Date.now() + 1000, 90_000)
      console.error(`[api] rate limited; sleeping ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      return raw(url, { retry: retry - 1 })
    }
  }
  const budget = Number.isFinite(remaining) ? remaining : -1
  lastRemaining = budget
  return { ok: res.ok, status: res.status, body, remaining: budget }
}

async function ghApi(path) {
  return raw(`${GITHUB_API}${path}`)
}

/** Paginated GitHub search up to GitHub's 1000-result cap. */
async function ghSearch(query, perPage = 100, max = 1000) {
  const out = []
  for (let page = 1; page * perPage <= max; page++) {
    const r = await raw(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`)
    if (!r.ok) {
      if (r.status === 422 || r.status === 404) break
      console.error(`[search] ${query} page ${page}: HTTP ${r.status} ${r.body?.message || ''}`)
      break
    }
    const items = r.body?.items || []
    out.push(...items)
    if (items.length < perPage || out.length >= max || (r.body?.total_count ?? 0) <= out.length) break
  }
  return out
}

async function ghContents(owner, repo, path, ref) {
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const r = await raw(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(String(path).replace(/^\.\//, ''))}${q}`)
  if (!r.ok) return null
  if (typeof r.body?.content === 'string') return Buffer.from(r.body.content, 'base64').toString('utf8')
  return null
}

/* ------------------------------------------------------------------ *
 * Full-coverage search: GitHub caps search at 1000 results per query.
 * To enumerate an entire topic (dsh-plugin ≈ 13.6k) we recurse over
 * `created:` time windows: any window whose total exceeds the cap is
 * split at the midpoint until every leaf fits under 1000.
 * Verified 2026-09-05: sub-day precision works (`created:A..B` with
 * `YYYY-MM-DDTHH:MM:SS`), 2026-08-15 alone holds 1,581 repos.
 * ------------------------------------------------------------------ */

const MINUTE = 60_000
const SEARCH_PACE_MS = 2100

function isoUtc(ms) {
  return new Date(ms).toISOString().slice(0, 19) // 'YYYY-MM-DDTHH:MM:SS' (UTC)
}

let _lastSearchAt = 0
async function paced() {
  const wait = SEARCH_PACE_MS - (Date.now() - _lastSearchAt)
  if (wait > 0) await sleep(wait)
  _lastSearchAt = Date.now()
}

/** One capped query: returns items + total_count.
 *  Oversized windows (total > 1000) are detected from the first page alone —
 *  fetching their remaining pages would waste the search budget on windows
 *  that will be split anyway. Full pagination happens only for leaf windows. */
async function searchWindow(query) {
  const first = await fetchSearchPage(query, 1, 100)
  if (!first.ok || !Array.isArray(first.body?.items)) return { items: [], total: 0, truncated: false }
  const total = first.body?.total_count ?? 0
  if (total > 1000) return { items: [], total, truncated: true }
  const items = [...first.body.items]
  const pages = Math.min(10, Math.ceil(total / 100))
  for (let page = 2; page <= pages; page++) {
    const r = await fetchSearchPage(query, page, 100)
    if (r.ok && Array.isArray(r.body?.items)) items.push(...r.body.items)
    if (items.length >= total) break
  }
  return { items, total, truncated: false }
}

async function fetchSearchPage(query, page, perPage) {
  await paced()
  return raw(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&sort=created&order=asc`)
}

/**
 * Enumerate every repo matching `baseQuery` (e.g. `topic:dsh-plugin`),
 * splitting oversized created-windows recursively until all fit.
 * Returns array of repo items (search API shape).
 */
async function ghSearchAll(baseQuery, { startMs = Date.UTC(2015, 0, 1), endMs = Date.now() } = {}) {
  const out = []
  const warnings = []
  let leaves = 0
  let fetched = 0
  const probe = await searchWindow(baseQuery)
  const universeTotal = probe.total || 0
  async function crawl(fromMs, toMs, depth = 0) {
    const q = `${baseQuery} created:${isoUtc(fromMs)}..${isoUtc(toMs)}`
    const { items, total, truncated } = await searchWindow(q)
    if (!truncated) {
      leaves++
      fetched += items.length
      if (items.length > 0) console.error(`[ghSearchAll] leaf ${isoUtc(fromMs)}..${isoUtc(toMs)} total=${total} (${leaves} leaves, ${fetched} fetched)`)
      out.push(...items)
      return
    }
    if (toMs - fromMs <= MINUTE || depth > 24) {
      warnings.push(`window ${isoUtc(fromMs)}..${isoUtc(toMs)} total ${total} still over cap at ${toMs - fromMs}ms — truncated`)
      out.push(...items)
      return
    }
    console.error(`[ghSearchAll] split ${isoUtc(fromMs)}..${isoUtc(toMs)} total=${total}`)
    const mid = fromMs + Math.floor((toMs - fromMs) / 2)
    await crawl(fromMs, mid, depth + 1)
    await crawl(mid + 1, toMs, depth + 1) // +1ms：两半窗口无缝衔接，不丢 (mid, mid+1] 内创建的仓库
  }
  await crawl(startMs, endMs)
  return { items: out, warnings, total: universeTotal }
}

async function npmDoc(name) {
  // NB: never encodeURIComponent the whole name after replacing '@' with
  // '%40' — that double-encodes and 404s every scoped package (fixed 2026-09-05).
  const r = await raw(`${NPM}/${String(name).replace(/^@/, '%40')}`)
  if (!r.ok) return null
  const d = r.body
  const latest = d['dist-tags']?.latest
  return {
    published: true,
    latest,
    versions: Object.keys(d.versions || {}).length,
    created: d.time?.created || null,
    latestTime: latest ? d.time?.[latest] || null : null,
    description: d.description || '',
  }
}

export { GITHUB_API, NPM, token, sleep, raw, ghApi, ghSearch, ghContents, npmDoc, ghSearchAll, isoUtc }
