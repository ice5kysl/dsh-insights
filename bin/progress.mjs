#!/usr/bin/env node
/**
 * dsh-insights · progress & coverage CLI
 *
 * Reports how much of the candidate universe has been validated, the current
 * authoritative-set size, and (with two samples) an implied completion rate.
 *
 *   node bin/progress.mjs
 *
 * @module dsh-insights/progress
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const p = (f) => join(ROOT, 'data', f)

function main() {
  let candidates = 0
  try {
    candidates = readFileSync(p('candidates-all.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).length
  } catch { /* ignore */ }
  const repoCands = candidates // candidates-all is repo rows + few npm rows; npm rows counted as done too, fine as denominator approx

  const done = (() => { try { return readFileSync(p('state/done.ids'), 'utf8').split('\n').filter(Boolean).length } catch { return 0 } })()
  const valid = (() => { try { return readFileSync(p('plugins.jsonl'), 'utf8').split('\n').filter(Boolean).length } catch { return 0 } })()
  const invalid = (() => { try { return readFileSync(p('invalid.jsonl'), 'utf8').split('\n').filter(Boolean).length } catch { return 0 } })()
  const pct = repoCands ? Math.round((done / repoCands) * 1000) / 10 : 0
  const validPct = done ? Math.round((valid / done) * 1000) / 10 : 0

  console.log(`候选(repo 行): ${repoCands}`)
  console.log(`已校验 done:   ${done}  (${pct}%)`)
  console.log(`权威集 valid:  ${valid}  (对已校验 ${validPct}%)`)
  console.log(`无效/噪声:     ${invalid}`)
  console.log(`剩余:          ${Math.max(0, repoCands - done)}`)
}

main()
