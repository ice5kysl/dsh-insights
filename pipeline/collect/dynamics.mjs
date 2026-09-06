#!/usr/bin/env node
/**
 * pipeline/collect · dynamics — 官方动态快照（L2）。
 *
 * 低成本（每次 <15 个 API 调用），只采可观测公开信号，不做舆情：
 *   - dsh 官方：repo meta（stars/pushed）+ 最近 releases（含 rc 标记与
 *     breaking 关键词命中）+ npm @deepseek-ai/dsh dist-tags 与发布时间线
 *   - DeepSeek 平台：官方仓库（模型/API 文档）meta + 最新 release
 *
 * Output: data/dynamics.json（当前态；时间序列由 git 历史累积）
 *
 * @module dsh-insights/pipeline-collect-dynamics
 */

import { PATHS, writeJson, readJson } from '../../lib/data.mjs'
import { ghApi, NPM, raw } from '../../lib/api.mjs'

const BREAKING_RE = /breaking|不兼容|incompatible|migrate|迁移|移除|removed|deprecat/i

const DSH_REPO = 'deepseek-ai/DeepSeek-Harness'
const PLATFORM_REPOS = ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/awesome-deepseek-integration']

async function repoMeta(full) {
  const r = await ghApi(`/repos/${full}`)
  if (!r.ok) return { repo: full, error: `http ${r.status}` }
  const b = r.body || {}
  return { repo: full, stars: b.stargazers_count ?? 0, forks: b.forks_count ?? 0, pushed_at: b.pushed_at ?? null, description: (b.description || '').slice(0, 200) }
}

async function repoReleases(full, limit = 8) {
  const r = await ghApi(`/repos/${full}/releases?per_page=${limit}`)
  if (!r.ok) return []
  return (r.body || []).map((x) => ({
    tag: x.tag_name,
    name: (x.name || '').slice(0, 120),
    prerelease: Boolean(x.prerelease),
    published_at: x.published_at,
    breaking: BREAKING_RE.test(x.body || ''),
  }))
}

async function npmTimeline(pkg) {
  const r = await raw(`${NPM}/${pkg.replace(/^@/, '%40')}`)
  if (!r.ok) return null
  const d = r.body
  const time = d.time || {}
  const versions = Object.keys(d.versions || {})
    .map((v) => ({ version: v, time: time[v] || null }))
    .filter((x) => x.time)
    .sort((a, b) => (a.time < b.time ? 1 : -1))
    .slice(0, 10)
  return { pkg, distTags: d['dist-tags'] || {}, modified: time.modified || null, versions }
}

async function main() {
  console.log('[dynamics] collecting official signals…')
  const [dshMeta, dshReleases, dshNpm] = await Promise.all([
    repoMeta(DSH_REPO),
    repoReleases(DSH_REPO),
    npmTimeline('@deepseek-ai/dsh'),
  ])
  const platform = []
  for (const full of PLATFORM_REPOS) {
    const meta = await repoMeta(full)
    if (!meta.error) {
      const rel = await repoReleases(full, 1)
      meta.latestRelease = rel[0] || null
    }
    platform.push(meta)
  }

  // 兼容信号（复用 compat.json：声明 engines.dsh 的插件占比 vs 当前 rc）
  const compat = readJson(PATHS.compat)
  const compatSignal = compat
    ? {
        distTags: compat.officialDsh?.distTags || {},
        pluginsProbed: (compat.plugins || []).length,
        declaringEngines: (compat.plugins || []).filter((p) => p.enginesDsh).length,
        declaringPeers: (compat.plugins || []).filter((p) => (p.dshPeers || []).length).length,
      }
    : null

  const doc = {
    fetchedAt: new Date().toISOString(),
    dsh: { ...dshMeta, releases: dshReleases, npm: dshNpm },
    platform,
    compatSignal,
    note: '只含可观测公开信号（releases / dist-tags / repo 活动），不含新闻舆情。rc 兼容雷达 v0 依赖契约字段声明率，见 /about。',
  }
  writeJson(PATHS.dynamics, doc, true)
  console.log(`[dynamics] dsh releases ${dshReleases.length} · npm dist-tags ${JSON.stringify(dshNpm?.distTags || {})} · platform ${platform.filter((p) => !p.error).length}/${platform.length} → ${PATHS.dynamics}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
