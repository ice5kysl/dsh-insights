/**
 * tests/version.test.mjs — lib/version 的粗粒度版本比较（health-v7 后的周报分流依赖它）。
 *
 * 背景：周报原来只有一节「npm 版本滞后（仓库领先于发布）」，但取数口径是「任意不等」，
 * 实际列出的几乎全是 npm 领先仓库 —— 标题说反了。修法是把两个方向拆开，拆分依据就是这个
 * 比较器，所以它必须准。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cmpVersion } from '../lib/version.mjs'

test('cmpVersion: 基本大小关系', () => {
  assert.ok(cmpVersion('1.2.0', '1.1.9') > 0)
  assert.ok(cmpVersion('1.1.9', '1.2.0') < 0)
  assert.equal(cmpVersion('1.2.3', '1.2.3'), 0)
})

test('cmpVersion: 段数不同时短的补 0', () => {
  assert.equal(cmpVersion('1.2', '1.2.0'), 0)
  assert.ok(cmpVersion('1.2.1', '1.2') > 0)
})

test('cmpVersion: 多位数段按数值比，不是字典序', () => {
  assert.ok(cmpVersion('0.3.9', '0.3.12') < 0, '9 < 12，字典序会判反')
  assert.ok(cmpVersion('1.10.0', '1.9.0') > 0)
})

test('cmpVersion: 周报里的真实案例（都是 npm 领先）', () => {
  assert.ok(cmpVersion('1.52.0', '1.43.0') > 0) // dsh-market
  assert.ok(cmpVersion('3.26.2', '3.25.4') > 0) // modlens
  assert.ok(cmpVersion('0.3.9', '0.2.10') > 0)  // balance-whale-widget
  assert.ok(cmpVersion('0.54.0', '0.42.0') > 0) // dsh-context
})

test('cmpVersion: 仓库领先的场景（该催作者发版）', () => {
  assert.ok(cmpVersion('2.0.0', '1.9.9') > 0)
  assert.ok(cmpVersion('0.1.0', '0.2.0') < 0)
})

test('cmpVersion: 预发布后缀按段参与比较，不抛错（非完整 semver，文档已声明）', () => {
  // 1.2.0-rc.1 会解析成 [1,2,0,1] —— 比 1.2.0（[1,2,0]）"大"
  assert.ok(cmpVersion('1.2.0-rc.1', '1.2.0') > 0)
  assert.ok(cmpVersion('0.1.6-alpha.2', '0.1.6-alpha.1') > 0)
})

test('cmpVersion: 空值/垃圾输入不抛错', () => {
  assert.equal(cmpVersion(null, null), 0)
  assert.equal(cmpVersion(undefined, '1.0.0'), -1)
  assert.equal(cmpVersion('garbage', '0.0.0'), 0)
})
