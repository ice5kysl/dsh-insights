#!/usr/bin/env node
/**
 * Resume runner — keeps retrying the validation sweep until GitHub's
 * secondary rate limit clears, then runs it to completion.
 * Intended to run as a long-lived background process across rounds.
 *
 *   node bin/resume-validate.mjs [--every 60]
 *
 * @module dsh-plugin-insights/resume
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const every = Number((args.includes('--every') ? args[args.indexOf('--every') + 1] : null) || 60)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function apiOk() {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'user-agent': 'dsh-plugin-insights',
        accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(15000),
    })
    return res.ok
  } catch { return false }
}

async function main() {
  let attempts = 0
  for (;;) {
    attempts++
    if (await apiOk()) {
      console.log(`[resume] API available (attempt ${attempts}); starting sweep`)
      const r = spawnSync(process.execPath, [join(ROOT, 'stages', '02-validate.mjs'), join(ROOT, 'data', 'candidates-all.jsonl')], {
        stdio: 'inherit',
        env: { ...process.env },
        timeout: 4 * 60 * 60 * 1000,
      })
      console.log(`[resume] sweep exit ${r.status} — done:see state; will re-check in ${every}s if work remains`)
    } else {
      console.log(`[resume] API still limited (attempt ${attempts}); waiting ${every}s`)
    }
    await sleep(every * 1000)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
