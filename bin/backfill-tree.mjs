#!/usr/bin/env node
/**
 * bin/backfill-tree — 树探测信号回填（health-v3 成熟度维度）。
 *
 * validate 的树探测扩展了 hasTests / hasCI / hasDocsDir / readmeBytes，
 * 但存量 plugins.jsonl 行没有这些字段。本脚本逐行重拉 git tree（约 1 次
 * API 调用/插件），原子重写 plugins.jsonl（行序/id 不变，done.ids 不受影响）。
 *
 * 断点续跑：已带 hasTests 字段的行跳过（幂等）。
 *
 * Run: GITHUB_TOKEN=... node bin/backfill-tree.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { PATHS } from '../lib/data.mjs'
import { ghApi } from '../lib/api.mjs'

async function treeSignals(owner, repo, branch) {
  for (const b of [branch, 'main', 'master'].filter(Boolean)) {
    const r = await ghApi(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(b)}?recursive=1`)
    if (!r.ok) continue
    const set = new Set()
    const sizeOf = new Map()
    for (const t of r.body?.tree || []) {
      if (!t.path) continue
      set.add(t.path)
      if (typeof t.size === 'number') sizeOf.set(t.path, t.size)
    }
    const has = (re) => [...set].some((p) => re.test(p))
    return {
      readmeBytes: sizeOf.get('README.md') ?? null,
      hasTests: has(/(^|\/)(__tests__|tests?|spec)(\/|\.)|(\.(test|spec)\.(m?js|ts)$)/i),
      hasCI: has(/^\.github\/workflows\/.+\.ya?ml$/i),
      hasDocsDir: has(/^docs\//i),
    }
  }
  return null
}

async function main() {
  const rows = readFileSync(PATHS.plugins, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const todo = rows.filter((r) => r.files && r.files.hasTests == null)
  console.log(`[backfill-tree] ${todo.length}/${rows.length} rows need tree signals`)
  let done = 0, failed = 0
  for (const r of todo) {
    const sig = await treeSignals(r.owner, r.repo, r.default_branch)
    done++
    if (sig) Object.assign(r.files, sig)
    else failed++
    if (done % 200 === 0) console.log(`[backfill-tree] ${done}/${todo.length}（failed ${failed}）`)
  }
  writeFileSync(PATHS.plugins, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`[backfill-tree] done：${done - failed} 行已回填，${failed} 行拉取失败（保持缺失不扣分）`)
}

main().catch((e) => { console.error(e); process.exit(1) })
