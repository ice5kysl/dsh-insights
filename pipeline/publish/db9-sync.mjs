#!/usr/bin/env node
/**
 * pipeline/publish · db9-sync — 把权威集数据 upsert 进 db9（serverless Postgres）。
 *
 * 定位：旁路存储镜像（供外部 SQL 查询/仪表盘消费），data/ 文件仍是唯一事实来源。
 *
 * 同步的表（各数据源失败互不影响：一个挂了其余照跑，最后汇总告警）：
 *   plugins             ← plugins.jsonl（valid 且 kind='repo'）+ enrich.json
 *   plugin_downloads    ← downloads.json（npm 周下载量）
 *   plugin_scores       ← history.json 全量回填 + enrich.json 按当天（UTC）增量（detail 存扣分细节）
 *   score_runs          ← history.json 每日汇总（total/grades/avg/median）
 *   compat_observations ← compat-observed-cache.json（pkg@version 实测兼容矩阵；
 *                         ON CONFLICT 不更新 observed_at，保留首次观察时间）
 *   plugin_llm_tags     ← llm.jsonl（同 full_name 多行取 taggedAt 最新；重打标全量覆盖）
 *   project_metrics     ← metrics.jsonl（整行原样存 payload）
 *
 * 失败纪律（对齐 collect/downloads.mjs）：
 *   - 无 DB9_TOKEN → 打印跳过说明，exit 0
 *   - 任何 db9 错误（网络/建表/写入）→ 打印告警，exit 0，绝不阻塞管线
 *   - 单批写入失败跳过该批继续，计数进总结
 *
 * @module dsh-insights/stage-db9-sync
 */

import { join } from 'node:path'
import { PATHS, DATA, readJson, readJsonl, loadPlugins, loadEnrichMap } from '../../lib/data.mjs'
import { isEnabled, sql, lit, jsonLit, splitPkgVersion, latestBy } from '../../lib/db9.mjs'

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

const CREATE_SCORES = `CREATE TABLE IF NOT EXISTS plugin_scores (
  full_name TEXT,
  date DATE,
  score INT,
  grade TEXT,
  detail JSONB,
  PRIMARY KEY (full_name, date)
)`

const CREATE_SCORE_RUNS = `CREATE TABLE IF NOT EXISTS score_runs (
  date DATE PRIMARY KEY,
  total INT,
  grades JSONB,
  avg NUMERIC,
  median INT
)`

const CREATE_COMPAT_OBS = `CREATE TABLE IF NOT EXISTS compat_observations (
  pkg_name TEXT,
  version TEXT,
  client TEXT,
  requires JSONB,
  requires_v2 JSONB,
  observed_at TIMESTAMPTZ,
  PRIMARY KEY (pkg_name, version)
)`

const CREATE_LLM_TAGS = `CREATE TABLE IF NOT EXISTS plugin_llm_tags (
  full_name TEXT PRIMARY KEY,
  category TEXT,
  capability_tags JSONB,
  commands JSONB,
  summary_zh TEXT,
  summary_en TEXT,
  claims JSONB,
  confidence NUMERIC,
  model TEXT,
  tagged_at TIMESTAMPTZ,
  raw JSONB
)`

