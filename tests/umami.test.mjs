/**
 * tests/umami.test.mjs — bin/umami.mjs 纯函数 + 端到端（fetch 打桩）单测，不碰真网络、不写仓库文件。
 *
 * 跑法：node --test tests/umami.test.mjs（或 npm test 全量）
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  BREAKDOWN_SPECS,
  UmamiUsageError,
  buildDataUrl,
  collectUmami,
  computeTotals,
  formatDuration,
  formatIsoDate,
  main,
  mapBreakdownRows,
  mapByDate,
  mapMetrics,
  maskSecrets,
  normalizeShare,
  parseArgs,
  renderHuman,
} from '../bin/umami.mjs'

const SLUG = 'TdcTmlPy8JqLnJHL'
const SHARE_ID = 'share-9f8e7d6c5b4a'
const WEBSITE_ID = '3f9c2b1a-0d4e-4f6a-9b2c-111122223333'
// 分享 token 是公开分享页自嵌的 JWT —— 测试里也要求它一个字符都不出现在输出中。
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3ZWJzaXRlSWQiOiJkZW1vIiwiaWF0IjoxNzAwMDAwMDAwfQ.c2lnbmF0dXJlLXNlY3JldA'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/* ------------------------------ fixtures ------------------------------ */

const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) })
const errRes = (status, body = '') => ({
  ok: false,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => { throw new Error('no json') },
})

const CONFIG = { shareId: SHARE_ID, shareType: 'share', parameters: { websiteId: WEBSITE_ID }, websiteId: WEBSITE_ID, token: TOKEN }
const STATS = { pageviews: 1200, visitors: 300, visits: 420, bounces: 210, totaltime: 8100, comparison: { pageviews: 1000 } }
const PV = { pageviews: [{ x: '2026-09-04T00:00:00Z', y: 259 }, { x: '2026-09-05T00:00:00Z', y: 341 }] }
const ACTIVE = { visitors: 6 }
// 18 个 breakdown 维度的默认响应（顺序即 bin/umami.mjs 的 BREAKDOWN_SPECS）。
const METRICS = {
  path: [{ x: '/', y: 164 }, { x: '/docs', y: 90 }],
  entry: [{ x: '/', y: 40 }],
  exit: [{ x: '/docs', y: 12 }],
  referrer: [{ x: 'google.com', y: 120 }],
  country: [{ x: 'China', y: 200 }],
  region: [{ x: 'Beijing', y: 90 }],
  city: [{ x: 'Beijing', y: 80 }],
  browser: [{ x: 'Chrome', y: 150 }],
  os: [{ x: 'macOS', y: 110 }],
  device: [{ x: 'desktop', y: 180 }],
  language: [{ x: 'zh-CN', y: 130 }],
  screen: [{ x: '2560x1440', y: 70 }],
  title: [{ x: '首页', y: 100 }],
  hostname: [{ x: 'dsh-insights.com', y: 290 }, { x: 'dsh-why.com', y: 10 }],
  event: [{ x: 'copy', y: 5 }],
  utmSource: [{ x: 'github', y: 9 }],
  utmMedium: [{ x: 'social', y: 7 }],
  utmCampaign: [{ x: 'launch', y: 3 }],
}

// 近 1 天 / 近 7 天窗口使用各自的 stats 响应（按 endAt - startAt 的天数区分）。
const WINDOW_STATS = { 1: { pageviews: 30, visitors: 12, visits: 15, bounces: 3, totaltime: 300 }, 7: { pageviews: 210, visitors: 80, visits: 100, bounces: 20, totaltime: 2000 } }
/** stats URL 的窗口跨度（天）。 */
const spanDays = (u) => (Number(new URL(u).searchParams.get('endAt')) - Number(new URL(u).searchParams.get('startAt'))) / 86_400_000

/**
 * 打桩 fetch：分享配置 + 按端点分发的数据请求；记录所有调用（url/init）。
 * 数据端点顺带断言两个分享头确实带上了。
 * 第 1 个 stats 请求是主窗口（返回 STATS），其后两个是 d1/d7 窗口（按跨度为 1/7 天返回 WINDOW_STATS）；
 * onStats 收到 (url, 该请求的默认响应, 是否主窗口, 窗口天数)，可据此只覆盖某一个窗口。
 */
