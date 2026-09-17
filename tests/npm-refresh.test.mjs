/**
 * tests/npm-refresh.test.mjs — npm 数据新鲜度修复（health-v7）的纯逻辑回归。
 *
 * 背景：`r.npm` 曾被 validate 算完即永久冻结，抽样约 25% 版本号过期（与 health-v6
 * 修的活跃度同类）。这里锁死 applyNpmProbe 的判定表，防止把「没变化」写成变化
 * （会让整个 plugins.jsonl 每天重写一遍）或把「瞬时失败」写成下架（会清掉正确数据）。
 *
 * 跑法：node --test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyNpmProbe, pool } from '../pipeline/collect/npm-refresh.mjs'

const ok = (latest) => ({ state: 'ok', latest })
const doc = (latest, versions = 3, latestTime = '2026-09-16T00:00:00.000Z') => ({ published: true, latest, versions, latestTime })

test('applyNpmProbe: latest 未变 → none，且绝不改动记录（避免每天全文件重写）', () => {
  const row = { npm: { published: true, latest: '1.0.0', versions: 2, latestTime: 'x' } }
  const before = JSON.stringify(row)
  assert.equal(applyNpmProbe(row, ok('1.0.0'), null), 'none')
  assert.equal(JSON.stringify(row), before, '无变化时必须原地不动')
})

test('applyNpmProbe: latest 变了 → 用完整 packument 补齐 versions/latestTime', () => {
  const row = { npm: { published: true, latest: '1.0.0', versions: 2, latestTime: 'old' } }
  assert.equal(applyNpmProbe(row, ok('1.2.0'), doc('1.2.0', 5, 'new')), 'changed')
  assert.deepEqual(row.npm, { published: true, latest: '1.2.0', versions: 5, latestTime: 'new' })
})

test('applyNpmProbe: 首次发布（未发布 → 已发布）单独计数并翻正 published', () => {
  const row = { npm: { published: false } }
  assert.equal(applyNpmProbe(row, ok('0.1.0'), doc('0.1.0', 1)), 'first')
  assert.equal(row.npm.published, true)
  assert.equal(row.npm.latest, '0.1.0')
})

test('applyNpmProbe: 瞬时失败绝不清空已有数据（只计数）', () => {
  const row = { npm: { published: true, latest: '1.0.0', versions: 2, latestTime: 'x' } }
  const before = JSON.stringify(row)
  assert.equal(applyNpmProbe(row, { state: 'transient', status: 503 }, null), 'transient')
  assert.equal(JSON.stringify(row), before, '瞬时失败必须原地保留')
})

test('applyNpmProbe: registry 上没有该包 → 记为下架', () => {
  const row = { npm: { published: true, latest: '1.0.0' } }
  assert.equal(applyNpmProbe(row, { state: 'missing', status: 401 }, null), 'removed')
  assert.equal(row.npm.published, false)
})

test('applyNpmProbe: 改版但完整文档没拿到 → 保守当作瞬时失败，不写半个 npm 对象', () => {
  const row = { npm: { published: true, latest: '1.0.0', versions: 2, latestTime: 'x' } }
  const before = JSON.stringify(row)
  assert.equal(applyNpmProbe(row, ok('2.0.0'), null), 'transient')
  assert.equal(JSON.stringify(row), before)
})

test('pool: 全量执行、保序、并发不超上限', async () => {
  const items = Array.from({ length: 25 }, (_, i) => i)
  let live = 0
  let peak = 0
  const out = await pool(items, 4, async (n) => {
    live++; peak = Math.max(peak, live)
    await new Promise((r) => setTimeout(r, 2))
    live--
    return n * 2
  })
  assert.deepEqual(out, items.map((n) => n * 2), '结果必须与输入同序')
  assert.ok(peak <= 4, `并发不得超过上限，实测 ${peak}`)
  assert.ok(peak > 1, '应当真的并发')
})
