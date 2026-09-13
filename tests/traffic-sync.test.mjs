/**
 * tests/traffic-sync.test.mjs — bin/traffic-sync.mjs 单测：SQL 拼装、服务账号读取、
 * 采集映射与失败纪律。全部用打桩 fetch，不碰真网络、不写任何仓库文件、不连 db9。
 *
 * 跑法：node --test tests/traffic-sync.test.mjs（或 npm test 全量）
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { buildUpsert, jsonLit, numLit, readServiceAccount, splitHosts, syncTraffic } from '../bin/traffic-sync.mjs'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const SLUG = 'TdcTmlPy8JqLnJHL'
const WEBSITE_ID = '3f9c2b1a-0d4e-4f6a-9b2c-111122223333'
const CONFIG = { shareId: 'share-1', websiteId: WEBSITE_ID, token: 'jwt-token-value' }

const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) })
const errRes = (status) => ({ ok: false, status, text: async () => 'boom', json: async () => { throw new Error('no json') } })

/** Umami 打桩：按端点分发，记录每次调用。 */
function stubUmami(calls = []) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init })
    const u = String(url)
    if (u.includes('/api/share/')) return jsonRes(CONFIG)
    if (u.includes('/stats')) return jsonRes({ pageviews: 1169, visitors: 351, visits: 452, bounces: 342, totaltime: 63583 })
    if (u.includes('/active')) return jsonRes({ visitors: 6 })
    if (u.includes('/pageviews')) return jsonRes({ pageviews: [{ x: '2026-09-06T00:00:00Z', y: 259 }, { x: '2026-09-07T00:00:00Z', y: 254 }] })
    if (u.includes('type=path')) return jsonRes([{ x: "/o'brien/", y: 164 }])
    if (u.includes('type=hostname')) return jsonRes([{ x: 'dsh-insights.com', y: 351 }, { x: 'dsh-why.com', y: 1 }])
    if (u.includes('type=referrer')) return jsonRes([{ x: 'github.com', y: 23 }])
    if (u.includes('type=country')) return jsonRes([{ x: 'US', y: 173 }])
    if (u.includes('type=')) return jsonRes([{ x: 'sample', y: 3 }]) // 其余维度统一给一条
    return errRes(404)
  }
}

const FIXED_NOW = () => new Date('2026-09-13T04:00:00Z')

test('numLit: null/NaN → NULL，小数取整，字符串数字原样', () => {
  assert.equal(numLit(null), 'NULL')
  assert.equal(numLit(undefined), 'NULL')
  assert.equal(numLit(NaN), 'NULL')
  assert.equal(numLit(1.6), '2')
  assert.equal(numLit('42'), '42')
  assert.equal(numLit(0), '0')
})

test('jsonLit: null → NULL，数组 → jsonb 字面量，单引号双写转义', () => {
  assert.equal(jsonLit(null), 'NULL')
  assert.equal(jsonLit([{ path: "/o'brien/", pageviews: 3 }]), `'[{"path":"/o''brien/","pageviews":3}]'::jsonb`)
})

test('buildUpsert: 17 列齐全、按 (date,source,hostname) 幂等覆盖、每个字段都过字面量转义', () => {
  const sql = buildUpsert({
    date: '2026-09-13', source: 'umami', hostname: 'dsh-insights.com', window_days: 28, visitors: 351, pageviews: 1169,
    sessions: 452, bounces: 342, avg_duration: 141,
    daily: [{ date: '2026-09-06', pageviews: 259 }], top_paths: [{ path: "/x'--", pageviews: 1 }],
    referrers: [], countries: null, hostnames: [{ host: 'dsh-why.com', visitors: 1 }],
    windows: { d7: { visitors: 300 } }, active: 6, breakdowns: { path: { unit: 'pageviews', rows: [] } },
  })
  assert.match(sql, /INSERT INTO site_traffic \(date, source, hostname, window_days, visitors, pageviews, sessions, bounces, avg_duration, daily, top_paths, referrers, countries, hostnames, windows, active, breakdowns\)/)
  assert.match(sql, /ON CONFLICT \(date, source, hostname\) DO UPDATE SET window_days = EXCLUDED.window_days/)
  assert.match(sql, /collected_at = now\(\)/)
  assert.match(sql, /'2026-09-13', 'umami', 'dsh-insights\.com', 28, 351, 1169, 452, 342, 141/)
  assert.match(sql, /"path":"\/x''--"/)
  assert.match(sql, /"host":"dsh-why\.com"/)
  assert.match(sql, /"active":6|, 6,/)
  assert.match(sql, /'null'::jsonb|NULL/)
  // 注入样本不能逃出字面量
  assert.doesNotMatch(sql, /"path":"\/x'--"/)
  // hostname 缺省为空串（合计行）
  const plain = buildUpsert({ date: '2026-09-13', source: 'ga4' })
  assert.match(plain, /'2026-09-13', 'ga4', ''/)
})

