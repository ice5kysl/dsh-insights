#!/usr/bin/env node
/**
 * Auto-finish runner — waits out GitHub's secondary rate limit, sweeps all
 * remaining candidates, then finalizes (analyze/site/export) and writes a
 * completion marker. Runs as a long-lived background process.
 *
 * @module dsh-plugin-insights/resume
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const CAND = join(ROOT, 'data', 'candidates-all.jsonl')
const STATE = join(ROOT, 'data', 'state', 'done.ids')
const MARKER = join(ROOT, 'data', 'COMPLETE.json')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const every = Number(process.env.EVERY || 45)

const run = (script) => {
  const r = spawnSync(process.execPath, [join(ROOT, script)], { stdio: 'inherit', env: { ...process.env } })
  return r.status ?? -1
}

function remaining() {
  try {
    const total = readFileSync(CAND, 'utf8').split('\n').filter((l) => l && JSON.parse(l).kind === 'repo').length
    const done = readFileSync(STATE, 'utf8').split('\n').filter(Boolean).length
    return { total, done }
  } catch { return { total: -1, done: -1 } }
}

async function apiOk() {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { 'user-agent': 'dsh-plugin-insights', accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(15000),
    })
    return res.ok
  } catch { return false }
}

async function main() {
  let attempts = 0
  for (;;) {
    const { total, done } = remaining()
    if (total > 0 && done >= total) {
      console.log('[resume] sweep complete — finalizing')
      run('stages/03-analyze.mjs')
      run('stages/04-site.mjs')
      run('stages/05-export.mjs')
      const { writeFileSync } = await import('node:fs')
      writeFileSync(MARKER, JSON.stringify({ complete: true, at: new Date().toISOString(), total, done: total }) + '\n')
      console.log(`[resume] COMPLETE — wrote ${MARKER}`)
      process.exit(0)
    }
    attempts++
    if (await apiOk()) {
      console.log(`[resume] API available (attempt ${attempts}, done ${done}/${total}); sweeping`)
      const st = run('stages/02-validate.mjs')
      if (st !== 0) console.log(`[resume] sweep exit ${st}; retrying`)
    } else {
      console.log(`[resume] API limited (attempt ${attempts}); retry in ${every}s`)
      await sleep(every * 1000)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
