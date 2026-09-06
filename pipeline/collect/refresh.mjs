#!/usr/bin/env node
// Tier 0 元数据刷新（IMPROVEMENTS A1）：discover 全量爬取已经免费带回新鲜 stars/pushed_at/topics/archived
// （写在 candidates-all.jsonl 里），本步骤把它们合并回 plugins.jsonl —— 修复「写一次永不刷新」导致的
// 活跃度/飙升榜口径腐烂（API 成本为零：search 配额与 core 配额独立，discover 本来就要跑）。
//
// 行为：
//   - 按 full_name/id 小写连接；只更新元数据字段，不动 checkedAt/结构信号（那属于 Tier 2 增量重验）
//   - 刷新过的行加 metaRefreshedAt；candidates 里找不到的行保持原样（改名/新入库，等 Tier 2）
//   - 并发守卫：读→写之间 plugins.jsonl 若被 validate 追加（size/mtime 变化）则放弃并 exit 1（勿与 full 并发跑）
//   - 原子写：tmp + rename，中途被杀不会截断源文件
//   - DSH_REFRESH_TARGET=<path> 可重定向目标文件（测试用）
import { readFileSync, writeFileSync, statSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, PATHS, readJsonl, readJson } from '../../lib/data.mjs'

const TARGET = process.env.DSH_REFRESH_TARGET || PATHS.plugins
const CAND = PATHS.candidatesAll
const META_PATH = join(DATA, 'discover-meta.json')
const META_FIELDS = ['stars', 'pushed_at', 'archived', 'fork', 'topics']

function main() {
  if (!existsSync(CAND)) {
    console.warn('[refresh] candidates-all.jsonl 缺失（discover 未跑过？）——跳过刷新，不阻塞管线')
    process.exit(0)
  }
  const meta = readJson(META_PATH, {})
  const cands = readJsonl(CAND).filter((c) => c.kind === 'repo' && c.id)
  const byKey = new Map()
  for (const c of cands) byKey.set(String(c.id).toLowerCase(), c)

  const before = statSync(TARGET)
  const lines = readFileSync(TARGET, 'utf8').split('\n').filter(Boolean)
  let updated = 0, missing = 0
  const out = lines.map((l) => {
    let r
    try { r = JSON.parse(l) } catch { return l }
    const key = String(r.full_name || `${r.owner}/${r.repo}`).toLowerCase()
    const c = byKey.get(key)
    if (!c) { missing++; return l }
    let changed = false
    for (const f of META_FIELDS) {
      if (c[f] !== undefined && JSON.stringify(r[f]) !== JSON.stringify(c[f])) { r[f] = c[f]; changed = true }
    }
    if (changed) { r.metaRefreshedAt = new Date().toISOString(); updated++ }
    return JSON.stringify(r)
  })
  const after = statSync(TARGET)
  if (after.mtimeMs !== before.mtimeMs || after.size !== before.size) {
    console.error('[refresh] plugins.jsonl 运行期间被并发写入（validate 在跑？）——放弃本次写入，稍后重试')
    process.exit(1)
  }
  const tmp = TARGET + '.tmp'
  writeFileSync(tmp, out.join('\n') + '\n')
  renameSync(tmp, TARGET)
  console.log(
    `[refresh] 候选源 @${String(meta.at ?? '?').slice(0, 16)}（${cands.length} repos）→ ` +
    `匹配 ${lines.length - missing}/${lines.length} 行，元数据更新 ${updated}，未匹配 ${missing}（改名/新入库，等 Tier 2 重验）`
  )
}

main()
