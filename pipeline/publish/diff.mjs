#!/usr/bin/env node
/**
 * pipeline/publish · diff — snapshot diff vs the PREVIOUS snapshot.
 *   - compares data/plugins.jsonl against data/prev-plugin-ids.json,
 *     prints added/removed plugins + star risers → data/last-diff.md
 *   - then rolls the baseline forward (prev = current), so the next run
 *     diffs against THIS snapshot (周报的"本周新增"才是真的本周)。
 *
 * @module dsh-insights/pipeline-publish-diff
 */

import { writeFileSync, existsSync } from 'node:fs'
import { PATHS, readJsonl, readJson } from '../../lib/data.mjs'

function main() {
  const now = readJsonl(PATHS.plugins)
  const cur = new Map(now.map((r) => [r.full_name, r]))
  const prevArr = existsSync(PATHS.prevIds) ? readJson(PATHS.prevIds, []) : null
  const prev = prevArr ? new Map(prevArr.map((x) => [x.id, x])) : null
  const L = []
  if (!prev) {
    L.push(`# 快照 Diff（首次基线）\n\n- 首个基线建立于 ${new Date().toISOString()}：权威插件 ${cur.size} 个。\n- 下一次运行将输出：新增 / 消失 / star 涨幅榜。`)
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
  }
  writeFileSync(PATHS.lastDiff, L.join('\n') + '\n')
  // 基线滚动：本次快照成为下次对比的基准
  writeFileSync(PATHS.prevIds, JSON.stringify([...cur.entries()].map(([id, r]) => ({ id, stars: r.stars || 0 }))))
  console.log(`[diff] ${prev ? 'diff' : 'baseline'}: ${cur.size} plugins → ${PATHS.lastDiff}`)
}

main()
