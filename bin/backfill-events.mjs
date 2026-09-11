#!/usr/bin/env node
/**
 * bin/backfill-events.mjs — ecosystem_events 一次性全量历史回填（幂等，可重跑）。
 *
 * dynamics.json 只保留最近窗口（shell releases 8 条、npm versions 10 条），
 * 完整历史在源头 API：本脚本把 dsh 主仓库 + platform[] 各仓库的全部 GitHub
 * releases、@deepseek-ai/dsh 的全部 npm 版本发布时间回填进 db9 的
 * ecosystem_events（upsert 语义与 pipeline/publish/db9-sync.mjs 完全一致：
 * ON CONFLICT 只更新 payload，occurred_at/first_seen 不动，append-only）。
 *
 * 追踪对象口径以 pipeline/collect/dynamics.mjs 为准：
 *   - 主仓库 deepseek-ai/DeepSeek-Harness → type shell_release（key = tag）
 *   - platform[] 各仓库（取当前 dynamics.json 的清单）→ type platform_release（key = repo@tag）
 *   - npm @deepseek-ai/dsh → type npm_publish（key = version，跳过 created/modified 伪键）
 *   - models 的 first_seen 不回填（known-models.json 多数为 null，自然累积）
 *
 * 失败纪律（同 db9-sync）：无 DB9_TOKEN 跳过 exit 0；单仓库/单源失败告警跳过，
 * 绝不 exit 非 0。GitHub API 用 GITHUB_TOKEN/GH_TOKEN（lib/api.mjs 匿名仅 60/hr 会告警）。
 *
 * @module dsh-insights/bin-backfill-events
 */

import { pathToFileURL } from 'node:url'
import { ghApi, raw, NPM } from '../lib/api.mjs'
import { PATHS, readJson } from '../lib/data.mjs'
import { isEnabled, sql, lit, jsonLit } from '../lib/db9.mjs'

const DSH_REPO = 'deepseek-ai/DeepSeek-Harness' // 与 pipeline/collect/dynamics.mjs 一致
const DSH_NPM_PKG = '@deepseek-ai/dsh'
const BATCH = 200

// 与 dynamics.mjs 同一套判断：breaking 关键词 + 正文摘要（首个实质 bullet + added/fixed 计数）
const BREAKING_RE = /breaking|不兼容|incompatible|migrate|迁移|移除|removed|deprecat/i

function summarizeBody(body) {
  if (!body) return { summary: null, added: 0, fixed: 0 }
  const zh = body.split(/<h3 id="cn-/i)[1] || body
  let summary = null
  for (const l of zh.split('\n')) {
    const t = l.trim()
    if (!t || t.startsWith('[') || t.startsWith('#') || t.startsWith('<')) continue
    if (t.startsWith('*') || t.startsWith('-')) {
      summary = t.replace(/^[*-]\s+/, '').replace(/\s*@[\w-]+\s*$/, '').replace(/<[^>]+>/g, '').slice(0, 110)
      break
    }
  }
  const added = (body.match(/新增|新增功能|feat|Added/gi) || []).length
  const fixed = (body.match(/修复|fix/gi) || []).length
  return { summary, added, fixed }
}

/** GitHub API release 对象 → ecosystem_events 行；无 tag/published_at 返回 null。 */
export function releaseToEvent(repo, x) {
  if (!x?.tag_name || !x?.published_at) return null
  const type = repo.toLowerCase() === DSH_REPO.toLowerCase() ? 'shell_release' : 'platform_release'
  return {
    type,
    key: type === 'shell_release' ? x.tag_name : `${repo}@${x.tag_name}`,
    occurred_at: x.published_at,
    payload: {
      tag: x.tag_name,
      name: (x.name || '').slice(0, 120),
      prerelease: Boolean(x.prerelease),
      published_at: x.published_at,
      breaking: BREAKING_RE.test(x.body || ''),
      ...summarizeBody(x.body || ''),
    },
  }
}

/** npm registry 文档的 time 字段 → npm_publish 事件（跳过 created/modified 伪版本键）。 */
export function npmTimeToEvents(pkg, time) {
  const events = []
  for (const [version, t] of Object.entries(time || {})) {
    if (version === 'created' || version === 'modified' || !t) continue
    events.push({ type: 'npm_publish', key: version, occurred_at: t, payload: { pkg, version, time: t } })
  }
  return events
}

const UPSERT_EVENTS = `INSERT INTO ecosystem_events (type, key, occurred_at, payload, first_seen)
VALUES %s
ON CONFLICT (type, key) DO UPDATE SET payload = EXCLUDED.payload`

async function upsertBatches(token, rows) {
  let ok = 0
  let failed = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await sql(token, UPSERT_EVENTS.replace('%s', batch.join(',\n')))
      ok += batch.length
    } catch (e) {
      failed += batch.length
      console.error(`[backfill-events] 第 ${i / BATCH + 1} 批（${batch.length} 行）写入失败：${String(e?.message || e).slice(0, 200)}`)
    }
  }
  return { ok, failed }
}

