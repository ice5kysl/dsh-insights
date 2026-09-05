#!/usr/bin/env node
/**
 * Stage 11 — compatibility enrichment (M3 groundwork) → data/compat.json
 *
 * Builds the raw material for the plugin ↔ dsh-version compatibility matrix
 * WITHOUT touching the running validator (registry-only reads, no GitHub
 * budget): for every npm-published plugin in the authoritative set, read its
 * published `engines.dsh` (and dsh-related peers) from the npm registry, and
 * list official @deepseek-ai/dsh releases as the host axis.
 *
 * Outputs: data/compat.json
 *   { generatedAt, officialDsh:{latest, distTags, versions:[{version,isPrerelease,time}]},
 *     plugins:[{ pkgName, repo, stars, npmLatest, enginesDsh, dshPeers }], note }
 *
 * Caveat: engines/peers exist only for npm-published plugins; repo-only
 * plugins carry no registry signal (excluded, noted). This is a heuristic
 * compat *signal*, not a runtime test.
 *
 * @module dsh-plugin-insights/stage-11
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NPM } from '../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'data', 'plugins.jsonl')
const OUT = join(ROOT, 'data', 'compat.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function npmDocRaw(name) {
  try {
    const r = await fetch(`${NPM}/${String(name).replace(/^@/, '%40')}`, {
      headers: { 'user-agent': 'dsh-plugin-insights' },
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

function semverKey(v) {
  // rough numeric sort key for semver-ish strings
  const m = String(v).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!m) return [0, 0, 0]
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)]
}

function readRows(f) {
  const rows = []
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { /* tolerate partial append */ }
  }
  return rows
}

function main() {
  const rows = readRows(SRC)
  const published = rows.filter((r) => r.npm?.published && r.pkgName)
  const seen = new Set()
  const targets = published.filter((r) => { const k = r.pkgName; if (seen.has(k)) return false; seen.add(k); return true })
  console.log(`[compat] ${targets.length} unique published pkgNames to probe (of ${published.length} rows)`)
  return { rows, targets }
}

async function run() {
  const { rows, targets } = main()

  // official host axis
  const host = await npmDocRaw('@deepseek-ai/dsh')
  const officialDsh = host ? {
    latest: host['dist-tags']?.latest ?? null,
    distTags: host['dist-tags'] ?? {},
    versions: Object.entries(host.versions || {})
      .map(([version]) => ({ version, isPrerelease: /-/.test(version), time: host.time?.[version] ?? null }))
      .sort((a, b) => { const x = semverKey(a.version); const y = semverKey(b.version); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] })
      .slice(-60),
  } : { latest: null, distTags: {}, versions: [] }

  const plugins = []
  let i = 0
  for (const t of targets) {
    const doc = await npmDocRaw(t.pkgName)
    i++
    if (i % 100 === 0) console.log(`[compat] ${i}/${targets.length}`)
    if (!doc) continue
    const latest = doc['dist-tags']?.latest
    const v = doc.versions?.[latest] || {}
    const peers = v.peerDependencies || {}
    const dshPeers = Object.entries(peers)
      .filter(([k]) => /dsh|deepseek/i.test(k))
      .map(([k, v2]) => ({ name: k, range: String(v2) }))
    plugins.push({
      pkgName: t.pkgName,
      repo: t.full_name ?? null,
      stars: t.stars ?? 0,
      npmLatest: latest ?? null,
      enginesDsh: v.engines?.dsh ?? null,
      engines: v.engines ? Object.entries(v.engines).filter(([k]) => /dsh|deepseek/i.test(k)).map(([k, v2]) => ({ name: k, range: String(v2) })) : [],
      dshPeers,
    })
    await sleep(60) // gentle pace on the registry
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    sourceRows: rows.length,
    probed: targets.length,
    note: 'engines.dsh/dsh peers from npm registry latest publish — heuristic compat signal, not a runtime test; repo-only (unpublished) plugins excluded.',
    officialDsh,
    plugins,
  }
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n')
  const withEngines = plugins.filter((p) => p.enginesDsh || p.dshPeers.length).length
  console.log(`[compat] ${plugins.length} plugins probed, ${withEngines} declare engines.dsh or dsh peers · official dsh versions ${officialDsh.versions.length} → data/compat.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1) })
}

export { run }
