/**
 * tests/db9.test.mjs — lib/db9.mjs 字面量转义/构造逻辑单测（不碰网络）。
 *
 * 跑法：node --test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lit, jsonLit, isEnabled, splitPkgVersion, latestBy, extractDynamicsEvents, letterToRecord, DEFAULT_SQL_URL } from '../lib/db9.mjs'

test('lit: null/undefined → NULL', () => {
  assert.equal(lit(null), 'NULL')
  assert.equal(lit(undefined), 'NULL')
})

test('lit: 数字原生写出，非有限数字 → NULL', () => {
  assert.equal(lit(0), '0')
  assert.equal(lit(43309), '43309')
  assert.equal(lit(-1.5), '-1.5')
  assert.equal(lit(NaN), 'NULL')
  assert.equal(lit(Infinity), 'NULL')
})

test('lit: 布尔原生写出', () => {
  assert.equal(lit(true), 'TRUE')
  assert.equal(lit(false), 'FALSE')
})

test('lit: 字符串单引号包裹 + 单引号双写转义', () => {
  assert.equal(lit('dsh-web'), "'dsh-web'")
  assert.equal(lit("it's a plugin"), "'it''s a plugin'")
  assert.equal(lit("''"), "''''''")
  assert.equal(lit(''), "''")
})

test('lit: 其余类型按字符串处理', () => {
  assert.equal(lit('2026-09-03'), "'2026-09-03'")
})

test('jsonLit: 数组/对象 → JSONB 字面量', () => {
  assert.equal(jsonLit(['a', 'b']), `'["a","b"]'::jsonb`)
  assert.equal(jsonLit({ d: 1 }), `'{"d":1}'::jsonb`)
  assert.equal(jsonLit([]), `'[]'::jsonb`)
})

test('jsonLit: JSON 内的单引号同样双写转义', () => {
  assert.equal(jsonLit({ name: "o'hara" }), `'{"name":"o''hara"}'::jsonb`)
})

test('jsonLit: null/undefined → NULL（不带 ::jsonb）', () => {
  assert.equal(jsonLit(null), 'NULL')
  assert.equal(jsonLit(undefined), 'NULL')
})

test('isEnabled: 由 DB9_TOKEN 环境变量决定', () => {
  const saved = process.env.DB9_TOKEN
  try {
    delete process.env.DB9_TOKEN
    assert.equal(isEnabled(), false)
    process.env.DB9_TOKEN = 'x'
    assert.equal(isEnabled(), true)
  } finally {
    if (saved === undefined) delete process.env.DB9_TOKEN
    else process.env.DB9_TOKEN = saved
  }
})

test('DEFAULT_SQL_URL 指向 db9 SQL-over-HTTP 端点', () => {
  assert.match(DEFAULT_SQL_URL, /^https:\/\/api\.db9\.ai\/customer\/databases\/[^/]+\/sql$/)
})

test('splitPkgVersion: 按最后一个 @ 拆 pkg@version', () => {
  assert.deepEqual(splitPkgVersion('dsh-insights-kit@0.5.0'), ['dsh-insights-kit', '0.5.0'])
  assert.deepEqual(splitPkgVersion('@huanlin/dsh-plugin-sleep@0.1.3'), ['@huanlin/dsh-plugin-sleep', '0.1.3'])
  assert.deepEqual(splitPkgVersion('@scope/name@1.0.0-beta.2'), ['@scope/name', '1.0.0-beta.2'])
})

test('splitPkgVersion: 无版本/异常键不拆错', () => {
  assert.deepEqual(splitPkgVersion('no-version'), ['no-version', ''])
  assert.deepEqual(splitPkgVersion('@scope/name'), ['@scope/name', ''])
})

test('latestBy: 同 key 取时间最新一行', () => {
  const rows = [
    { full_name: 'a/b', taggedAt: '2026-09-01T00:00:00Z', v: 1 },
    { full_name: 'a/b', taggedAt: '2026-09-05T00:00:00Z', v: 2 },
    { full_name: 'c/d', taggedAt: '2026-09-03T00:00:00Z', v: 3 },
  ]
  const out = latestBy(rows, (r) => r.full_name, (r) => r.taggedAt)
  assert.equal(out.length, 2)
  assert.equal(out.find((r) => r.full_name === 'a/b').v, 2)
  assert.equal(out.find((r) => r.full_name === 'c/d').v, 3)
})

test('latestBy: 乱序输入同样取最新；缺 key 行跳过；空输入返回空', () => {
  const rows = [
    { full_name: 'a/b', taggedAt: '2026-09-05T00:00:00Z', v: 2 },
    { full_name: 'a/b', taggedAt: '2026-09-01T00:00:00Z', v: 1 },
    { full_name: '', taggedAt: '2026-09-09T00:00:00Z', v: 9 },
  ]
  const out = latestBy(rows, (r) => r.full_name, (r) => r.taggedAt)
  assert.deepEqual(out.map((r) => r.v), [2])
  assert.deepEqual(latestBy([], (r) => r.k, (r) => r.t), [])
})

test('extractDynamicsEvents: 四类事件各归其位，纯状态快照不抽', () => {
  const dynamics = {
    fetchedAt: '2026-09-11T14:33:33Z',
    dsh: {
      stars: 100,
      releases: [
        { tag: 'dsh-v0.1.5-rc.2', published_at: '2026-09-10T15:09:34Z', breaking: false },
        { tag: 'no-ts-release' }, // 无 published_at → 不抽
      ],
      npm: {
        pkg: '@deepseek-ai/dsh',
        distTags: { latest: '0.1.5-rc.1' },
        versions: [{ version: '0.1.5-rc.2', time: '2026-09-10T14:57:10Z' }],
      },
    },
    platform: [
      { repo: 'deepseek-ai/DeepSeek-V3', stars: 1, latestRelease: { tag: 'v1.0.0', published_at: '2025-06-27T08:46:37Z' } },
      { repo: 'deepseek-ai/3FS' }, // 无 latestRelease → 不抽
    ],
    models: [
      { id: 'deepseek-flash', firstSeen: '2026-09-10', isNew: true },
      { id: 'deepseek-v4-pro', firstSeen: null }, // 无 firstSeen → 不抽
    ],
    compatSignal: { pluginsProbed: 3701 },
  }
  const events = extractDynamicsEvents(dynamics)
  assert.equal(events.length, 4)
  const byType = Object.groupBy(events, (e) => e.type)
  assert.deepEqual(byType.shell_release.map((e) => [e.key, e.occurred_at]), [['dsh-v0.1.5-rc.2', '2026-09-10T15:09:34Z']])
  assert.deepEqual(byType.npm_publish.map((e) => e.key), ['0.1.5-rc.2'])
  assert.equal(byType.npm_publish[0].payload.pkg, '@deepseek-ai/dsh')
  assert.deepEqual(byType.platform_release.map((e) => e.key), ['deepseek-ai/DeepSeek-V3@v1.0.0'])
  assert.equal(byType.platform_release[0].payload.repo, 'deepseek-ai/DeepSeek-V3')
  assert.deepEqual(byType.api_model_first_seen.map((e) => [e.key, e.occurred_at]), [['deepseek-flash', '2026-09-10']])
})

test('extractDynamicsEvents: 空/残缺输入返回空数组', () => {
  assert.deepEqual(extractDynamicsEvents(null), [])
  assert.deepEqual(extractDynamicsEvents({}), [])
  assert.deepEqual(extractDynamicsEvents({ dsh: {} }), [])
})

test('letterToRecord: 抽出固定列，剩余字段进 extra', () => {
  const j = {
    week: '2026-W36',
    range: '2026/08/31～2026/09/06',
    generatedAt: '2026-09-07T12:37:59.610Z',
    model: 'deepseek-v4-pro',
    usage: { prompt_tokens: 9948 },
    title: { zh: 'x' },
    signals: [{ kind: 'dominant-owner' }],
  }
  const r = letterToRecord(j)
  assert.equal(r.week, '2026-W36')
  assert.equal(r.range, '2026/08/31～2026/09/06')
  assert.equal(r.generatedAt, '2026-09-07T12:37:59.610Z')
  assert.equal(r.model, 'deepseek-v4-pro')
  assert.deepEqual(r.usage, { prompt_tokens: 9948 })
  assert.deepEqual(Object.keys(r.extra).sort(), ['signals', 'title'])
})

test('letterToRecord: 无 week / 非对象 → null；缺省字段为 null', () => {
  assert.equal(letterToRecord(null), null)
  assert.equal(letterToRecord({ model: 'x' }), null)
  const r = letterToRecord({ week: '2026-W37' })
  assert.equal(r.range, null)
  assert.equal(r.generatedAt, null)
  assert.deepEqual(r.extra, {})
})
