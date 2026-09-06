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

import { readFileSync, writeFileSync, renameSync } from 'node:fs'
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


/** 并发安全落盘：重读当前文件，把本次处理出的信号合并进去（不吞掉 sweep 的新增行） */
function saveMerged(rows) {
  const fresh = readFileSync(PATHS.plugins, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const sigBy = new Map()
  for (const r of rows) if (r.files && r.files.hasTests != null) sigBy.set((r.full_name || '').toLowerCase(), r.files)
  for (const f of fresh) {
    const sig = sigBy.get((f.full_name || '').toLowerCase())
    if (sig) { if (!f.files) f.files = {}; Object.assign(f.files, sig) }
  }
  writeFileSync(PATHS.plugins + '.tmp', fresh.map((x) => JSON.stringify(x)).join('\n') + '\n')
  renameSync(PATHS.plugins + '.tmp', PATHS.plugins)
}

async function main() {
  const rows = readFileSync(PATHS.plugins, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const todo = rows.filter((r) => r.files && r.files.hasTests == null)
  console.log(`[backfill-tree] ${todo.length}/${rows.length} rows need tree signals`)
  let done = 0, failed = 0
  for (const r of todo) {
    let sig = null
    try {
      sig = await treeSignals(r.owner, r.repo, r.default_branch)
    } catch (e) { /* fetch 超时/网络错误按失败计（保持缺失不扣分） */ }
    done++
    if (sig) Object.assign(r.files, sig)
    else failed++
    if (done % 200 === 0) console.log(`[backfill-tree] ${done}/${todo.length}（failed ${failed}）`)
    if (done % 500 === 0) { saveMerged(rows); console.log(`[backfill-tree] checkpoint merged @${done}`) }
  }
  saveMerged(rows)
  console.log(`[backfill-tree] done：${done - failed} 行已回填，${failed} 行拉取失败（保持缺失不扣分）`)
}

main().catch((e) => { console.error(e); process.exit(1) })
