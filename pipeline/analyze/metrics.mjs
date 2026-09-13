#!/usr/bin/env node
/**
 * pipeline/analyze · metrics — 产品发展指标自测量（PRODUCT-DESIGN §四 落地）。
 *
 * 每周（friday profile）向 data/metrics.jsonl 追加一行：A 覆盖 / B 新鲜度 /
 * D 内容运转 / E 触达的可自动计算项。git 历史即时间序列（时间层资产）。
 *
 * @module dsh-insights/pipeline-analyze-metrics
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, SITE, readJson, readJsonl, loadPlugins } from '../../lib/data.mjs'
import { ghApi } from '../../lib/api.mjs'
import { appendFileSync, readFileSync, existsSync } from 'node:fs'

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
  }
  appendFileSync(file, JSON.stringify(row) + '\n')
  console.log(`[metrics] ${today} → data/metrics.jsonl（权威 ${row.authoritative} · 周报 ${weeklyIssues} · repo★${traffic.stars ?? '—'} · 14d views ${traffic.views14d ?? '—'}）`)
}

main().catch((e) => { console.error(e); process.exit(1) })