function stubFetch({ onConfig, onStats, onPageviews, onActive, onMetric } = {}) {
  const calls = []
  let statsSeen = 0
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    calls.push({ url: u, init })
    if (u.includes('/api/share/')) {
      if (onConfig) {
        const override = onConfig(u, init)
        if (override) return override
      }
      return jsonRes(CONFIG)
    }
    if (u.includes('/api/websites/')) {
      const headers = init.headers || {}
      assert.equal(headers['x-umami-share-token'], TOKEN)
      assert.equal(headers['x-umami-share-context'], SHARE_ID)
      if (u.includes('/stats?')) {
        const isMain = statsSeen === 0
        statsSeen += 1
        const span = spanDays(u)
        const fallback = isMain ? STATS : (WINDOW_STATS[span] || STATS)
        if (onStats) {
          const override = onStats(u, fallback, isMain, span)
          if (override) return override
        }
        return jsonRes(fallback)
      }
      if (u.includes('/pageviews?')) {
        if (onPageviews) {
          const override = onPageviews(u)
          if (override) return override
        }
        return jsonRes(PV)
      }
      if (u.includes('/active?')) {
        if (onActive) {
          const override = onActive(u)
          if (override) return override
        }
        return jsonRes(ACTIVE)
      }
      if (u.includes('/metrics?')) {
        const type = new URL(u).searchParams.get('type')
        if (onMetric) {
          const override = onMetric(type, u)
          if (override) return override
        }
        return jsonRes(METRICS[type] || [])
      }
    }
    throw new Error(`unexpected url ${u}`)
  }
  return calls
}

const capture = () => {
  const out = []
  const err = []
  return { out, err, io: { out: (s) => out.push(s), err: (s) => err.push(s) } }
}

/* --------------------------- normalizeShare --------------------------- */

test('normalizeShare: 完整 URL 取路径里的区域；无区域/slug 默认 us', () => {
  assert.deepEqual(normalizeShare(`https://cloud.umami.is/analytics/us/share/${SLUG}`), { slug: SLUG, region: 'us' })
  assert.deepEqual(normalizeShare(`https://cloud.umami.is/analytics/eu/share/${SLUG}`), { slug: SLUG, region: 'eu' })
  assert.deepEqual(normalizeShare(`https://cloud.umami.is/share/${SLUG}`), { slug: SLUG, region: 'us' })
  assert.deepEqual(normalizeShare(`cloud.umami.is/analytics/us/share/${SLUG}/`), { slug: SLUG, region: 'us' })
  assert.deepEqual(normalizeShare(`https://cloud.umami.is/analytics/us/share/${SLUG}?utm=x#y`), { slug: SLUG, region: 'us' })
  assert.deepEqual(normalizeShare(SLUG), { slug: SLUG, region: 'us' })
  assert.deepEqual(normalizeShare(`  ${SLUG}  `), { slug: SLUG, region: 'us' })
})

test('normalizeShare: 显式 region 覆盖链接里的区域（裸 slug 也一样）', () => {
  assert.deepEqual(normalizeShare(`https://cloud.umami.is/analytics/eu/share/${SLUG}`, { region: 'us' }), { slug: SLUG, region: 'us' })
  assert.deepEqual(normalizeShare(`https://cloud.umami.is/analytics/us/share/${SLUG}`, { region: 'EU' }), { slug: SLUG, region: 'eu' })
  assert.deepEqual(normalizeShare(SLUG, { region: 'eu' }), { slug: SLUG, region: 'eu' })
})

test('normalizeShare: 缺失/空/无 slug/非法区域 → UmamiUsageError（exit 2，指向 Umami Settings → Share）', () => {
  for (const bad of ['', '   ', null, undefined, `https://cloud.umami.is/analytics/us/`, `https://cloud.umami.is/analytics/us/share/`, 'https://cloud.umami.is/analytics/']) {
    assert.throws(
      () => normalizeShare(bad),
      (e) => e instanceof UmamiUsageError && e.exitCode === 2 && /Umami/.test(e.message) && /Share/.test(e.message),
      `应拒绝：${JSON.stringify(bad)}`,
    )
  }
  assert.throws(() => normalizeShare(SLUG, { region: 'jp' }), (e) => e instanceof UmamiUsageError && /区域/.test(e.message))
  assert.throws(() => normalizeShare(`https://cloud.umami.is/analytics/jp/share/${SLUG}`), (e) => e instanceof UmamiUsageError && /区域/.test(e.message))
})

