/**
 * tests/ga4.test.mjs — bin/ga4.mjs 纯函数 + 端到端（fetch 打桩）单测，不碰真网络、不写仓库文件。
 *
 * 跑法：node --test tests/ga4.test.mjs（或 npm test 全量）
 */

import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { Ga4UsageError, buildJwt, main, normalizeProperty } from '../bin/ga4.mjs'

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const AUD = 'https://oauth2.googleapis.com/token'
const TOKEN = 'ya29.fake-access-token-do-not-leak'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/* ------------------------------ fixtures ------------------------------ */

/** 用一次性 2048 位 RSA 私钥写一份临时服务账号 JSON（只落在 os.tmpdir）。 */
function saFixture(privateKeyPem) {
  const dir = mkdtempSync(join(tmpdir(), 'ga4-test-'))
  const path = join(dir, 'sa.json')
  writeFileSync(path, JSON.stringify({
    type: 'service_account',
    project_id: 'demo-project',
    private_key_id: 'kid',
    private_key: privateKeyPem,
    client_email: 'svc@demo-project.iam.gserviceaccount.com',
    token_uri: 'https://oauth2.googleapis.com/token',
  }))
  return { dir, path }
}

const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) })
const errRes = (status, error) => ({ ok: false, status, text: async () => JSON.stringify(error) })

/** runReport 响应构造器。 */
const report = (dims, mets, rows) => ({
  dimensionHeaders: dims.map((name) => ({ name })),
  metricHeaders: mets.map((name) => ({ name })),
  rows: rows.map(([d, m]) => ({
    dimensionValues: (Array.isArray(d) ? d : [d]).map((value) => ({ value: String(value) })),
    metricValues: m.map((value) => ({ value: String(value) })),
  })),
})

const BY_DATE = report(['date'], ['activeUsers', 'screenPageViews', 'sessions'], [
  ['20260901', [10, 30, 5]],
  ['20260902', [20, 60, 7]],
  ['20260903', [15, 45, 4]],
])
const TOP_PAGES = report(['pagePath'], ['screenPageViews', 'activeUsers'], [
  ['/', [100, 40]],
  ['/docs/', [70, 25]],
])
const CHANNELS = report(['sessionDefaultChannelGroup'], ['sessions'], [
  ['Organic Search', [12]],
  ['Direct', [4]],
])

/** 打桩 fetch：token 端点 + 按 dimensions[0].name 分发的三份报告；记录所有调用。 */
function stubFetch({ onReport } = {}) {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    calls.push({ url: u, init })
    if (u.includes('oauth2.googleapis.com/token')) {
      assert.match(String(init.body), /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/)
      return jsonRes({ access_token: TOKEN, expires_in: 3600, token_type: 'Bearer' })
    }
    assert.match(u, /\/v1beta\/properties\/123456789:runReport$/)
    assert.equal(init.headers.authorization, `Bearer ${TOKEN}`)
    const body = JSON.parse(init.body)
    if (onReport) {
      const override = onReport(body)
      if (override) return override
    }
    const dim = body.dimensions[0].name
    if (dim === 'date') return jsonRes(BY_DATE)
    if (dim === 'pagePath') return jsonRes(TOP_PAGES)
    if (dim === 'sessionDefaultChannelGroup') return jsonRes(CHANNELS)
    throw new Error(`unexpected dimension ${dim}`)
  }
  return calls
}

const capture = () => {
  const out = []
  const err = []
  return { out, err, io: { out: (s) => out.push(s), err: (s) => err.push(s) } }
}

/* -------------------------- normalizeProperty -------------------------- */

test('normalizeProperty: 接受纯数字与 properties/ 前缀', () => {
  assert.equal(normalizeProperty('123456789'), '123456789')
  assert.equal(normalizeProperty('properties/123456789'), '123456789')
  assert.equal(normalizeProperty(123456789), '123456789')
  assert.equal(normalizeProperty('  properties/42 '), '42')
})