const eventRow = (e) => `(${[lit(e.type), lit(e.key), lit(e.occurred_at), jsonLit(e.payload), 'now()'].join(', ')})`

/** 翻页拉取一个仓库的全部 releases（per_page=100，拉空为止）。 */
async function allReleases(full) {
  const out = []
  for (let page = 1; ; page++) {
    const r = await ghApi(`/repos/${full}/releases?per_page=100&page=${page}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const items = r.body || []
    out.push(...items)
    if (items.length < 100) return out
  }
}

async function countsByType(token) {
  const r = await sql(token, 'SELECT type, count(*) FROM ecosystem_events GROUP BY type')
  return Object.fromEntries(r.rows.map(([t, c]) => [t, Number(c)]))
}

async function main() {
  if (!isEnabled()) {
    console.log('[backfill-events] 未配置 DB9_TOKEN，跳过（exit 0）')
    return
  }
  const token = process.env.DB9_TOKEN

  // platform 清单以当前 dynamics.json 为准（dynamics.mjs 动态发现的 top-8）
  const dynamics = readJson(PATHS.dynamics, null)
  const platformRepos = (dynamics?.platform || []).map((p) => p.repo).filter(Boolean)
  const repos = [DSH_REPO, ...platformRepos]
  console.log(`[backfill-events] releases 来源：${repos.length} 个仓库（主仓库 + platform ${platformRepos.length}）`)

  const before = await countsByType(token).catch(() => ({}))
  const events = []

  for (const repo of repos) {
    try {
      const releases = await allReleases(repo)
      const evts = releases.map((x) => releaseToEvent(repo, x)).filter(Boolean)
      events.push(...evts)
      console.log(`[backfill-events] ${repo}: ${evts.length} releases`)
    } catch (e) {
      console.error(`[backfill-events] ${repo} releases 拉取失败（跳过该仓库）：${String(e?.message || e).slice(0, 120)}`)
    }
  }

  try {
    const r = await raw(`${NPM}/${DSH_NPM_PKG.replace(/^@/, '%40')}`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const evts = npmTimeToEvents(DSH_NPM_PKG, r.body?.time)
    events.push(...evts)
    console.log(`[backfill-events] npm ${DSH_NPM_PKG}: ${evts.length} versions`)
  } catch (e) {
    console.error(`[backfill-events] npm ${DSH_NPM_PKG} 拉取失败（跳过）：${String(e?.message || e).slice(0, 120)}`)
  }

  const rows = events.map(eventRow)
  const r = await upsertBatches(token, rows)
  console.log(`[backfill-events] upsert ${r.ok}/${rows.length}${r.failed ? `（失败 ${r.failed} 行）` : ''}`)

  const after = await countsByType(token).catch(() => null)
  if (after) {
    for (const t of Object.keys(after).sort()) {
      const added = after[t] - (before[t] || 0)
      console.log(`[backfill-events] ${t}: 新增 ${added} · 总数 ${after[t]}`)
    }
  }
  if (r.failed) console.error('[backfill-events] 存在失败批次，已降级为告警（exit 0）')
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((e) => {
    // 一次性工具同样遵守旁路纪律：任何未预期错误只告警，exit 0
    console.error(`[backfill-events] 失败（已降级为告警，exit 0）：${String(e?.stack || e).slice(0, 500)}`)
  })
}