/* ------------------------------- pure --------------------------------- */

test('parseArgs: 默认 30 天，--days 边界 1..365，未知参数/缺值 exit 2', () => {
  assert.deepEqual(parseArgs([]), { share: null, region: null, days: 30, json: false, help: false })
  assert.equal(parseArgs(['--share', SLUG, '--days', '1']).days, 1)
  assert.equal(parseArgs(['--days=365']).days, 365)
  assert.equal(parseArgs(['--share=' + SLUG]).share, SLUG)
  assert.equal(parseArgs(['--region', 'eu']).region, 'eu')
  for (const bad of [['--days', '0'], ['--days', '366'], ['--days', 'x'], ['--share'], ['--region'], ['--nope']]) {
    assert.throws(() => parseArgs(bad), (e) => e instanceof UmamiUsageError && e.exitCode === 2, `应拒绝：${bad.join(' ')}`)
  }
})

test('formatDuration / formatIsoDate / computeTotals / mapMetrics：口径正确', () => {
  assert.equal(formatDuration(0), '0s')
  assert.equal(formatDuration(19.28), '19s')
  assert.equal(formatDuration(59.6), '1m 0s')
  assert.equal(formatDuration(65), '1m 5s')
  assert.equal(formatDuration(Number.NaN), '0s')

  assert.equal(formatIsoDate('2026-09-06T00:00:00Z'), '2026-09-06')
  assert.equal(formatIsoDate('garbage'), 'garbage')

  const totals = computeTotals(STATS)
  assert.equal(totals.bounceRate, 0.5)
  assert.equal(totals.avgDuration, 8100 / 420)
  assert.equal(totals.totaltime, 8100)
  assert.deepEqual(computeTotals({}), {
    pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0, bounceRate: 0, avgDuration: 0,
  })

  assert.deepEqual(mapByDate(PV), [{ date: '2026-09-04', pageviews: 259 }, { date: '2026-09-05', pageviews: 341 }])
  assert.deepEqual(mapMetrics(METRICS.path, 'path', 'pageviews'), [{ path: '/', pageviews: 164 }, { path: '/docs', pageviews: 90 }])
  assert.deepEqual(mapMetrics(METRICS.referrer, 'referrer', 'visits'), [{ referrer: 'google.com', visits: 120 }])
  assert.deepEqual(mapByDate(null), [])
  assert.deepEqual(mapMetrics(undefined, 'country', 'visits'), [])
})

test('buildDataUrl: 端点 + startAt/endAt + 额外参数顺序固定', () => {
  const url = buildDataUrl({ region: 'us', websiteId: WEBSITE_ID, endpoint: 'metrics', params: { type: 'path', limit: 15 }, startAt: 1000, endAt: 2000 })
  assert.equal(url, `https://cloud.umami.is/analytics/us/api/websites/${WEBSITE_ID}/metrics?startAt=1000&endAt=2000&type=path&limit=15`)
})

test('maskSecrets: 抹掉已知 token 与 JWT 形状的串，只留前 6 位', () => {
  const masked = maskSecrets(`token=${TOKEN} other=plain`, TOKEN)
  assert.ok(!masked.includes(TOKEN))
  assert.match(masked, /eyJhbG…/)
  assert.match(masked, /other=plain/)
})

/* ------------------------------ end-to-end ----------------------------- */

