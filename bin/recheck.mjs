#!/usr/bin/env node
// 单插件强制重验（作者触发，零后端方案）：node bin/recheck.mjs <owner/repo>
// 供 .github/workflows/recheck.yml（workflow_dispatch）调用——/p/ 页「申请重检」的落地实现。
//
// 行为：
//   - 无视 done.ids，对该仓库重跑 validateOne（候选池命中则用其元数据走省配额路径）
//   - 判定 valid  → 替换 plugins.jsonl 既有行（按 full_name 小写匹配，含改名旧行；无则追加）
//   - 判定 invalid → 从 plugins.jsonl 移除该行，追加 invalid.jsonl（已有同仓库行则跳过）
//   - 瞬时失败（限速/网络）exit 1 提示重试，不动数据
//   - 原子写；重验后建议跑 snapshot 全链对齐派生产物（recheck.yml 已编排）
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { PATHS, readJsonl } from '../lib/data.mjs'
import { validateOne } from '../pipeline/validate/validate.mjs'

const TERMINAL = new Set(['no-signal', 'fork', 'archived', 'repo-gone', 'no-package.json', 'package-parse', 'no-dsh-bundle', 'patch-missing'])
const PLUGINS_PATH = process.env.DSH_RECHECK_PLUGINS || PATHS.plugins
const INVALID_PATH = process.env.DSH_RECHECK_INVALID || PATHS.invalid
const atomic = (path, content) => { const tmp = path + '.tmp'; writeFileSync(tmp, content); renameSync(tmp, path) }
const rowKey = (r) => String(r.full_name || `${r.owner}/${r.repo}`).toLowerCase()

async function main() {
  const target = String(process.argv[2] || '').replace(/^\/+|\/+$/g, '')
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(target)) {
    console.error('usage: node bin/recheck.mjs <owner/repo>')
    process.exit(2)
  }
  const key = target.toLowerCase()
  const cand = readJsonl(PATHS.candidatesAll).find((c) => c.kind === 'repo' && String(c.id).toLowerCase() === key)
  const c = cand || { kind: 'repo', id: target, owner: target.split('/')[0], name: target.split('/')[1], source: 'recheck', topics: ['dsh-plugin'] }
  console.log(`[recheck] ${target}（候选池${cand ? '命中，走省配额路径' : '未命中，最小候选'}）`)

  const res = await validateOne(c)
  if (!res.ok && !TERMINAL.has(res.reason)) {
    console.error(`[recheck] 暂时失败（${res.reason}）——网络/限速，稍后重试；数据未动`)
    process.exit(1)
  }

  const plugins = readFileSync(PLUGINS_PATH, 'utf8').split('\n').filter(Boolean)
  const rows = plugins.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const keep = rows.filter((r) => rowKey(r) !== key)

  if (res.ok) {
    const full = String(res.record.full_name).toLowerCase()
    const kept = keep.filter((r) => rowKey(r) !== full) // 改名旧行也一并替换
    kept.push(res.record)
    atomic(PLUGINS_PATH, kept.map((r) => JSON.stringify(r)).join('\n') + '\n')
    console.log(`[recheck] ✓ ${res.record.full_name} 有效（score 待 analyze 重算）· plugins.jsonl ${rows.length} → ${kept.length} 行`)
    if (kept.length !== rows.length) console.log(`[recheck] 注意：清除了 ${rows.length - kept.length + 1} 行（旧名/重复）`)
  } else {
    const invalid = readJsonl(INVALID_PATH)
    const invExists = invalid.some((r) => String(r.full_name || `${r.owner}/${r.repo}`).toLowerCase() === key)
    const outInvalid = invExists ? invalid : [...invalid, { valid: false, reason: res.reason, owner: c.owner, repo: c.name, full_name: target, source: c.source || 'recheck', checkedAt: new Date().toISOString() }]
    atomic(PLUGINS_PATH, keep.map((r) => JSON.stringify(r)).join('\n') + '\n')
    atomic(INVALID_PATH, outInvalid.map((r) => JSON.stringify(r)).join('\n') + '\n')
    console.log(`[recheck] ✗ ${target} 无效（${res.reason}）· 已移出权威集${invExists ? '（invalid 已有记录）' : '，写入 invalid'}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
