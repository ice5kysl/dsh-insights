#!/usr/bin/env node
/**
 * pipeline/publish · export-json — public JSON export (agent-readable contract) → data/insights.json
 *
 * Stable, machine-readable view over the scored authoritative set. Intended as
 * the public data URL of the product (site/CI will serve it), shaped so an
 * agent asked "which dsh plugin …" can join on full_name and rank by health
 * without scraping HTML. Fields are a frozen subset — additions are additive.
 *
 * @module dsh-insights/stage-9
 */

import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PATHS, readJsonl, loadPlugins } from '../../lib/data.mjs'
import { scoreAll, RULE_VERSION } from '../analyze/score.mjs'

function main() {
  const rows = loadPlugins()
  const { out: scored, summary } = scoreAll(rows)
  const byName = new Map(scored.map((s) => [s.full_name, s.health]))
  const plugins = rows.map((r) => {
    const h = byName.get(r.full_name)
    return {
      full_name: r.full_name,
      url: r.html_url ?? (r.full_name ? `https://github.com/${r.full_name}` : null),
      stars: r.stars ?? 0,
      license: r.license ?? null,
      topics: Array.isArray(r.topics) ? r.topics.slice(0, 8) : [],
      pkgName: r.pkgName ?? null,
      version: r.version ?? null,
      npm: r.npm
        ? { published: r.npm.published ?? false, latest: r.npm.latest ?? null }
        : { published: false, latest: null },
      description: (r.description || '').slice(0, 300),
      health: h
        ? { score: h.score, grade: h.grade, dimScores: h.dimScores || {}, drops: h.drops.map((d) => d.code) }
        : { score: 0, grade: '?', dimScores: {}, drops: [] },
    }
  })

  const doc = {
    $schema: 'https://dsh-insights.com/schema/insights-v1',
    generatedAt: new Date().toISOString(),
    ruleVersion: RULE_VERSION,
    meta: {
      total: summary.total,
      grades: summary.grades,
      note: 'health 为客观启发式信号，非安全审计；missing 数据不虚构。规则见 docs/SCHEMA.md §health。',
    },
    plugins,
  }
  writeFileSync(PATHS.insights, JSON.stringify(doc) + '\n')
  console.log(`[export:json] ${plugins.length} plugins → data/insights.json (${(doc.plugins.reduce((s, p) => s + JSON.stringify(p).length, 0) / 1024).toFixed(0)} KB payload)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
