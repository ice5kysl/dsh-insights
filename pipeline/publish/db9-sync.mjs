#!/usr/bin/env node
/**
 * pipeline/publish · db9-sync — 把插件主表与 npm 周下载量 upsert 进 db9（serverless Postgres）。
 *
 * 定位：旁路存储镜像（供外部 SQL 查询/仪表盘消费），data/ 文件仍是唯一事实来源。
 *
 * 失败纪律（对齐 collect/downloads.mjs）：
 *   - 无 DB9_TOKEN → 打印跳过说明，exit 0
 *   - 任何 db9 错误（网络/建表/写入）→ 打印告警，exit 0，绝不阻塞管线
 *   - 单批写入失败跳过该批继续，计数进总结
 *
 * 输入（只读）：data/plugins.jsonl（valid 且 kind='repo' 的行）· data/enrich.json · data/downloads.json
 * 环境：DB9_TOKEN（db9 API token）
 *
 * @module dsh-insights/stage-db9-sync
 */

import { PATHS, readJson, loadPlugins, loadEnrichMap } from '../../lib/data.mjs'
import { isEnabled, sql, lit, jsonLit } from '../../lib/db9.mjs'

const BATCH = 200

const CREATE_PLUGINS = `CREATE TABLE IF NOT EXISTS plugins (
  full_name TEXT PRIMARY KEY,
  owner TEXT,
  repo TEXT,
  kind TEXT,
  pkg_name TEXT,
  version TEXT,
  description TEXT,
  license TEXT,
  html_url TEXT,
  default_branch TEXT,
  stars INT,
  forks INT,
  archived BOOL,
  fork BOOL,
  topics JSONB,
  repo_created_at TIMESTAMPTZ,
  pushed_at TIMESTAMPTZ,
  score INT,
  grade TEXT,
  category TEXT,
  in_awesome BOOL,
  covered BOOL,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw JSONB
)`

const CREATE_DOWNLOADS = `CREATE TABLE IF NOT EXISTS plugin_downloads (
  pkg_name TEXT,
  week_start DATE,
  week_end DATE,
  downloads INT,
  fetched_at TIMESTAMPTZ,
  PRIMARY KEY (pkg_name, week_start)
)`

// first_seen 只在首次插入时写；冲突时除 first_seen 外全部更新为 EXCLUDED 值。
const UPSERT_PLUGINS = `INSERT INTO plugins (
  full_name, owner, repo, kind, pkg_name, version, description, license, html_url, default_branch,
  stars, forks, archived, fork, topics, repo_created_at, pushed_at,
  score, grade, category, in_awesome, covered, first_seen, last_seen, updated_at, raw
) VALUES %s
ON CONFLICT (full_name) DO UPDATE SET
  owner = EXCLUDED.owner, repo = EXCLUDED.repo, kind = EXCLUDED.kind,
  pkg_name = EXCLUDED.pkg_name, version = EXCLUDED.version, description = EXCLUDED.description,
  license = EXCLUDED.license, html_url = EXCLUDED.html_url, default_branch = EXCLUDED.default_branch,
  stars = EXCLUDED.stars, forks = EXCLUDED.forks, archived = EXCLUDED.archived, fork = EXCLUDED.fork,
  topics = EXCLUDED.topics, repo_created_at = EXCLUDED.repo_created_at, pushed_at = EXCLUDED.pushed_at,
  score = EXCLUDED.score, grade = EXCLUDED.grade, category = EXCLUDED.category,
  in_awesome = EXCLUDED.in_awesome, covered = EXCLUDED.covered,
  last_seen = now(), updated_at = now(), raw = EXCLUDED.raw`

const UPSERT_DOWNLOADS = `INSERT INTO plugin_downloads (pkg_name, week_start, week_end, downloads, fetched_at)
VALUES %s
ON CONFLICT (pkg_name, week_start) DO UPDATE SET
  downloads = EXCLUDED.downloads, week_end = EXCLUDED.week_end, fetched_at = EXCLUDED.fetched_at`

function pluginRow(p, enrich) {
  const e = enrich.get(p.full_name) || {}
  return `(${[
    lit(p.full_name), lit(p.owner), lit(p.repo), lit(p.kind), lit(p.pkgName), lit(p.version),
    lit(p.description), lit(p.license), lit(p.html_url), lit(p.default_branch),
    lit(p.stars ?? null), lit(p.forks ?? null), lit(p.archived ?? null), lit(p.fork ?? null),
    jsonLit(p.topics ?? []), lit(p.created_at), lit(p.pushed_at),
    lit(e.score ?? null), lit(e.grade), lit(e.category), lit(e.inAwesome ?? null), lit(e.covered ?? null),
    'now()', 'now()', 'now()', jsonLit(p),
  ].join(', ')})`
}

/** 分批执行 upsert；单批失败告警并跳过（不阻塞后续批次），返回 { ok, failed }。 */
async function upsertBatches(token, label, statement, rows) {
  let ok = 0
  let failed = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await sql(token, statement.replace('%s', batch.join(',\n')))
      ok += batch.length
    } catch (e) {
      failed += batch.length
      console.error(`[db9-sync] ${label} 第 ${i / BATCH + 1} 批（${batch.length} 行）写入失败：${String(e?.message || e).slice(0, 200)}`)
    }
  }
  return { ok, failed }
}

async function main() {
  if (!isEnabled()) {
    console.log('[db9-sync] 未配置 DB9_TOKEN，跳过 db9 同步（旁路存储，不影响管线）')
    return
  }
  const token = process.env.DB9_TOKEN
  try {
    await sql(token, CREATE_PLUGINS)
    await sql(token, CREATE_DOWNLOADS)
  } catch (e) {
    console.error(`[db9-sync] 建表失败（db9 不可用？），降级为告警不阻塞管线：${String(e?.message || e).slice(0, 200)}`)
    return
  }

  // 与现有发布层同口径：只同步通过门禁的权威集（valid 且 kind='repo'）
  const plugins = loadPlugins().filter((p) => p.valid && p.kind === 'repo')
  const enrich = loadEnrichMap()
  const pr = await upsertBatches(token, 'plugins', UPSERT_PLUGINS, plugins.map((p) => pluginRow(p, enrich)))
  console.log(`[db9-sync] plugins upsert ${pr.ok}/${plugins.length}${pr.failed ? `（失败 ${pr.failed} 行）` : ''}`)

  const dl = readJson(PATHS.downloads, null)
  const entries = Object.entries(dl?.map || {})
  const dlRows = entries.map(([name, v]) =>
    `(${[lit(name), lit(v.start), lit(v.end), lit(v.d ?? null), lit(dl.fetchedAt)].join(', ')})`)
  const dr = await upsertBatches(token, 'plugin_downloads', UPSERT_DOWNLOADS, dlRows)
  console.log(`[db9-sync] plugin_downloads upsert ${dr.ok}/${entries.length}${dr.failed ? `（失败 ${dr.failed} 行）` : ''}`)

  if (pr.failed + dr.failed > 0) {
    console.error('[db9-sync] 存在失败批次，已降级为告警（不阻塞管线）')
  }
}

main().catch((e) => {
  // db9 是旁路存储：任何未预期错误都只告警，绝不 exit 非 0
  console.error(`[db9-sync] 同步失败（已降级为告警，不阻塞管线）：${String(e?.stack || e).slice(0, 500)}`)
})
