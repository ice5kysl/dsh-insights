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

import { buildUpsert, jsonLit, numLit, readServiceAccount, syncTraffic } from '../bin/traffic-sync.mjs'

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
    if (u.includes('/pageviews')) return jsonRes({ pageviews: [{ x: '2026-09-06T00:00:00Z', y: 259 }, { x: '2026-09-07T00:00:00Z', y: 254 }] })
    if (u.includes('type=path')) return jsonRes([{ x: "/o'brien/", y: 164 }])
    if (u.includes('type=referrer')) return jsonRes([{ x: 'github.com', y: 23 }])
    if (u.includes('type=country')) return jsonRes([{ x: 'US', y: 173 }])
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

test('buildUpsert: 12 列齐全、按 (date,source) 幂等覆盖、每个字段都过字面量转义', () => {
  const sql = buildUpsert({
    date: '2026-09-13', source: 'umami', window_days: 28, visitors: 351, pageviews: 1169,
    sessions: 452, bounces: 342, avg_duration: 141,
    daily: [{ date: '2026-09-06', pageviews: 259 }], top_paths: [{ path: "/x'--", pageviews: 1 }],
    referrers: [], countries: null,
  })
  assert.match(sql, /INSERT INTO site_traffic \(date, source, window_days, visitors, pageviews, sessions, bounces, avg_duration, daily, top_paths, referrers, countries\)/)
  assert.match(sql, /ON CONFLICT \(date, source\) DO UPDATE SET window_days = EXCLUDED.window_days/)
  assert.match(sql, /collected_at = now\(\)/)
  assert.match(sql, /'2026-09-13', 'umami', 28, 351, 1169, 452, 342, 141/)
  assert.match(sql, /"path":"\/x''--"/)
  assert.match(sql, /'null'::jsonb|NULL/)
  // 注入样本不能逃出字面量
  assert.doesNotMatch(sql, /"path":"\/x'--"/)
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

test('dry-run：采集并映射成行，但不写库（无需 DB9_TOKEN）', async () => {
  const calls = []
  const out = await syncTraffic({
    env: { UMAMI_SHARE: SLUG },
    fetchImpl: stubUmami(calls),
    dryRun: true,
    now: FIXED_NOW,
    log: () => {},
  })
  assert.equal(out.written, 0)
  assert.equal(out.rows.length, 1)
  const row = out.rows[0].row
  assert.equal(row.date, '2026-09-13')
  assert.equal(row.source, 'umami')
  assert.equal(row.visitors, 351)
  assert.equal(row.pageviews, 1169)
  assert.equal(row.sessions, 452) // visits
  assert.equal(row.bounces, 342)
  assert.equal(row.avg_duration, 141) // 63583 / 452
  assert.deepEqual(row.daily[0], { date: '2026-09-06', pageviews: 259 })
  assert.deepEqual(row.top_paths[0], { path: "/o'brien/", pageviews: 164 })
  assert.deepEqual(row.referrers[0], { referrer: 'github.com', sessions: 23 })
  assert.deepEqual(row.countries[0], { country: 'US', sessions: 173 })
  assert.ok(!calls.some((c) => c.url.includes('api.db9.ai')), 'dry-run 不得请求 db9')
})

test('写库：先建表再 upsert，返回写入条数', async () => {
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
  assert.equal(out.written, 1)
  assert.equal(sqls.length, 2)
  assert.match(sqls[0], /CREATE TABLE IF NOT EXISTS site_traffic/)
  assert.match(sqls[1], /INSERT INTO site_traffic/)
  assert.match(sqls[1], /'2026-09-13', 'umami'/)
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
  assert.equal(out.rows.length, 1)
  assert.ok(!calls.some((c) => c.url.includes('api.db9.ai')), '没有 token 不得请求 db9')
})
