#!/usr/bin/env node
/**
 * Auto-finish runner — sweeps the CANONICAL candidate universe until every
 * candidate has a validation outcome, then finalizes (analyze/site/export),
 * writes data/COMPLETE.json and exits. Survives rate limits (clean pause in
 * stage 02) by re-running until the missing count reaches zero.
 *
 * @module dsh-insights/resume
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const CAND = join(ROOT, 'data', 'candidates-all.jsonl')
const STATE = join(ROOT, 'data', 'state', 'done.ids')
const MARKER = join(ROOT, 'data', 'COMPLETE.json')
const every = Number(process.env.EVERY || 30)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const run = (script) => {
  const r = spawnSync(process.execPath, [join(ROOT, script)], { stdio: 'inherit', env: { ...process.env } })
  return r.status ?? -1
}

function counts() {
  try {
    const ids = readFileSync(CAND, 'utf8').split('\n').filter(Boolean)
      .map((l) => JSON.parse(l)).filter((c) => c.kind === 'repo').map((c) => `${c.owner}/${c.name}`)
    const done = new Set(readFileSync(STATE, 'utf8').split('\n').filter(Boolean))
    return { total: ids.length, missing: ids.filter((id) => !done.has(id)).length, doneUnique: done.size }
  } catch { return { total: -1, missing: -1, doneUnique: -1 } }
}

async function apiOk() {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { 'user-agent': 'dsh-insights', accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(15000),
    })
    return res.ok
  } catch { return false }
}

async function main() {
  let attempts = 0
  for (;;) {
    const { total, missing, doneUnique } = counts()
    if (total > 0 && missing === 0) {
      console.log(`[resume] all ${total} candidates validated — finalizing`)
      run('pipeline/analyze/analyze.mjs')
      run('pipeline/publish/site.mjs')
      run('pipeline/publish/export-csv.mjs')
      writeFileSync(MARKER, JSON.stringify({ complete: true, at: new Date().toISOString(), total, done: doneUnique, missing: 0 }) + '\n')
      console.log(`[resume] COMPLETE — ${total} candidates, ${doneUnique} done → ${MARKER}`)
      process.exit(0)
    }
    attempts++
    if (await apiOk()) {
      console.log(`[resume] attempt ${attempts}: missing ${missing}/${total}; sweeping`)
      const st = run('pipeline/validate/validate.mjs')
      if (st !== 0) console.log(`[resume] sweep exit ${st}; retrying`)
    } else {
      console.log(`[resume] API limited; retry in ${every}s`)
      await sleep(every * 1000)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
