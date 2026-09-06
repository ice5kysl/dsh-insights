#!/usr/bin/env node
/**
 * bin/compact — 存量数据去重（P0-2/P1-13，幂等）。
 *
 * 按 full_name 小写分组、last-wins（保留时间戳最新一行）重写：
 *   data/plugins.jsonl · data/invalid.jsonl · data/llm.jsonl
 * 并归一 data/state/done.ids · data/state/llm.done（小写 + 去重 + 保序）。
 *
 * 所有写入 = 临时文件 + rename（原子）。重复运行结果一致。
 *
 * Run: node bin/compact.mjs
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { PATHS } from '../lib/data.mjs'

const tsOf = (r) => r.checkedAt || r.taggedAt || ''
const keyOf = (r) => (r.full_name || (r.owner && r.repo ? `${r.owner}/${r.repo}` : '') || '').toLowerCase()

function compactJsonl(path) {
  if (!existsSync(path)) return { kept: 0, dropped: 0 }
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
  const byKey = new Map()
  let unkeyed = 0
  for (const line of lines) {
    let r
    try { r = JSON.parse(line) } catch { unkeyed++; continue }
    const k = keyOf(r)
    if (!k) { byKey.set(`__raw_${unkeyed}_${line.slice(0, 40)}`, line); continue }
    const prev = byKey.get(k)
    if (!prev || tsOf(r) >= tsOf(prev.parsed)) byKey.set(k, { line, parsed: r })
  }
  const kept = [...byKey.values()].map((v) => (typeof v === 'string' ? v : v.line))
  const dropped = lines.length - kept.length
  if (dropped > 0) {
    writeFileSync(path + '.tmp', kept.join('\n') + '\n')
    renameSync(path + '.tmp', path)
  }
  return { kept: kept.length, dropped }
}

function normalizeIds(path) {
  if (!existsSync(path)) return { kept: 0, dropped: 0 }
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
  const seen = new Set()
  const kept = []
  for (const id of lines) {
    const k = id.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    kept.push(k)
  }
  const dropped = lines.length - kept.length
  if (dropped > 0) {
    writeFileSync(path + '.tmp', kept.join('\n') + '\n')
    renameSync(path + '.tmp', path)
  }
  return { kept: kept.length, dropped }
}

for (const [name, fn] of [
  ['plugins.jsonl', () => compactJsonl(PATHS.plugins)],
  ['invalid.jsonl', () => compactJsonl(PATHS.invalid)],
  ['llm.jsonl', () => compactJsonl(PATHS.llm)],
  ['done.ids', () => normalizeIds(PATHS.doneIds)],
  ['llm.done', () => normalizeIds(PATHS.llmDone)],
]) {
  const { kept, dropped } = fn()
  console.log(`[compact] ${name}: kept ${kept} · dropped ${dropped}`)
}
