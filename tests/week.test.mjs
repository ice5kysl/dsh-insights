/**
 * tests/week.test.mjs — lib/week.mjs 周标签逻辑（周一生成时机改造的核心语义）。
 *
 * 跑法：node --test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isoWeek, weekLabel, isoDow, lastCompleteIsoWeek } from '../lib/week.mjs'

test('isoWeek: 已知日期对齐 ISO 周', () => {
  assert.equal(isoWeek('2026-09-07'), '2026-W37') // 周一
  assert.equal(isoWeek('2026-09-13'), '2026-W37') // 周日（同一周最后一天）
  assert.equal(isoWeek('2026-09-14'), '2026-W38') // 下周一
})

test('weekLabel: ISO 周 → 周一～周日展示串', () => {
  assert.equal(weekLabel('2026-W37'), '2026/09/07～2026/09/13')
  assert.equal(weekLabel('2026-W36'), '2026/08/31～2026/09/06')
})

test('lastCompleteIsoWeek: 周一跑取上一周（周日 24:00 才完结）', () => {
  // 2026-09-14 是周一：刚完结的是 W37（09/07～09/13）
  assert.equal(lastCompleteIsoWeek(new Date('2026-09-14T01:00:00Z')), '2026-W37')
  assert.equal(lastCompleteIsoWeek(new Date('2026-09-14T23:59:00Z')), '2026-W37')
})

test('lastCompleteIsoWeek: 周日当天本周未完结，仍取上一周', () => {
  // 2026-09-13 是周日（W37 的最后一天，24:00 才完结）→ 取 W36
  assert.equal(lastCompleteIsoWeek(new Date('2026-09-13T12:00:00Z')), '2026-W36')
})

test('lastCompleteIsoWeek: 周五跑同样回退到上一完结周（语义变化，不再用本周）', () => {
  assert.equal(lastCompleteIsoWeek(new Date('2026-09-11T12:00:00Z')), '2026-W36')
  // 周二
  assert.equal(lastCompleteIsoWeek(new Date('2026-09-15T12:00:00Z')), '2026-W37')
})

test('isoDow: 周一=1 … 周日=7', () => {
  assert.equal(isoDow(new Date('2026-09-14T00:00:00Z')), 1)
  assert.equal(isoDow(new Date('2026-09-13T00:00:00Z')), 7)
})
