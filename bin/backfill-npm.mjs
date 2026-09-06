#!/usr/bin/env node
/**
 * dsh-insights · one-shot npm backfill (fix scoped-package mislabels)
 *
 * Before 2026-09-05 the npm probe double-encoded scoped package names, so
 * every `@scope/...` pkgName was marked unpublished. This rewrites the `npm`
 * field of affected rows using the fixed registry URL form.
 *
 * SAFETY: atomic rewrite (tmp + rename). Refuses to run while the validator
 * is appending (compares done.ids before/after). Run at snapshot time:
 *
 *   GITHUB_TOKEN="$(gh auth token)" node bin/backfill-npm.mjs
 *
 * @module dsh-insights/backfill
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { npmDoc } from '../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..')
const F = join(ROOT, 'data', 'plugins.jsonl')
const STATE = join(ROOT, 'data', 'state', 'done.ids')

function readLines(f) {
  try { return readFileSync(f, 'utf8').split('\n') } catch { return [] }
}

async function main() {
  const before = existsSync(STATE) ? readLines(STATE).filter(Boolean).length : 0
  const lines = readLines(F)
  const rows = []
  for (const l of lines) {
    if (!l.trim()) continue
    try { rows.push(JSON.parse(l)) } catch { /* tolerate */ }
  }
  const targets = rows.filter((r) => (r.pkgName || '').startsWith('@') && r.npm?.published === false)
  console.log(`[backfill:npm] ${targets.length} scoped rows to re-probe of ${rows.length} total`)
  let changed = 0
  for (const r of targets) {
    const doc = await npmDoc(r.pkgName)
    if (doc) {
      r.npm = { published: true, latest: doc.latest, versions: doc.versions, latestTime: doc.latestTime }
      changed++
    }
    // else: genuinely unpublished — leave as is
  }
  const after = existsSync(STATE) ? readLines(STATE).filter(Boolean).length : 0
  if (after !== before) {
    console.error('[backfill:npm] done.ids changed during run — validator active; aborting without write (rows re-probed but file untouched)')
    process.exit(3)
  }
  if (!changed) { console.log('[backfill:npm] nothing to fix'); return }
  const tmp = F + '.bakfill-tmp'
  writeFileSync(tmp, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  renameSync(tmp, F)
  console.log(`[backfill:npm] fixed ${changed} rows → data/plugins.jsonl (atomic)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