test('splitHosts: TRAFFIC_HOSTS 优先；自动发现排除 localhost 自流量', () => {
  assert.deepEqual(splitHosts({}, [{ host: 'dsh-insights.com' }, { host: 'localhost' }, { host: '127.0.0.1' }, { host: '' }]), ['dsh-insights.com'])
  assert.deepEqual(splitHosts({ TRAFFIC_HOSTS: ' a.example.com , b.example.com ' }, [{ host: 'x' }]), ['a.example.com', 'b.example.com'])
  assert.deepEqual(splitHosts({}, null), [])
})

test('readServiceAccount: 既接受 JSON 内容，也接受文件路径', () => {
  const inline = '{"client_email":"a@b.iam.gserviceaccount.com"}'
  assert.equal(readServiceAccount(inline).client_email, 'a@b.iam.gserviceaccount.com')
  assert.throws(() => readServiceAccount(''), /未配置/)
  const dir = mkdtempSync(join(tmpdir(), 'traffic-sa-'))
  try {
    const p = join(dir, 'sa.json')
    writeFileSync(p, inline)
    assert.equal(readServiceAccount(p).client_email, 'a@b.iam.gserviceaccount.com')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('未配置任何来源：不发起请求、不写库、不报错', async () => {
  let calls = 0
  const out = await syncTraffic({ env: {}, fetchImpl: async () => { calls++; return errRes(500) }, now: FIXED_NOW, log: () => {} })
  assert.equal(calls, 0)
  assert.equal(out.written, 0)
  assert.deepEqual(out.rows, [])
})

test('dry-run：采集并映射成行（合计 + 每个 hostname 一行），但不写库（无需 DB9_TOKEN）', async () => {
  const calls = []
  const out = await syncTraffic({
    env: { UMAMI_SHARE: SLUG },
    fetchImpl: stubUmami(calls),
    dryRun: true,
    now: FIXED_NOW,
    log: () => {},
  })
  assert.equal(out.written, 0)
  assert.equal(out.rows.length, 3) // 合计 + dsh-insights.com + dsh-why.com
  const row = out.rows[0].row
  assert.equal(row.date, '2026-09-13')
  assert.equal(row.source, 'umami')
  assert.equal(row.hostname, '')
  assert.equal(row.visitors, 351)
  assert.equal(row.pageviews, 1169)
  assert.equal(row.sessions, 452) // visits
  assert.equal(row.bounces, 342)
  assert.equal(row.avg_duration, 141) // 63583 / 452
  assert.deepEqual(row.daily[0], { date: '2026-09-06', pageviews: 259 })
  assert.deepEqual(row.top_paths[0], { path: "/o'brien/", pageviews: 164 })
  assert.deepEqual(row.referrers[0], { referrer: 'github.com', sessions: 23 })
  assert.deepEqual(row.countries[0], { country: 'US', sessions: 173 })
  assert.deepEqual(row.hostnames[0], { host: 'dsh-insights.com', visitors: 351 })
  assert.equal(row.active, 6)
  assert.equal(row.windows.d1.visitors, 351)
  assert.equal(row.windows.d7.avg_duration, 141)
  assert.equal(row.breakdowns.path.unit, 'pageviews')
  assert.deepEqual(row.breakdowns.path.rows[0], { value: "/o'brien/", count: 164 })
  assert.equal(row.breakdowns.city.unit, 'visitors')
  // 分域名行：hostname 带出，请求带 hostname filter，active 不采（端点不支持 filters）
  const hostRow = out.rows[1].row
  assert.equal(hostRow.hostname, 'dsh-insights.com')
  assert.equal(hostRow.active, null)
  assert.equal(out.rows[2].row.hostname, 'dsh-why.com')
  const hostCalls = calls.filter((c) => c.url.includes('hostname=dsh-insights.com'))
  assert.ok(hostCalls.some((c) => c.url.includes('/stats')), '分域名 stats 应带 hostname filter')
  assert.ok(hostCalls.some((c) => c.url.includes('type=path')), '分域名 metrics 应带 hostname filter')
  assert.ok(!calls.some((c) => c.url.includes('api.db9.ai')), 'dry-run 不得请求 db9')
})

test('写库：先建表再迁移再 upsert，返回写入条数', async () => {
  const sqls = []
  const base = stubUmami()
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes('api.db9.ai')) {
      sqls.push(JSON.parse(init.body).query)
      return jsonRes({ rows: [] })
    }
    return base(url, init)
  }
  const out = await syncTraffic({
    env: { UMAMI_SHARE: SLUG, DB9_TOKEN: 'db9-token' },
    fetchImpl,
    now: FIXED_NOW,
    log: () => {},
  })
  assert.equal(out.written, 3)
  assert.equal(sqls.length, 10) // CREATE TABLE + 5 条补列 migration + ensurePk 探测 + 3 条 INSERT
  assert.match(sqls[0], /CREATE TABLE IF NOT EXISTS site_traffic/)
  assert.match(sqls[0], /PRIMARY KEY \(date, source, hostname\)/)
  assert.match(sqls[1], /ALTER TABLE site_traffic ADD COLUMN IF NOT EXISTS hostnames/)
  assert.match(sqls[5], /ADD COLUMN IF NOT EXISTS hostname/)
  assert.match(sqls[6], /site_traffic_v2/) // ensurePk 探测旧表/迁移残留
  assert.match(sqls[7], /INSERT INTO site_traffic/)
  assert.match(sqls[7], /'2026-09-13', 'umami', '', 28/)
  assert.match(sqls[8], /'2026-09-13', 'umami', 'dsh-insights\.com', 28/)
  assert.match(sqls[9], /'2026-09-13', 'umami', 'dsh-why\.com', 28/)
})

test('失败纪律：采集失败与写库失败都只告警，不抛异常（旁路数据不阻塞管线）', async () => {
  // 采集失败（配置端点 404）
  const collectFail = await syncTraffic({
    env: { UMAMI_SHARE: SLUG, DB9_TOKEN: 'db9-token' },
    fetchImpl: async () => errRes(404),
    now: FIXED_NOW,
    log: () => {},
  })
  assert.equal(collectFail.written, 0)
  assert.equal(collectFail.rows[0].error, true)

  // 写库失败（db9 返回错误体）
  const base = stubUmami()
  const writeFail = await syncTraffic({
    env: { UMAMI_SHARE: SLUG, DB9_TOKEN: 'db9-token' },
    fetchImpl: async (url, init = {}) => (String(url).includes('api.db9.ai')
      ? jsonRes({ message: 'permission denied' })
      : base(url, init)),
    now: FIXED_NOW,
    log: () => {},
  })
  assert.equal(writeFail.written, 0)
})

test('无 DB9_TOKEN：只采集不入库', async () => {
  const calls = []
  const fetchImpl = stubUmami(calls)
  const out = await syncTraffic({ env: { UMAMI_SHARE: SLUG }, fetchImpl, now: FIXED_NOW, log: () => {} })
  assert.equal(out.written, 0)
  assert.equal(out.rows.length, 3)
  assert.ok(!calls.some((c) => c.url.includes('api.db9.ai')), '没有 token 不得请求 db9')
})
