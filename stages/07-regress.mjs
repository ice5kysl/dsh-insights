#!/usr/bin/env node
/**
 * Stage 7 — calibration regression over data/seeds.json
 *
 * Every seed is run through the live validator (02-validate) and the verdict
 * is compared against its expected outcome. Any mismatch fails the run, so a
 * future refactor of the manifest gate breaks loudly instead of silently.
 *
 * Usage: npm run regress        (requires GITHUB_TOKEN for the 5000/hr budget)
 *
 * @module dsh-insights/stage-7
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateOne } from './02-validate.mjs'

const ROOT = join(import.meta.dirname, '..')
const seeds = JSON.parse(readFileSync(join(ROOT, 'data', 'seeds.json'), 'utf8'))

let pass = 0
let fail = 0
const t0 = Date.now()

for (const s of seeds) {
  const cand = {
    kind: 'repo', id: `${s.owner}/${s.repo}`,
    owner: s.owner, repo: s.repo, name: s.repo,
    topics: s.topics || [], description: s.description || '',
    fork: false, archived: false,
  }
  try {
    const res = await validateOne(cand)
    const got = res.ok ? { valid: true } : { valid: false, reason: res.reason }
    const exp = s.expect
    let ok
    if (exp.valid) ok = got.valid
    else if (Array.isArray(exp.reasons) && exp.reasons.length) ok = !got.valid && exp.reasons.includes(got.reason)
    else ok = !got.valid
    if (ok) {
      pass++
      console.log(`  ✅ ${s.owner}/${s.repo} → ${got.valid ? 'valid' : got.reason}  (expect ${exp.valid ? 'valid' : exp.reasons?.join('|') || 'invalid'})`)
    } else {
      fail++
      console.error(`  ❌ ${s.owner}/${s.repo} → ${got.valid ? 'valid' : got.reason}  (expect ${JSON.stringify(exp)})`)
    }
  } catch (e) {
    fail++
    console.error(`  ❌ ${s.owner}/${s.repo} threw: ${e?.message}`)
  }
}

console.log(`[regress] ${pass} passed, ${fail} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
process.exit(fail ? 1 : 0)
