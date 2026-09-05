#!/usr/bin/env node
/**
 * llm catch-up: prune unparsed rows and re-queue them.
 *
 * When the model returns fewer JSON lines than the batch (rare), those rows
 * were appended with null fields AND marked done — this drops the null rows
 * from data/llm.jsonl and removes their ids from state/llm.done so the next
 * `npm run llm` re-tags exactly the gaps.
 *
 * Usage: node bin/llm-catchup.mjs   (then rerun LLM with your key)
 *
 * @module dsh-plugin-insights/llm-catchup
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const LLM = join(ROOT, 'data', 'llm.jsonl')
const DONE = join(ROOT, 'data', 'state', 'llm.done')

function main() {
  const lines = readFileSync(LLM, 'utf8').split('\n').filter(Boolean)
  const rows = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const bad = rows.filter((r) => !r.category && !r.summaryZh && !r.summaryEn)
  if (!bad.length) { console.log('[llm-catchup] no unparsed rows'); return }
  const badIds = new Set(bad.map((r) => r.full_name))
  const kept = rows.filter((r) => !badIds.has(r.full_name))
  writeFileSync(LLM, kept.map((r) => JSON.stringify(r)).join('\n') + '\n')
  const doneIds = readFileSync(DONE, 'utf8').split('\n').filter(Boolean).filter((id) => !badIds.has(id))
  writeFileSync(DONE, doneIds.join('\n') + '\n')
  console.log(`[llm-catchup] pruned ${bad.length} unparsed rows & re-queued them (${kept.length} kept)`)
}

main()