const CREATE_METRICS = `CREATE TABLE IF NOT EXISTS project_metrics (
  date DATE PRIMARY KEY,
  payload JSONB
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

const UPSERT_SCORES = `INSERT INTO plugin_scores (full_name, date, score, grade, detail)
VALUES %s
ON CONFLICT (full_name, date) DO UPDATE SET
  score = EXCLUDED.score, grade = EXCLUDED.grade, detail = EXCLUDED.detail`

const UPSERT_SCORE_RUNS = `INSERT INTO score_runs (date, total, grades, avg, median)
VALUES %s
ON CONFLICT (date) DO UPDATE SET
  total = EXCLUDED.total, grades = EXCLUDED.grades, avg = EXCLUDED.avg, median = EXCLUDED.median`

// ON CONFLICT 不更新 observed_at：保留首次观察时间，只刷新兼容数据本身。
const UPSERT_COMPAT_OBS = `INSERT INTO compat_observations (pkg_name, version, client, requires, requires_v2, observed_at)
VALUES %s
ON CONFLICT (pkg_name, version) DO UPDATE SET
  client = EXCLUDED.client, requires = EXCLUDED.requires, requires_v2 = EXCLUDED.requires_v2`

const UPSERT_LLM_TAGS = `INSERT INTO plugin_llm_tags (
  full_name, category, capability_tags, commands, summary_zh, summary_en,
  claims, confidence, model, tagged_at, raw
) VALUES %s
ON CONFLICT (full_name) DO UPDATE SET
  category = EXCLUDED.category, capability_tags = EXCLUDED.capability_tags, commands = EXCLUDED.commands,
  summary_zh = EXCLUDED.summary_zh, summary_en = EXCLUDED.summary_en, claims = EXCLUDED.claims,
  confidence = EXCLUDED.confidence, model = EXCLUDED.model, tagged_at = EXCLUDED.tagged_at, raw = EXCLUDED.raw`

const UPSERT_METRICS = `INSERT INTO project_metrics (date, payload)
VALUES %s
ON CONFLICT (date) DO UPDATE SET payload = EXCLUDED.payload`

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

const fmt = (label, r, total) =>
  `${label} ${r.ok}/${total}${r.failed ? `（失败 ${r.failed} 行）` : ''}`

async function syncPlugins(token) {
  await sql(token, CREATE_PLUGINS)
  // 与现有发布层同口径：只同步通过门禁的权威集（valid 且 kind='repo'）
  const plugins = loadPlugins().filter((p) => p.valid && p.kind === 'repo')
  const enrich = loadEnrichMap()
  const r = await upsertBatches(token, 'plugins', UPSERT_PLUGINS, plugins.map((p) => pluginRow(p, enrich)))
  return fmt('plugins', r, plugins.length)
}

async function syncDownloads(token) {
  await sql(token, CREATE_DOWNLOADS)
  const dl = readJson(PATHS.downloads, null)
  const entries = Object.entries(dl?.map || {})
  const rows = entries.map(([name, v]) =>
    `(${[lit(name), lit(v.start), lit(v.end), lit(v.d ?? null), lit(dl.fetchedAt)].join(', ')})`)
  const r = await upsertBatches(token, 'plugin_downloads', UPSERT_DOWNLOADS, rows)
  return fmt('plugin_downloads', r, entries.length)
}

async function syncScores(token) {
  await sql(token, CREATE_SCORES)
  await sql(token, CREATE_SCORE_RUNS)
  const history = readJson(PATHS.history, null)
  const entries = history?.entries || []
  // 回填：history.json 全部 entries 逐插件 upsert（detail 为 null）
  const backfill = []
  for (const e of entries) {
    for (const [fullName, v] of Object.entries(e.plugins || {})) {
      backfill.push(`(${[lit(fullName), lit(e.date), lit(v.score ?? null), lit(v.grade), 'NULL'].join(', ')})`)
    }
  }
  // 增量：当天（UTC）enrich 全量结果，detail 存分析细节（扣分项），从此每天有据可查
  const today = new Date().toISOString().slice(0, 10)
  const enrichRows = readJson(PATHS.enrich, [])
  const incremental = enrichRows.map((e) =>
    `(${[lit(e.full_name), lit(today), lit(e.score ?? null), lit(e.grade),
      jsonLit({ dimScores: e.dimScores ?? null, drops: e.drops ?? null, category: e.category ?? null, missing: e.missing ?? null }),
    ].join(', ')})`)
  const rows = [...backfill, ...incremental]
  const r = await upsertBatches(token, 'plugin_scores', UPSERT_SCORES, rows)
  const runRows = entries.map((e) =>
    `(${[lit(e.date), lit(e.total ?? null), jsonLit(e.grades ?? null), lit(e.avg ?? null), lit(e.median ?? null)].join(', ')})`)
  const rr = await upsertBatches(token, 'score_runs', UPSERT_SCORE_RUNS, runRows)
  return `${fmt('plugin_scores', r, rows.length)}（回填 ${backfill.length} + 当日 ${incremental.length}）· ${fmt('score_runs', rr, runRows.length)}`
}

async function syncCompatObservations(token) {
  await sql(token, CREATE_COMPAT_OBS)
  const cache = readJson(join(DATA, 'compat-observed-cache.json'), {})
  const keys = Object.keys(cache || {})
  const rows = keys.map((k) => {
    const [pkgName, version] = splitPkgVersion(k)
    const v = cache[k] || {}
    return `(${[lit(pkgName), lit(version), lit(v.client), jsonLit(v.requires ?? null), jsonLit(v.requiresV2 ?? null), 'now()'].join(', ')})`
  })
  const r = await upsertBatches(token, 'compat_observations', UPSERT_COMPAT_OBS, rows)
  return fmt('compat_observations', r, keys.length)
}

async function syncLlmTags(token) {
  await sql(token, CREATE_LLM_TAGS)
  const all = readJsonl(PATHS.llm)
  const latest = latestBy(all, (r) => r.full_name, (r) => r.taggedAt)
  const rows = latest.map((r) =>
    `(${[
      lit(r.full_name), lit(r.category), jsonLit(r.capabilityTags ?? null), jsonLit(r.commands ?? null),
      lit(r.summaryZh), lit(r.summaryEn), jsonLit(r.claims ?? null), lit(r.confidence ?? null),
      lit(r.model), lit(r.taggedAt), jsonLit(r),
    ].join(', ')})`)
  const r = await upsertBatches(token, 'plugin_llm_tags', UPSERT_LLM_TAGS, rows)
  return fmt('plugin_llm_tags', r, latest.length)
}

async function syncMetrics(token) {
  await sql(token, CREATE_METRICS)
  const all = readJsonl(PATHS.metrics).filter((r) => r.date)
  const rows = all.map((r) => `(${[lit(r.date), jsonLit(r)].join(', ')})`)
  const r = await upsertBatches(token, 'project_metrics', UPSERT_METRICS, rows)
  return fmt('project_metrics', r, all.length)
}

async function main() {
  if (!isEnabled()) {
    console.log('[db9-sync] 未配置 DB9_TOKEN，跳过 db9 同步（旁路存储，不影响管线）')
    return
  }
  const token = process.env.DB9_TOKEN
  const sources = [
    ['plugins', syncPlugins],
    ['downloads', syncDownloads],
    ['scores', syncScores],
    ['compat', syncCompatObservations],
    ['llm-tags', syncLlmTags],
    ['metrics', syncMetrics],
  ]
  const summaries = []
  let failedSources = 0
  for (const [label, fn] of sources) {
    try {
      summaries.push(await fn(token))
    } catch (e) {
      // 单个数据源失败不影响其余源（如源文件缺失/损坏或该表建表失败）
      failedSources++
      summaries.push(`${label} 失败`)
      console.error(`[db9-sync] ${label} 同步失败（降级为告警，其余源照跑）：${String(e?.message || e).slice(0, 200)}`)
    }
  }
  console.log(`[db9-sync] ${summaries.join(' · ')}`)
  if (failedSources) console.error(`[db9-sync] ${failedSources}/${sources.length} 个数据源失败，已降级为告警（不阻塞管线）`)
}

main().catch((e) => {
  // db9 是旁路存储：任何未预期错误都只告警，绝不 exit 非 0
  console.error(`[db9-sync] 同步失败（已降级为告警，不阻塞管线）：${String(e?.stack || e).slice(0, 500)}`)
})
