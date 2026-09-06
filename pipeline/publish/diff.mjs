#!/usr/bin/env node
/**
 * pipeline/publish · diff — snapshot diff vs previous baseline.
 *   - if data/prev-plugin-ids.json exists: prints added/removed plugins,
 *     star risers, and writes data/last-diff.md
 *   - else: establishes the baseline (first snapshot) and notes so.
 *
 * @module dsh-insights/stage-8
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const PREV = join(ROOT, 'data', 'prev-plugin-ids.json')
const OUT = join(ROOT, 'data', 'last-diff.md')

function readIds() {
  return readFileSync(join(ROOT, 'data', 'plugins.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

function main() {
  const now = readIds()
  const cur = new Map(now.map((r) => [r.full_name, r]))
  const prev = existsSync(PREV) ? new Map(JSON.parse(readFileSync(PREV, 'utf8')).map((x) => [x.id, x])) : null
  const L = []
  const meta = { at: new Date().toISOString(), current: cur.size }
  if (!prev) {
    writeFileSync(PREV, JSON.stringify([...cur.entries()].map(([id, r]) => ({ id, stars: r.stars || 0 }))))
    L.push(`# 快照 Diff（首次基线）\n\n- 首个基线建立于 ${new Date().toISOString()}：权威插件 ${cur.size} 个。\n- 下一次运行将输出：新增 / 消失 / star 涨幅榜。`)
    meta.kind = 'baseline'
  } else {
    const added = [...cur.keys()].filter((k) => !prev.has(k))
    const removed = [...prev.keys()].filter((k) => !cur.has(k))
    const risers = [...cur.entries()]
      .filter(([k, r]) => prev.has(k) && (r.stars || 0) > (prev.get(k).stars || 0))
      .map(([k, r]) => ({ id: k, from: prev.get(k).stars || 0, to: r.stars || 0 }))
      .sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 15)
    L.push(`# 快照 Diff · ${new Date().toISOString().slice(0, 10)}`)
    L.push(`\n- 当前权威插件：**${cur.size}**（上次 ${prev.size}）`)
    L.push(`- 新增 ${added.length} · 消失 ${removed.length}`)
    L.push(`\n## 新增（Top ${Math.min(20, added.length)}）`)
    for (const id of added.slice(0, 20)) { const r = cur.get(id); L.push(`- ${id} ★${r.stars || 0} ${r.npm?.published ? '(npm ✓)' : ''}`) }
    L.push(`\n## 消失（Top ${Math.min(20, removed.length)}）`)
    for (const id of removed.slice(0, 20)) L.push(`- ${id}`)
    L.push(`\n## star 涨幅榜`)
    for (const r of risers) L.push(`- ${r.id}：${r.from} → ${r.to}（+${r.to - r.from}）`)
    meta.kind = 'diff'
  }
  writeFileSync(OUT, L.join('\n') + '\n')
  writeFileSync(join(ROOT, 'data', 'snapshot-meta.json'), JSON.stringify(meta, null, 2))
  console.log(`[diff] ${meta.kind}: ${cur.size} plugins → ${OUT}${prev ? '' : '（基线已建立，下次将出 diff）'}`)
}

main()
