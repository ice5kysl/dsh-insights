#!/usr/bin/env node
// 定时器可观测性：把本次 GitHub Actions 运行（refresh.yml）记录到 db9 pipeline_runs 表，
// 并做缺口自检——相邻两次成功 >6h、或 UTC 14 点后今日 daily 缺席 → 开 ops-timer issue 告警。
//
// 由 refresh.yml 的「Report run」步骤在 if: always() 下调用：主 pipeline 成败都会记录。
// data/last-run.json（写在 RUNNER_TEMP，不进 git）由 Scheduled 步骤在跑 pipeline 前写入，
// 里面带本 run 的 run_id/mode/started_at；run_id 对不上说明本 run 没执行定时步骤（如 mode=full），直接退出。
// 本脚本任何失败都不得影响主任务退出码——workflow 侧已 `|| true`，这里也全链 catch。
//
// 本地调试：DB9_TOKEN=xxx RUN_ID=1 RUN_STATUS=success node bin/run-report.mjs
//   可配 DB9_SQL_URL 指向 dsh-data-dev 开发库。

import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const SQL_URL = process.env.DB9_SQL_URL || 'https://api.db9.ai/customer/databases/toc6zdt4vd7j/sql'
const token = process.env.DB9_TOKEN
const RUN_ID = process.env.RUN_ID
const STATUS = process.env.RUN_STATUS || 'unknown'
const RUN_URL = process.env.RUN_URL || ''
const META_FILE = `${process.env.RUNNER_TEMP || 'data'}/last-run.json`

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS pipeline_runs (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL,
  event TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INT,
  run_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now())`

const sq = (s) => String(s).replace(/'/g, "''")

async function sql(query) {
  const res = await fetch(SQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.error || body?.message) throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`)
  return body
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '' } }).trim()
}

// 开告警 issue（按 label 去重：已有未关闭则跳过，不刷屏）
function ensureIssue(title, body) {
  try {
    gh(['label', 'create', 'ops-timer', '--force', '--color', 'd93f0b', '--description', '定时器/pipeline 运行异常'])
    const open = gh(['issue', 'list', '--label', 'ops-timer', '--state', 'open', '--json', 'number', '-q', '.length'])
    if (Number(open) > 0) return console.log(`[run-report] 已有未关闭 ops-timer issue，跳过新建`)
    const url = gh(['issue', 'create', '--title', title, '--body', body, '--label', 'ops-timer'])
    console.log(`[run-report] 已开告警 issue：${url}`)
  } catch (e) {
    console.log(`[run-report] issue 创建失败（告警降级为日志）：${String(e?.message || e).slice(0, 200)}`)
  }
}

// 缺口自检：只在成功运行时判断（失败本身已是一条失败记录）
async function gapCheck() {
  const rows = (await sql("SELECT started_at FROM pipeline_runs WHERE status = 'success' ORDER BY started_at DESC LIMIT 30")).rows ?? []
  const notes = []
  for (let i = 0; i + 1 < rows.length; i++) {
    const gapH = (Date.parse(rows[i][0]) - Date.parse(rows[i + 1][0])) / 3600000
    if (gapH > 6) {
      notes.push(`相邻两次成功运行间隔 ${gapH.toFixed(1)}h（阈值 6h）——GitHub schedule 投递可能丢失`)
      break
    }
  }
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (now.getUTCHours() >= 14) {
    const dailyToday = await sql(
      `SELECT count(*) FROM pipeline_runs WHERE status = 'success' AND mode IN ('daily','monday') AND started_at::date = '${today}'::date`,
    )
    if (Number(dailyToday.rows?.[0]?.[0] ?? 0) === 0) {
      notes.push(`今日（UTC ${today}）daily/monday 尚未成功，已过 UTC 14 点——日更数据（metrics/db9-sync/周报）在漏跑`)
    }
  }
  if (!notes.length) return

  const recent = rows.slice(0, 10).map((r) => `| ${String(r[0]).slice(0, 19)} |`).join('\n')
  ensureIssue(
    `⚠️ 定时器异常：${notes[0].slice(0, 50)}`,
    `${notes.map((n) => `- ${n}`).join('\n')}\n\n最近成功运行（UTC）：\n\n| started_at |\n|---|\n${recent}\n\n排查入口：Actions 的 refresh workflow 运行记录与 \`data/last-daily.txt\` 去重标记。`,
  )
}

async function main() {
  if (!token) return console.log('[run-report] 未配置 DB9_TOKEN，跳过运行记录')
  if (!RUN_ID) return console.log('[run-report] 缺 RUN_ID，跳过运行记录')
  let meta = null
  try {
    meta = JSON.parse(await readFile(META_FILE, 'utf8'))
  } catch {
    return console.log('[run-report] 无 last-run.json（本 run 未执行定时步骤），跳过')
  }
  if (String(meta.run_id) !== String(RUN_ID)) {
    return console.log(`[run-report] last-run.json run_id=${meta.run_id} ≠ 本 run ${RUN_ID}，跳过`)
  }
  const startedAt = meta.started_at || new Date().toISOString()
  const durationMs = Date.now() - Date.parse(startedAt)
  await sql(CREATE_TABLE)
  await sql(`INSERT INTO pipeline_runs (run_id, event, mode, status, started_at, duration_ms, run_url)
    VALUES (${Number(meta.run_id) || 0}, '${sq(meta.event)}', '${sq(meta.mode)}', '${sq(STATUS)}',
            '${sq(startedAt)}', ${durationMs}, '${sq(RUN_URL)}')`)
  console.log(`[run-report] 已记录：run=${meta.run_id} mode=${meta.mode} status=${STATUS} duration=${durationMs}ms`)
  if (STATUS === 'success') await gapCheck().catch((e) => console.log(`[run-report] 缺口自检失败：${e?.message ?? e}`))
}

main().catch((e) => {
  console.log(`[run-report] 失败（不影响主任务）：${e?.message ?? e}`)
  process.exit(0)
})
