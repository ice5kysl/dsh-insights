#!/usr/bin/env node
/**
 * pipeline/analyze · metrics — 产品发展指标自测量（PRODUCT-DESIGN §四 落地）。
 *
 * 每周（friday profile）向 data/metrics.jsonl 追加一行：A 覆盖 / B 新鲜度 /
 * D 内容运转 / E 触达的可自动计算项。git 历史即时间序列（时间层资产）。
 *
 * E 组「站点访问」走 Umami 公开分享链接（bin/umami.mjs，只读）：需在环境里配
 * UMAMI_SHARE（分享链接或 slug，可选 UMAMI_REGION=us|eu）——分享链接本身就是凭据，
 * 所以不写进仓库；未配置或远端不可用即记 null，不阻塞其余指标。
 *
 * @module dsh-insights/pipeline-analyze-metrics
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, SITE, readJson, readJsonl, loadPlugins } from '../../lib/data.mjs'
import { ghApi } from '../../lib/api.mjs'
import { appendFileSync, readFileSync, existsSync } from 'node:fs'
import { collectUmami, normalizeShare } from '../../bin/umami.mjs'

async function repoTraffic() {
  const out = {}
  const v = await ghApi('/repos/ice5kysl/dsh-insights/traffic/views')
  if (v.ok) { out.views14d = v.body?.count ?? null; out.visitors14d = v.body?.uniques ?? null }
  const c = await ghApi('/repos/ice5kysl/dsh-insights/traffic/clones')
  if (c.ok) { out.clones14d = c.body?.count ?? null }
  const r = await ghApi('/repos/ice5kysl/dsh-insights')
  if (r.ok) { out.stars = r.body?.stargazers_count ?? null; out.forks = r.body?.forks_count ?? null; out.openIssues = r.body?.open_issues_count ?? null }
  return out
}

/**
 * E 组「站点访问」——本指标的最后一格，之前一直空着（只采到 repo traffic）。
 * 走 Umami 公开分享链接（只读，链接本身即凭据，见 bin/umami.mjs）。
 * 未配置 UMAMI_SHARE 或远端不可用 → null，绝不阻塞周度指标（同 db9 / gh 的失败纪律）。
 */
async function siteTraffic() {
  const share = process.env.UMAMI_SHARE
  if (!share) return null
  try {
    const { slug, region } = normalizeShare(share, { region: process.env.UMAMI_REGION })
    const d = await collectUmami({ slug, region, days: 28 })
    return {
      source: 'umami',
      days: d.days,
      visitors: d.totals.visitors,
      pageviews: d.totals.pageviews,
      visits: d.totals.visits,
      bounceRate: Math.round(d.totals.bounceRate * 1000) / 1000,
      avgDuration: Math.round(d.totals.avgDuration),
    }
  } catch (e) {
    console.error(`[metrics] 站点访问拉取失败（跳过，不影响其余指标）：${String(e?.message || e).slice(0, 160)}`)
    return null
  }
}

function countBadges() {
  try {
    let n = 0
    for (const owner of readdirSync(join(SITE, 'badge'))) n += readdirSync(join(SITE, 'badge', owner)).length
    return n
  } catch { return null }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  const file = PATHS.metrics
  if (existsSync(file) && readFileSync(file, 'utf8').includes(`"date":"${today}"`)) {
    console.log(`[metrics] ${today} already recorded — skipping`)
    return
  }
  const analysis = readJson(PATHS.analysis, {})
  const health = readJson(PATHS.health, {})
  const weeklyIssues = (() => { try { return readdirSync(PATHS.weeklyDir).filter((f) => /^\d{4}-W\d{2}/.test(f)).length } catch { return null } })()
  const traffic = await repoTraffic()

  const row = {
    date: today,
    // A 覆盖
    authoritative: analysis.totals?.authoritative ?? loadPlugins().length,
    candidates: analysis.coverage?.candidates ?? null,
    topicUniverse: analysis.coverage?.topicUniverse?.count ?? null,
    // B 新鲜度 / 质量
    grades: health.grades ?? null,
    avgScore: health.avg ?? null,
    ruleVersion: health.ruleVersion ?? null,
    llmTagged: readJsonl(PATHS.llm).length,
    // D 内容运转
    weeklyIssues,
    letters: (() => { try { return readdirSync(PATHS.reportsDir).length } catch { return null } })(),
    // E 触达
    badges: countBadges(),
    repo: traffic,
    site: await siteTraffic(),
  }
  appendFileSync(file, JSON.stringify(row) + '\n')
  console.log(`[metrics] ${today} → data/metrics.jsonl（权威 ${row.authoritative} · 周报 ${weeklyIssues} · repo★${traffic.stars ?? '—'} · 14d views ${traffic.views14d ?? '—'} · 站点访客 ${row.site?.visitors ?? '—'}）`)
}

main().catch((e) => { console.error(e); process.exit(1) })
