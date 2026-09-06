#!/usr/bin/env node
/**
 * pipeline/collect · discover-incr — 每日增量发现（全量分片抓取的补充）。
 *
 * 全量 discover 慢（~12min/800 调用），不适合每日；本步骤只查
 * `topic:dsh-plugin created:>=<上次全量抓取日>`（overlap 窗口靠 id 去重兜底），
 * 把新出现的仓库并入 candidates-all.jsonl，供 validate 增量校验。
 *
 * Run: node pipeline/collect/discover-incr.mjs
 */

import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { DATA, PATHS, readJsonl, readJson } from '../../lib/data.mjs'
import { ghSearch } from '../../lib/api.mjs'

async function main() {
  const meta = readJson(join(DATA, 'discover-meta.json'))
  const since = (meta?.topicTotal?.at || new Date(Date.now() - 2 * 86400000).toISOString()).slice(0, 10)
  console.log(`[discover-incr] topic:dsh-plugin created:>=${since} …`)
  // 注意：不能用 ghSearchAll——它内部强制叠加自己的 created 分窗，会把
  // 增量条件顶掉变成全量重扫。日增新仓库远小于 1000，直接 ghSearch 即可。
  const items = await ghSearch(`topic:dsh-plugin created:>=${since}`)
  console.log(`[discover-incr] 窗口命中 ${items.length}`)

  const rows = readJsonl(PATHS.candidatesAll)
  const seen = new Set(rows.map((r) => String(r.id || '').toLowerCase()))
  let added = 0
  for (const it of items) {
    const full = it.full_name
    if (!full || !full.includes('/')) continue
    const id = full.toLowerCase()
    if (seen.has(id)) continue
    seen.add(id)
    rows.push({
      kind: 'repo', id, source: 'topic:dsh-plugin(incr)',
      name: full.split('/')[1], owner: full.split('/')[0],
      stars: it.stargazers_count ?? 0, description: it.description || '',
      topics: it.topics || [], archived: it.archived || false, fork: it.fork || false,
      pushed_at: it.pushed_at || null, created_at: it.created_at || null,
      default_branch: it.default_branch || null, html_url: it.html_url || null,
    })
    added++
  }
  writeFileSync(PATHS.candidatesAll + '.tmp', rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  const { renameSync } = await import('node:fs')
  renameSync(PATHS.candidatesAll + '.tmp', PATHS.candidatesAll)
  writeFileSync(join(DATA, 'discover-meta.json'), JSON.stringify({ at: new Date().toISOString(), topicTotal: meta?.topicTotal ?? null, candidates: rows.length, repoCandidates: rows.filter((r) => r.kind === 'repo').length, lastIncrSince: since, lastIncrAdded: added }, null, 2) + '\n')
  console.log(`[discover-incr] 新候选 +${added} → candidates-all 共 ${rows.length} 行`)
}

main().catch((e) => { console.error(e); process.exit(1) })
