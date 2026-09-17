/**
 * tests/replay.test.mjs — D4 实装 smoke 测试（pipeline/verify/replay）的纯逻辑回归。
 *
 * 真正跑浏览器/shell 的部分不进单测（需要 Chromium + dsh，慢且环境相关）；
 * 这里锁的是「从崩溃日志提取根因」与「目标解析」这两段可离线验证的逻辑。
 *
 * 跑法：node --test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractShellError, resolveTargets, mergeHistoryRows } from '../pipeline/verify/replay.mjs'

test('extractShellError: 从 host 侧启动崩溃日志里抽出人话根因', () => {
  const log = [
    'file:///opt/homebrew/lib/node_modules/@deepseek-ai/dsh/lib/index.js:1545',
    '\t\tthrow new Error(`${binName}: ${stage}: ${detail}${stack}`, { cause });',
    '',
    "Error: dsh: plugin tree failed to load: failed to apply loader entry include (cordis:include): failed to import loader entry dsh-at-file (dsh-at-file): The requested module '@deepseek-ai/dsh-settings' does not provide an export named 'settingsNamespace'",
    '    at async boot (file:///…/index.js:1545:9)',
  ].join('\n')
  const got = extractShellError(log)
  assert.match(got, /does not provide an export named 'settingsNamespace'/)
  assert.ok(!got.includes('\n'), '根因必须是单行')
})

test('extractShellError: 空日志 / 无 Error 行时有兜底且不炸', () => {
  assert.equal(extractShellError(''), null)
  assert.equal(extractShellError(null), null)
  assert.equal(extractShellError('some noise\nlast line here'), 'last line here')
})

test('resolveTargets: owner/repo 走权威集取 pkgName + 真实 npm latest', async () => {
  const [t] = await resolveTargets(['ice5kysl/dsh-insights-kit'])
  assert.equal(t.pkg, 'dsh-insights-kit')
  assert.ok(t.version, '需要有 npm latest 版本号')
  assert.equal(t.error, undefined)
})

test('resolveTargets: 显式 pkg@version 透传，作用域包不被拆错', async () => {
  const [a] = await resolveTargets(['some-plugin@1.2.3'])
  assert.deepEqual([a.pkg, a.version], ['some-plugin', '1.2.3'])
  const [b] = await resolveTargets(['@scope/some-plugin@2.0.0'])
  assert.deepEqual([b.pkg, b.version], ['@scope/some-plugin', '2.0.0'])
})

test('resolveTargets: 不在权威集的仓库明确报错，不静默跳过', async () => {
  const [t] = await resolveTargets(['definitely-not/InTheCorpus-xyz'])
  assert.equal(t.error, 'not in authoritative set')
})

test('mergeHistoryRows: 当天重跑覆盖同一行，历史不丢（append-only 语义）', () => {
  const prev = [
    { date: '2026-09-16', shell: '0.1.5-rc.1', repo: 'a/x', verdict: 'broken' },
    { date: '2026-09-17', shell: '0.1.5-rc.1', repo: 'a/x', verdict: 'broken' },
    { date: '2026-09-17', shell: '0.1.5-rc.1', repo: 'b/y', verdict: 'ok' },
  ]
  const fresh = [
    { date: '2026-09-17', shell: '0.1.5-rc.1', repo: 'a/x', verdict: 'ok' }, // a/x 修好了
  ]
  const out = mergeHistoryRows(prev, fresh)
  assert.equal(out.length, 3, '不能产生重复行')
  assert.equal(out.filter((r) => r.repo === 'a/x' && r.date === '2026-09-16').length, 1, '旧日期必须保留')
  assert.equal(out.find((r) => r.repo === 'a/x' && r.date === '2026-09-17').verdict, 'ok', '当天行被覆盖')
  assert.equal(out.find((r) => r.repo === 'b/y').verdict, 'ok', '无关行不受影响')
})

test('mergeHistoryRows: 跨 shell 版本算不同行（矩阵化后不互相覆盖）', () => {
  const prev = [{ date: '2026-09-17', shell: '0.1.5-rc.1', repo: 'a/x', verdict: 'ok' }]
  const fresh = [{ date: '2026-09-17', shell: '0.1.6-alpha.1', repo: 'a/x', verdict: 'broken' }]
  assert.equal(mergeHistoryRows(prev, fresh).length, 2)
})