test('normalizeProperty: 衡量 ID / 空 / 非数字一律拒绝（exit 2，中文提示指向资源设置）', () => {
  for (const bad of ['G-ABC123', 'g-abc123', '', '   ', 'properties/', 'properties/abc', 'abc', '12a', '123-456']) {
    assert.throws(
      () => normalizeProperty(bad),
      (e) => e instanceof Ga4UsageError && e.exitCode === 2 && /资源 ID/.test(e.message),
      `应拒绝：${JSON.stringify(bad)}`,
    )
  }
  // G- 前缀要专门点明「衡量 ID ≠ 数字资源 ID」
  assert.throws(() => normalizeProperty('G-ABC123'), /衡量 ID/)
})

/* ------------------------------- buildJwt ------------------------------ */

test('buildJwt: 三段 base64url，header/claims 正确，签名可用公钥验证', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const claims = { iss: 'svc@demo.iam.gserviceaccount.com', scope: SCOPE, aud: AUD, iat: 1_700_000_000, exp: 1_700_003_600 }

  const jwt = buildJwt(claims, pem)
  const parts = jwt.split('.')
  assert.equal(parts.length, 3)
  for (const p of parts) assert.match(p, /^[A-Za-z0-9_-]+$/)

  assert.deepEqual(JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')), { alg: 'RS256', typ: 'JWT' })
  const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  assert.equal(decoded.iss, claims.iss)
  assert.equal(decoded.scope, SCOPE)
  assert.equal(decoded.aud, AUD)
  assert.equal(decoded.iat, claims.iat)
  assert.equal(decoded.exp, claims.exp)

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`)
  assert.equal(verify('RSA-SHA256', signingInput, publicKey, Buffer.from(parts[2], 'base64url')), true)

  // 换一份 claims → 旧签名必须验不过（确认签名确实覆盖了 claims）
  const other = buildJwt({ ...claims, iss: 'evil@x' }, pem).split('.')
  assert.equal(verify('RSA-SHA256', signingInput, publicKey, Buffer.from(other[2], 'base64url')), false)
})

test('buildJwt: 缺私钥或非 PEM → 抛错，绝不产出半成品 JWT', () => {
  assert.throws(() => buildJwt({ iss: 'x' }, ''))
  assert.throws(() => buildJwt({ iss: 'x' }, 'not-a-pem'))
})

/* ------------------------------ end-to-end ----------------------------- */

test('main --json: 换 token + 三份报告，输出单个 JSON 对象（totals 为逐日求和）', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const { dir, path } = saFixture(privateKey.export({ type: 'pkcs8', format: 'pem' }))
  const calls = stubFetch()
  const { out, err, io } = capture()
  try {
    const code = await main(['--sa', path, '--property', 'properties/123456789', '--days', '3', '--json'], {}, io)
    assert.equal(code, 0)
    assert.equal(err.join(''), '')

    // --json：stdout 只有一个 JSON 对象，没有别的行
    const stdout = out.join('')
    assert.equal(stdout.trim().split('\n').length, 1)
    const data = JSON.parse(stdout)
    assert.deepEqual(Object.keys(data), ['property', 'days', 'totals', 'byDate', 'topPages', 'channels'])
    assert.equal(data.property, '123456789')
    assert.equal(data.days, 3)
    assert.deepEqual(data.totals, { activeUsers: 45, screenPageViews: 135, sessions: 16 })
    assert.equal(data.byDate.length, 3)
    assert.deepEqual(data.byDate[0], { date: '2026-09-01', activeUsers: 10, screenPageViews: 30, sessions: 5 })
    assert.ok(data.topPages.length > 0 && data.topPages[0].pagePath === '/')
    assert.ok(data.channels.length > 0 && data.channels[0].channel === 'Organic Search')

    // 恰好三份 runReport（+ 一次 token），窗口与 limit 按口径
    const reports = calls.filter((c) => c.url.includes(':runReport')).map((c) => JSON.parse(c.init.body))
    assert.equal(reports.length, 3)
    for (const r of reports) assert.deepEqual(r.dateRanges, [{ startDate: '3daysAgo', endDate: 'today' }])
    assert.equal(reports.find((r) => r.dimensions[0].name === 'pagePath').limit, 15)
    assert.equal(reports.find((r) => r.dimensions[0].name === 'sessionDefaultChannelGroup').limit, 10)
    assert.deepEqual(
      reports.find((r) => r.dimensions[0].name === 'date').metrics.map((m) => m.name),
      ['activeUsers', 'screenPageViews', 'sessions'],
    )

    // 隐私纪律：私钥 / JWT / access_token 一个都不出现在输出里
    const printed = stdout + err.join('')
    assert.doesNotMatch(printed, /BEGIN [A-Z ]*PRIVATE KEY/)
    assert.ok(!printed.includes(TOKEN))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('main（默认文本）: 中文汇总行 + 按天/页面/渠道三张表', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const { dir, path } = saFixture(privateKey.export({ type: 'pkcs8', format: 'pem' }))
  stubFetch()
  const { out, err, io } = capture()
  try {
    const code = await main(['--sa', path, '--property', '123456789', '--days', '3'], {}, io)
    assert.equal(code, 0)
    const text = out.join('')
    assert.match(text, /近 3 天：45 活跃用户 · 135 浏览量 · 16 会话 · 日均 45\.0 浏览/)
    assert.match(text, /按天/)
    assert.match(text, /页面 Top 15/)
    assert.match(text, /渠道 Top 10/)
    assert.match(text, /2026-09-01/)
    assert.match(text, /Organic Search/)
    assert.equal(err.join(''), '')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* --------------------------- failure discipline ------------------------- */

test('main: 参数/密钥问题 exit 2，且错误里不含密钥内容', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const { dir, path } = saFixture(pem)
  try {
    const missingProperty = capture()
    assert.equal(await main(['--sa', path], {}, missingProperty.io), 2)
    assert.match(missingProperty.err.join(''), /资源 ID/)

    const badProperty = capture()
    assert.equal(await main(['--sa', path, '--property', 'G-ABC123'], {}, badProperty.io), 2)
    assert.match(badProperty.err.join(''), /衡量 ID/)

    const badDays = capture()
    assert.equal(await main(['--sa', path, '--property', '1', '--days', '0'], {}, badDays.io), 2)
    assert.equal(await main(['--sa', path, '--property', '1', '--days', '999'], {}, capture().io), 2)

    const noSuchFile = capture()
    assert.equal(await main(['--sa', join(dir, 'nope.json'), '--property', '1'], {}, noSuchFile.io), 2)

    // 非 JSON / 缺字段的密钥文件同样 exit 2，且绝不回显文件内容
    const junk = join(dir, 'junk.json')
    writeFileSync(junk, 'PRIVATE-KEY-CONTENT-NOT-JSON')
    const badJson = capture()
    assert.equal(await main(['--sa', junk, '--property', '1'], {}, badJson.io), 2)
    assert.doesNotMatch(badJson.err.join(''), /PRIVATE-KEY-CONTENT-NOT-JSON/)

    const skeleton = join(dir, 'skeleton.json')
    writeFileSync(skeleton, JSON.stringify({ type: 'service_account' }))
    assert.equal(await main(['--sa', skeleton, '--property', '1'], {}, capture().io), 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('main: HTTP 401/403 exit 1 + 中文排查提示，token 不泄露', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const { dir, path } = saFixture(privateKey.export({ type: 'pkcs8', format: 'pem' }))
  try {
    for (const [status, hint] of [[401, /过期|撤销/], [403, /查看者/]]) {
      stubFetch({ onReport: () => errRes(status, { error: { status: 'X', message: 'denied' } }) })
      const { out, err, io } = capture()
      const code = await main(['--sa', path, '--property', '123456789'], {}, io)
      assert.equal(code, 1)
      assert.equal(out.join(''), '')
      assert.match(err.join(''), new RegExp(`HTTP ${status}`))
      assert.match(err.join(''), hint)
      assert.ok(!(err.join('') + out.join('')).includes(TOKEN))
      assert.doesNotMatch(err.join(''), /BEGIN [A-Z ]*PRIVATE KEY/)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('main: 环境变量回退 GA4_SA_JSON / GA4_PROPERTY；--help 退出 0', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const { dir, path } = saFixture(privateKey.export({ type: 'pkcs8', format: 'pem' }))
  stubFetch()
  try {
    const { out, io } = capture()
    const code = await main(['--json'], { GA4_SA_JSON: path, GA4_PROPERTY: 'properties/123456789' }, io)
    assert.equal(code, 0)
    assert.equal(JSON.parse(out.join('')).property, '123456789')

    const help = capture()
    assert.equal(await main(['--help'], {}, help.io), 0)
    assert.match(help.out.join(''), /--property/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
