#!/usr/bin/env node
/**
 * pipeline/publish · crash-corpus — 聚合 db9 reports 表（dsh-why --share 崩溃上报）
 * → data/crash-corpus.json（崩溃签名语料，数据飞轮闭环的读路径源头）。
 *
 * 一条 SQL 拉全量 reports 行，lib/db9.mjs 的 aggregateCrashSignatures() 聚合：
 * 按 sig 分组，count 倒序，plugins/shells 按频次截 10、category 取最常见值。
 *
 * 失败纪律（同 db9-sync）：无 DB9_TOKEN 或 db9 不可用 → 告警 exit 0，
 * 有旧 crash-corpus.json 不动它。
 *
 * Output: data/crash-corpus.json（经 pages.yml 发布到 /data/crash-corpus.json）
 *
 * @module dsh-insights/stage-crash-corpus
 */

import { PATHS, writeJson } from '../../lib/data.mjs'
import { isEnabled, sql, aggregateCrashSignatures } from '../../lib/db9.mjs'

async function main() {
  if (!isEnabled()) {
    console.log('[crash-corpus] 未配置 DB9_TOKEN，跳过崩溃语料生成（exit 0，旧文件不动）')
    return
  }
  let rows
  try {
    const res = await sql(process.env.DB9_TOKEN, 'SELECT sig, category, shell, plugin, created_at FROM reports')
    rows = res.rows
  } catch (e) {
    console.error(`[crash-corpus] reports 表读取失败（db9 不可用？），降级为告警 exit 0（旧文件不动）：${String(e?.message || e).slice(0, 200)}`)
    return
  }
  const signatures = aggregateCrashSignatures(rows)
  writeJson(PATHS.crashCorpus, {
    generatedAt: new Date().toISOString(),
    totalReports: rows.length,
    signatures,
  }, true)
  console.log(`[crash-corpus] ${rows.length} reports → ${signatures.length} signatures → data/crash-corpus.json`)
}

main().catch((e) => {
  // 旁路数据：任何未预期错误只告警，exit 0
  console.error(`[crash-corpus] 生成失败（已降级为告警，exit 0）：${String(e?.stack || e).slice(0, 500)}`)
})
