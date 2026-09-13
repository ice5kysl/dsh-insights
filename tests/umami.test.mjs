/**
 * tests/umami.test.mjs — bin/umami.mjs 纯函数 + 端到端（fetch 打桩）单测，不碰真网络、不写仓库文件。
 *
 * 跑法：node --test tests/umami.test.mjs（或 npm test 全量）
 */

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  UmamiUsageError,
  buildDataUrl,
  collectUmami,
  computeTotals,
  formatDuration,
  formatIsoDate,
  main,
  mapByDate,
  mapMetrics,
  maskSecrets,
  normalizeShare,
  parseArgs,
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
const METRICS = {
  path: [{ x: '/', y: 164 }, { x: '/docs', y: 90 }],
  referrer: [{ x: 'google.com', y: 120 }],
  country: [{ x: 'China', y: 200 }],
}

/**
 * 打桩 fetch：分享配置 + 按端点分发的数据请求；记录所有调用（url/init）。
 * 数据端点顺带断言两个分享头确实带上了。
 */
function stubFetch({ onConfig, onStats, onPageviews, onMetric } = {}) {
  const calls = []
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
        if (onStats) {
          const override = onStats(u)
          if (override) return override
        }
        return jsonRes(STATS)
      }
      if (u.includes('/pageviews?')) {
        if (onPageviews) {
          const override = onPageviews(u)
          if (override) return override
        }
        return jsonRes(PV)
      }
      if (u.includes('/metrics?')) {
        const type = new URL(u).searchParams.get('type')
        if (onMetric) {
          const override = onMetric(type, u)
          if (override) return override
        }
        return jsonRes(METRICS[type])
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

test('请求形态：配置 URL 无鉴权头；数据 URL 带 startAt/endAt 与两个分享头', async () => {
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

  // 4) 三个 metrics：type/limit 按口径
  const metrics = calls.slice(3).map((c) => new URL(c.url).searchParams)
  assert.deepEqual(metrics.map((m) => [m.get('type'), m.get('limit')]), [['path', '15'], ['referrer', '10'], ['country', '10']])
  assert.equal(calls.length, 6)

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
  assert.deepEqual(Object.keys(data), ['share', 'region', 'websiteId', 'days', 'totals', 'byDate', 'topPaths', 'referrers', 'countries'])
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
})

test('main（默认文本）: 中文汇总行 + 按天/页面/来源/国家四张表', async () => {
  stubFetch()
  const { out, err, io } = capture()
  const code = await main(['--share', SLUG, '--days', '7'], {}, io)
  assert.equal(code, 0)
  assert.equal(err.join(''), '')
  const text = out.join('')
  assert.match(text, /近 7 天：1,200 浏览 · 300 访客 · 420 会话 · 跳出率 50\.0% · 平均停留 19s/)
  assert.match(text, /按天/)
  assert.match(text, /页面 Top 15/)
  assert.match(text, /来源 Top 10/)
  assert.match(text, /国家 Top 10/)
  assert.match(text, /2026-09-04/)
  assert.match(text, /google\.com/)
  assert.match(text, /China/)
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
  assert.match(human.out.join(''), /页面 Top 15/)
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

test('collectUmami: 顺序请求五项，失败点可注入（now 固定便于断言窗口）', async () => {
  const calls = stubFetch()
  const data = await collectUmami({ slug: SLUG, region: 'eu', days: 2, now: () => 1_800_000_000_000 })
  assert.equal(data.region, 'eu')
  assert.equal(data.byDate.length, 2)
  const urls = calls.map((c) => c.url)
  assert.deepEqual(urls.map((u) => u.replace(/^.*\/api\//, '').split('?')[0]), [
    `share/${SLUG}`,
    `websites/${WEBSITE_ID}/stats`,
    `websites/${WEBSITE_ID}/pageviews`,
    `websites/${WEBSITE_ID}/metrics`,
    `websites/${WEBSITE_ID}/metrics`,
    `websites/${WEBSITE_ID}/metrics`,
  ])
  const q = new URL(urls[1]).searchParams
  assert.equal(q.get('endAt'), '1800000000000')
  assert.equal(q.get('startAt'), String(1_800_000_000_000 - 2 * 86_400_000))
  assert.equal(new URL(urls[1]).pathname.startsWith('/analytics/eu/'), true)
})
