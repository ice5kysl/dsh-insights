#!/usr/bin/env node
/**
 * dsh-plugin-insights — orchestrate the full pipeline.
 *
 *   node bin/dsh-plugin-insights.mjs run [--limit N] [--skip-discover]
 *
 * Stages:
 *   01 discover → data/candidates.jsonl
 *   02 validate → data/plugins.jsonl (authoritative) + data/invalid.jsonl (resumable)
 *   03 analyze  → data/analysis.json + data/report.md
 *   04 site     → site/index.html
 *
 * Rate limiting: stages pace themselves from the GitHub API envelope. Set
 * GITHUB_TOKEN for a 5000/hr budget (git: `GITHUB_TOKEN=$(gh auth token)`).
 *
 * @module dsh-plugin-insights/cli
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const limit = (() => { const i = args.indexOf('--limit'); return i >= 0 ? Number(args[i + 1]) || 0 : 0 })()
const skipDiscover = args.includes('--skip-discover')

const node = process.execPath
function run(script, env) {
  console.log(`\n=== ${script} ===`)
  const r = spawnSync(node, [join(ROOT, 'stages', script)], { stdio: 'inherit', env: { ...process.env, ...env } })
  if (r.status !== 0) { console.error(`stage failed: ${script} (exit ${r.status})`); process.exit(r.status ?? 1) }
}

const env = limit ? { LIMIT: String(limit) } : {}
run('01-discover.mjs', env)
run('02-validate.mjs', env)
run('03-analyze.mjs', env)
run('04-site.mjs', env)
console.log('\n[done] data/plugins.jsonl + data/report.md + site/index.html 已生成。')