test('请求形态：配置 URL 无鉴权头；每个数据 URL 都带 startAt/endAt 与两个分享头', async () => {
  const calls = stubFetch()
  const { out, io } = capture()
  const code = await main(['--share', `https://cloud.umami.is/analytics/us/share/${SLUG}`, '--days', '7', '--json'], {}, io)
  assert.equal(code, 0)
  JSON.parse(out.join(''))

  // 1) 分享配置：公开接口，不带任何鉴权/分享头
  assert.equal(calls[0].url, `https://cloud.umami.is/analytics/us/api/share/${SLUG}`)
  assert.equal(calls[0].init.headers, undefined)
  assert.equal(calls[0].init.headers?.authorization, undefined)

  // 2) stats：URL 形状 + 两个自定义头
  const stats = calls[1]
  assert.match(stats.url, new RegExp(`^https://cloud\\.umami\\.is/analytics/us/api/websites/${WEBSITE_ID}/stats\\?startAt=\\d+&endAt=\\d+$`))
  assert.equal(stats.init.headers['x-umami-share-token'], TOKEN)
  assert.equal(stats.init.headers['x-umami-share-context'], SHARE_ID)
  const q = new URL(stats.url).searchParams
  assert.equal(Number(q.get('endAt')) - Number(q.get('startAt')), 7 * 86_400_000)

  // 3) pageviews?unit=day
  const pv = calls[2]
  assert.match(pv.url, /\/pageviews\?startAt=\d+&endAt=\d+&unit=day$/)

  // 4) 两个额外窗口 stats + active（都带同样的两个分享头）
  assert.deepEqual(calls.slice(3, 6).map((c) => c.url.replace(/^.*\/api\//, '').split('?')[0]), [
    `websites/${WEBSITE_ID}/stats`,
    `websites/${WEBSITE_ID}/stats`,
    `websites/${WEBSITE_ID}/active`,
  ])

  // 5) 18 个 breakdown metrics：type/limit 按口径与顺序
  const metrics = calls.slice(6).map((c) => new URL(c.url).searchParams)
  assert.deepEqual(metrics.map((m) => [m.get('type'), m.get('limit')]), BREAKDOWN_SPECS.map(([t, l]) => [t, String(l)]))
  assert.equal(calls.length, 24)

  // 每个数据请求都携带两个分享头（配置请求除外）
  for (const c of calls.slice(1)) {
    assert.equal(c.init.headers?.['x-umami-share-token'], TOKEN)
    assert.equal(c.init.headers?.['x-umami-share-context'], SHARE_ID)
  }

  // 隐私纪律：token 一个字符都不出现在输出里
  assert.ok(!(out.join('')).includes(TOKEN))
})

test('main --json: 单个 JSON 对象，键序/字段/映射按契约', async () => {
  stubFetch()
  const { out, err, io } = capture()
  const code = await main(['--share', SLUG, '--days', '7', '--json'], {}, io)
  assert.equal(code, 0)
  assert.equal(err.join(''), '')

  const stdout = out.join('')
  assert.equal(stdout.trim().split('\n').length, 1)
  const data = JSON.parse(stdout)
  // 既有键序在前，新字段按契约追加在后（顺序即 JSON 序列化顺序）
  assert.deepEqual(Object.keys(data), ['share', 'region', 'websiteId', 'days', 'totals', 'byDate', 'topPaths', 'referrers', 'countries', 'hostnames', 'windows', 'active', 'breakdowns', 'hostname'])
  assert.equal(data.share, SLUG)
  assert.equal(data.region, 'us')
  assert.equal(data.websiteId, WEBSITE_ID)
  assert.equal(data.days, 7)
  assert.deepEqual(Object.keys(data.totals), ['pageviews', 'visitors', 'visits', 'bounces', 'totaltime', 'bounceRate', 'avgDuration'])
  assert.equal(data.totals.pageviews, 1200)
  assert.equal(data.totals.visitors, 300)
  assert.equal(data.totals.visits, 420)
  assert.equal(data.totals.bounces, 210)
  assert.equal(data.totals.bounceRate, 0.5)
  assert.equal(data.totals.avgDuration, 8100 / 420)

  assert.deepEqual(data.byDate, [{ date: '2026-09-04', pageviews: 259 }, { date: '2026-09-05', pageviews: 341 }])
  assert.deepEqual(data.topPaths, [{ path: '/', pageviews: 164 }, { path: '/docs', pageviews: 90 }])
  assert.deepEqual(data.referrers, [{ referrer: 'google.com', visits: 120 }])
  assert.deepEqual(data.countries, [{ country: 'China', visits: 200 }])
  assert.deepEqual(data.hostnames, [{ hostname: 'dsh-insights.com', visitors: 290 }, { hostname: 'dsh-why.com', visitors: 10 }])

  // windows / active / breakdowns 的键序
  assert.deepEqual(Object.keys(data.windows), ['d1', 'd7'])
  assert.deepEqual(Object.keys(data.windows.d1), ['pageviews', 'visitors', 'visits', 'bounces', 'totaltime', 'bounceRate', 'avgDuration'])
  assert.equal(data.active, 6)
  assert.deepEqual(Object.keys(data.breakdowns), BREAKDOWN_SPECS.map(([t]) => t))
})

test('main（默认文本）: 中文汇总行 + 近 7 天/近 24 小时/实时在线第二行 + 五张表', async () => {
  stubFetch()
  const { out, err, io } = capture()
  const code = await main(['--share', SLUG, '--days', '7'], {}, io)
  assert.equal(code, 0)
  assert.equal(err.join(''), '')
  const text = out.join('')
  assert.match(text, /近 7 天：1,200 浏览 · 300 访客 · 420 会话 · 跳出率 50\.0% · 平均停留 19s/)
  // 第二行：near 7d（d7）· near 24h（d1）· realtime，顺序固定
  assert.match(text, /近 7 天：210 浏览 · 80 访客 · 100 会话 · 近 24 小时：30 浏览 · 12 访客 · 15 会话 · 实时在线：6/)
  assert.match(text, /域名 Top 8/)
  assert.match(text, /dsh-why\.com/)
  assert.match(text, /按天/)
  assert.match(text, /页面 Top 10/)
  assert.match(text, /来源 Top 8/)
  assert.match(text, /国家 Top 8/)
  assert.match(text, /2026-09-04/)
  assert.match(text, /google\.com/)
  assert.match(text, /China/)
})

test('renderHuman 第二行：窗口/实时为 null 时省略；三者全 null 则整行不打印', () => {
  const base = {
    days: 28,
    totals: computeTotals(STATS),
    byDate: [],
    topPaths: null,
    referrers: null,
    countries: null,
    hostnames: null,
  }
  // d1 缺失 → 只显示近 7 天与实时
  const noD1 = renderHuman({ ...base, windows: { d1: null, d7: computeTotals(WINDOW_STATS[7]) }, active: 6 })
  assert.match(noD1.split('\n')[1], /^近 7 天：.* · 实时在线：6$/)
  assert.doesNotMatch(noD1.split('\n')[1], /近 24 小时/)
  // active 缺失 → 省略实时
  const noActive = renderHuman({ ...base, windows: { d1: computeTotals(WINDOW_STATS[1]), d7: computeTotals(WINDOW_STATS[7]) }, active: null })
  assert.match(noActive.split('\n')[1], /^近 7 天：.* · 近 24 小时：.*$/)
  assert.doesNotMatch(noActive.split('\n')[1], /实时在线/)
  // 全 null → 不产生第二行（第 2 行直接是空行，随后是「域名 Top 8」）
  const none = renderHuman({ ...base, windows: { d1: null, d7: null }, active: null })
  assert.equal(none.split('\n')[1], '')
  assert.equal(none.split('\n')[2], '域名 Top 8')
})

/* --------------------------- failure discipline ------------------------- */

test('metrics 单点失败：该字段记 null，其余照常（exit 0）', async () => {
  stubFetch({ onMetric: (type) => (type === 'path' ? errRes(500, 'boom') : null) })
  const { out, err, io } = capture()
  const code = await main(['--share', SLUG, '--days', '3', '--json'], {}, io)
  assert.equal(code, 0)
  assert.equal(err.join(''), '')
  const data = JSON.parse(out.join(''))
  assert.equal(data.topPaths, null)
  assert.deepEqual(data.referrers, [{ referrer: 'google.com', visits: 120 }])
  assert.deepEqual(data.countries, [{ country: 'China', visits: 200 }])

  // 文本模式也照常渲染，失败的表给出中文占位
  const human = capture()
  assert.equal(await main(['--share', SLUG, '--days', '3'], {}, human.io), 0)
  assert.match(human.out.join(''), /（指标获取失败）/)
  assert.match(human.out.join(''), /页面 Top 10/)
})

test('stats / pageviews 失败是致命的：exit 1 + 中文提示，stdout 为空', async () => {
  const cases = [
    [{ onStats: () => errRes(401, 'nope') }, /HTTP 401/, /撤销|停用/],
    [{ onStats: () => errRes(403, 'nope') }, /HTTP 403/, /撤销|停用/],
    [{ onStats: () => errRes(404, 'nope') }, /HTTP 404/, /slug|区域/],
    [{ onPageviews: () => errRes(500, 'nope') }, /pageviews 返回 HTTP 500/, /./],
  ]
  for (const [handlers, statusRe, hintRe] of cases) {
    stubFetch(handlers)
    const { out, err, io } = capture()
    const code = await main(['--share', SLUG], {}, io)
    assert.equal(code, 1)
    assert.equal(out.join(''), '')
    assert.match(err.join(''), statusRe)
    assert.match(err.join(''), hintRe)
  }
})

test('泄露纪律：401/403 与网络异常路径下，完整 token / JWT 绝不出现在错误输出', async () => {
  // 上游响应体里塞满 token（我们根本不回显响应体）
  stubFetch({ onStats: () => errRes(403, JSON.stringify({ error: TOKEN, token: TOKEN })) })
  const http = capture()
  assert.equal(await main(['--share', SLUG], {}, http.io), 1)
  const httpText = http.out.join('') + http.err.join('')
  assert.ok(!httpText.includes(TOKEN))
  assert.doesNotMatch(httpText, /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/)
  assert.match(httpText, /HTTP 403/)

  // 网络异常文案里夹带 token（必须被抹成前 6 位 + …）
  stubFetch({
    onStats: () => {
      throw new Error(`${TOKEN} rejected by upstream`)
    },
  })
  const net = capture()
  assert.equal(await main(['--share', SLUG], {}, net.io), 1)
  const netText = net.out.join('') + net.err.join('')
  assert.ok(!netText.includes(TOKEN))
  assert.doesNotMatch(netText, /c2lnbmF0dXJlLXNlY3JldA/)
  assert.match(netText, /网络\/超时/)

  // 配置端点 401 也不能带出 JWT
  stubFetch({ onConfig: () => errRes(401, TOKEN) })
  const cfg = capture()
  assert.equal(await main(['--share', SLUG], {}, cfg.io), 1)
  assert.ok(!(cfg.out.join('') + cfg.err.join('')).includes(TOKEN))
})

test('分享配置缺 websiteId / token → exit 1 + 中文提示', async () => {
  for (const conf of [
    { shareId: SHARE_ID, websiteId: WEBSITE_ID },
    { shareId: SHARE_ID, token: TOKEN },
    { shareId: SHARE_ID, token: TOKEN, parameters: {} },
  ]) {
    stubFetch({ onConfig: () => jsonRes(conf) })
    const { out, err, io } = capture()
    assert.equal(await main(['--share', SLUG], {}, io), 1)
    assert.equal(out.join(''), '')
    assert.match(err.join(''), /websiteId|token/)
    assert.match(err.join(''), /Settings → Share/)
  }
})

test('main: 缺少 --share exit 2（指向 Umami → Settings → Share）；--days 越界 / 非法区域 exit 2；--help exit 0', async () => {
  const missing = capture()
  assert.equal(await main([], {}, missing.io), 2)
  assert.match(missing.err.join(''), /分享链接/)
  assert.match(missing.err.join(''), /Settings/)
  assert.match(missing.err.join(''), /Share/)

  const emptyEnv = capture()
  assert.equal(await main([], { UMAMI_SHARE: '   ' }, emptyEnv.io), 2)

  for (const bad of [['--share', SLUG, '--days', '0'], ['--share', SLUG, '--days', '999'], ['--share', SLUG, '--region', 'jp'], ['--bogus']]) {
    assert.equal(await main(bad, {}, capture().io), 2, `应 exit 2：${bad.join(' ')}`)
  }

  const help = capture()
  assert.equal(await main(['--help'], {}, help.io), 0)
  assert.match(help.out.join(''), /--share/)
  assert.match(help.out.join(''), /Settings → Share/)
})

test('main: 环境变量回退 UMAMI_SHARE / UMAMI_REGION，且 --region 覆盖链接区域', async () => {
  const calls = stubFetch()
  const { out, io } = capture()
  const code = await main(['--json'], { UMAMI_SHARE: SLUG, UMAMI_REGION: 'eu' }, io)
  assert.equal(code, 0)
  assert.equal(JSON.parse(out.join('')).region, 'eu')
  assert.equal(calls[0].url, `https://cloud.umami.is/analytics/eu/api/share/${SLUG}`)

  const override = stubFetch()
  const { out: out2, io: io2 } = capture()
  assert.equal(await main(['--share', `https://cloud.umami.is/analytics/eu/share/${SLUG}`, '--region', 'us', '--json'], {}, io2), 0)
  assert.equal(JSON.parse(out2.join('')).region, 'us')
  assert.equal(override[0].url, `https://cloud.umami.is/analytics/us/api/share/${SLUG}`)
})

test('collectUmami: 顺序请求 24 项（配置 + 总计 + 按天 + 两窗口 + 实时 + 18 维度），now 固定便于断言窗口', async () => {
  const calls = stubFetch()
  const data = await collectUmami({ slug: SLUG, region: 'eu', days: 2, now: () => 1_800_000_000_000 })
  assert.equal(data.region, 'eu')
  assert.equal(data.byDate.length, 2)
  const urls = calls.map((c) => c.url)
  assert.deepEqual(urls.map((u) => u.replace(/^.*\/api\//, '').split('?')[0]), [
    `share/${SLUG}`,
    `websites/${WEBSITE_ID}/stats`,
    `websites/${WEBSITE_ID}/pageviews`,
    `websites/${WEBSITE_ID}/stats`,
    `websites/${WEBSITE_ID}/stats`,
    `websites/${WEBSITE_ID}/active`,
    ...BREAKDOWN_SPECS.map(() => `websites/${WEBSITE_ID}/metrics`),
  ])
  assert.equal(calls.length, 24)
  const q = new URL(urls[1]).searchParams
  assert.equal(q.get('endAt'), '1800000000000')
  assert.equal(q.get('startAt'), String(1_800_000_000_000 - 2 * 86_400_000))
  assert.equal(new URL(urls[1]).pathname.startsWith('/analytics/eu/'), true)
  assert.equal(data.totals.pageviews, 1200)
  assert.equal(data.active, 6)
})

/* ------------------------- 新增：windows / active / breakdowns ------------------------- */

const END = 1_800_000_000_000

test('windows：d1/d7 各一次额外 stats，startAt 偏移恰为 1 / 7 天且与主窗口同 endAt', async () => {
  const calls = stubFetch()
  const data = await collectUmami({ slug: SLUG, region: 'us', days: 28, now: () => END })

  const statCalls = calls.filter((c) => c.url.includes('/stats?'))
  assert.equal(statCalls.length, 3)
  // 主窗口 28 天；两个额外窗口 1 / 7 天
  assert.deepEqual(statCalls.map((c) => spanDays(c.url)), [28, 1, 7])
  for (const c of statCalls) assert.equal(new URL(c.url).searchParams.get('endAt'), String(END))
  for (const c of statCalls) assert.equal(new URL(c.url).searchParams.get('startAt'), String(END - spanDays(c.url) * 86_400_000))

  // 字段名/口径与 computeTotals 完全一致
  assert.deepEqual(Object.keys(data.windows.d1), Object.keys(data.totals))
  assert.deepEqual(data.windows.d1, computeTotals(WINDOW_STATS[1]))
  assert.deepEqual(data.windows.d7, computeTotals(WINDOW_STATS[7]))
  assert.equal(data.windows.d1.avgDuration, 300 / 15)
  assert.equal(data.windows.d7.bounceRate, 20 / 100)
})

test('windows：单个窗口 stats 失败 → 该窗口 null，其余照常（exit 0）', async () => {
  stubFetch({ onStats: (u) => (spanDays(u) === 1 ? errRes(500, 'boom') : null) })
  const { out, err, io } = capture()
  assert.equal(await main(['--share', SLUG, '--days', '28', '--json'], {}, io), 0)
  assert.equal(err.join(''), '')
  const data = JSON.parse(out.join(''))
  assert.equal(data.windows.d1, null)
  assert.deepEqual(data.windows.d7, computeTotals(WINDOW_STATS[7]))
  assert.equal(data.totals.pageviews, 1200)
})

test('breakdowns：unit 按维度、rows 保持 API 顺序且 {x,y} → {value,count}', async () => {
  stubFetch()
  const data = await collectUmami({ slug: SLUG, region: 'us', days: 7, now: () => END })

  assert.equal(data.breakdowns.path.unit, 'pageviews')
  assert.equal(data.breakdowns.country.unit, 'visitors')
  assert.equal(data.breakdowns.referrer.unit, 'visits')
  assert.equal(data.breakdowns.title.unit, 'pageviews')
  assert.equal(data.breakdowns.utmSource.unit, 'visits')

  assert.deepEqual(data.breakdowns.path.rows, [{ value: '/', count: 164 }, { value: '/docs', count: 90 }])
  assert.deepEqual(data.breakdowns.hostname.rows[0], { value: 'dsh-insights.com', count: 290 })
  assert.equal(data.breakdowns.hostname.rows.length, 2) // 不排序、不截断（limit 只作用于服务端）
  // 每个维度都是 {unit, rows}，且 unit 与 BREAKDOWN_SPECS 一致
  for (const [type, , unit] of BREAKDOWN_SPECS) {
    assert.equal(data.breakdowns[type].unit, unit, `unit 不符：${type}`)
    assert.ok(Array.isArray(data.breakdowns[type].rows), `rows 应为数组：${type}`)
  }
  // 旧字段由 breakdowns 投影，键名保持原样
  assert.deepEqual(data.topPaths, [{ path: '/', pageviews: 164 }, { path: '/docs', pageviews: 90 }])
  assert.deepEqual(data.countries, [{ country: 'China', visits: 200 }])
  assert.deepEqual(data.hostnames, [{ hostname: 'dsh-insights.com', visitors: 290 }, { hostname: 'dsh-why.com', visitors: 10 }])

  // 直接单测行映射：跳过空/非字符串 x，忽略 region/city 行上的 country
  assert.deepEqual(mapBreakdownRows([{ x: 'a', y: 1 }, { x: '', y: 2 }, { x: 3, y: 4 }, { x: 'b', y: '5', country: 'CN' }, null]), [
    { value: 'a', count: 1 },
    { value: 'b', count: 5 },
  ])
})

test('breakdowns：单个维度失败（city → 500）记 null，其余照常（exit 0）', async () => {
  stubFetch({ onMetric: (type) => (type === 'city' ? errRes(500, 'boom') : null) })
  const { out, err, io } = capture()
  assert.equal(await main(['--share', SLUG, '--json'], {}, io), 0)
  assert.equal(err.join(''), '')
  const data = JSON.parse(out.join(''))
  assert.equal(data.breakdowns.city, null)
  assert.deepEqual(data.breakdowns.region, { unit: 'visitors', rows: [{ value: 'Beijing', count: 90 }] })
  assert.deepEqual(data.breakdowns.path, { unit: 'pageviews', rows: [{ value: '/', count: 164 }, { value: '/docs', count: 90 }] })
  assert.equal(data.totals.pageviews, 1200)
  assert.equal(data.active, 6)
})

test('active：响应为 {} → active 为 null，其余照常（exit 0）；失败同样 null', async () => {
  stubFetch({ onActive: () => jsonRes({}) })
  const { out, err, io } = capture()
  assert.equal(await main(['--share', SLUG, '--json'], {}, io), 0)
  assert.equal(err.join(''), '')
  assert.equal(JSON.parse(out.join('')).active, null)

  stubFetch({ onActive: () => errRes(500, 'boom') })
  const { out: out2, io: io2 } = capture()
  assert.equal(await main(['--share', SLUG, '--json'], {}, io2), 0)
  assert.equal(JSON.parse(out2.join('')).active, null)
})

test('--json 键序：既有 10 键在前，windows/active/breakdowns 追加在后', async () => {
  stubFetch()
  const { out, io } = capture()
  assert.equal(await main(['--share', SLUG, '--days', '7', '--json'], {}, io), 0)
  const stdout = out.join('')
  assert.deepEqual(Object.keys(JSON.parse(stdout)), [
    'share', 'region', 'websiteId', 'days', 'totals', 'byDate', 'topPaths', 'referrers', 'countries', 'hostnames',
    'windows', 'active', 'breakdowns', 'hostname',
  ])
  // JSON 文本里的出现顺序也必须一致（序列化顺序）
  const order = ['"share"', '"region"', '"websiteId"', '"days"', '"totals"', '"byDate"', '"topPaths"', '"referrers"', '"countries"', '"hostnames"', '"windows"', '"active"', '"breakdowns"', '"hostname"']
  let cursor = -1
  for (const key of order) {
    const at = stdout.indexOf(key, cursor + 1)
    assert.ok(at > cursor, `键序不对：${key}`)
    cursor = at
  }
})
