/**
 * tests/activity.test.mjs — 活跃度口径回归（health-v6，2026-09-17 口径更正）。
 *
 * 背景：metrics.active30/idleDays 曾被 validate 一次性冻结、此后永不重算，
 * 导致「超 30 天无提交」规则对 1,734 个停更仓库从未生效（站点「30 天活跃」
 * 虚报 100%，S+A 高估约一倍）。本测试把「活跃度必须现算」锁死，防止回退。
 *
 * 跑法：node --test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveActivity } from '../lib/data.mjs'
import { scoreOne, RULE_VERSION } from '../pipeline/analyze/score.mjs'

const DAY = 86400000
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()

/** 一个除活跃度外没有其它扣分项的最小行，便于隔离断言。 */
const baseRow = (over = {}) => ({
  full_name: 'acme/demo-plugin',
  owner: 'acme',
  repo: 'demo-plugin',
  description: 'a demo plugin',
  topics: ['dsh-plugin', 'dsh'],
  stars: 5,
  created_at: iso(400 * DAY),
  pushed_at: iso(2 * DAY),
  pkgName: 'demo-plugin',
  version: '1.2.3',
  files: { readme: true, readmeZh: true, license: true, libIndex: true, libClient: true, cordisPatch: true, hasCI: true, hasTests: true, hasDocsDir: true, readmeBytes: 2000 },
  eval: { hasClientExport: true, mainIsLib: true, licenseField: 'MIT', filesWhitelist: ['lib'] },
  npm: { published: true, latest: '1.2.3', versions: 3, latestTime: iso(5 * DAY) },
  metrics: { hasZhDocs: true },
  ...over,
})

const codes = (r) => scoreOne(r).drops.map((d) => d.code)

test('deriveActivity: 从 pushed_at 现算，而不是读冻结值', () => {
  const active = deriveActivity({ pushed_at: iso(5 * DAY), created_at: iso(400 * DAY) })
  assert.equal(active.active30, true)
  assert.ok(active.idleDays >= 4.9 && active.idleDays <= 5.1)

  const dormant = deriveActivity({ pushed_at: iso(45 * DAY), created_at: iso(400 * DAY) })
  assert.equal(dormant.active30, false)
  assert.equal(dormant.ageGate1, true)
})

test('deriveActivity: 缺 pushed_at 时返回 null（活跃度不可知，不得当通过）', () => {
  assert.equal(deriveActivity({ created_at: iso(10 * DAY) }), null)
  assert.equal(deriveActivity({ pushed_at: 'not-a-date' }), null)
})

test('回归：持久化 metrics.active30=true 不能掩盖真实的 30 天停更', () => {
  // 这正是老口径的病灶：idleDays 冻结在很久以前，pushed_at 却已经是 45 天前。
  const row = baseRow({
    pushed_at: iso(45 * DAY),
    metrics: { hasZhDocs: true, idleDays: 1.2, active30: true, ageDays: 20, ageGate1: true },
  })
  const c = codes(row)
  assert.ok(c.includes('activity.dormant'), '超过 30 天无提交必须触发 activity.dormant')
  assert.equal(scoreOne(row).score, 95, '100 − warn(−5)')
})

test('回归：缺 pushed_at 的行记入 missing，而不是静默当作「近期活跃」', () => {
  const row = baseRow({ pushed_at: undefined, metrics: { hasZhDocs: true, active30: true, idleDays: 1 } })
  const health = scoreOne(row)
  assert.ok(!health.drops.some((d) => d.code.startsWith('activity.')), '不可知就不扣分')
  assert.ok(health.missing.includes('metrics'), '必须声明活跃度维度未被评估')
})

test('正向：真正活跃的行不触发 dormant', () => {
  const c = codes(baseRow({ pushed_at: iso(6 * DAY) }))
  assert.ok(!c.includes('activity.dormant'))
  assert.equal(scoreOne(baseRow({ pushed_at: iso(6 * DAY) })).score, 100)
})

test('ruleVersion 已随本次口径更正升版', () => {
  assert.equal(RULE_VERSION, 'health-v6')
})
