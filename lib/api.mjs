/**
 * Shared HTTP/rate-limit helpers for dsh-plugin-insights (zero deps).
 *
 * - Reads GITHUB_TOKEN from env (or falls back to GH_TOKEN) for a 5000/hr budget.
 * - Returns parsed JSON plus the rate-limit envelope so callers can pace.
 * - Waits on 403/429/secondary limits; honours x-ratelimit-remaining.
 *
 * @module lib/api
 */

const GITHUB_API = 'https://api.github.com'
const NPM = 'https://registry.npmjs.org'

function token() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function raw(url, { retry = 3 } = {}) {
  const headers = { 'user-agent': 'dsh-plugin-insights', accept: 'application/vnd.github+json' }
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

  if (res.status === 403 || res.status === 429) {
    if (reset && reset > Date.now() && retry > 0) {
      const wait = Math.min(reset - Date.now() + 1000, 90_000)
      console.error(`[api] rate limited; sleeping ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      return raw(url, { retry: retry - 1 })
    }
    if (body?.message && retry > 0 && /abuse|secondary/i.test(body.message)) {
      await sleep(30_000)
      return raw(url, { retry: retry - 1 })
    }
  }
  return { ok: res.ok, status: res.status, body, remaining: Number.isFinite(remaining) ? remaining : -1 }
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

async function npmDoc(name) {
  const r = await raw(`${NPM}/${encodeURIComponent(String(name).replace(/^@/, '%40'))}`)
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

export { GITHUB_API, NPM, token, sleep, raw, ghApi, ghSearch, ghContents, npmDoc }
