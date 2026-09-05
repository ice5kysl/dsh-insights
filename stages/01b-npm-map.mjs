#!/usr/bin/env node
/**
 * Stage 01b — map npm-published dsh packages back to their GitHub repos,
 * and merge new repo candidates into a full candidate set.
 *
 * For every npm candidate (+ paginated npm search) fetch the latest manifest
 * (registry /{name}/latest) and read `repository.url`; github URLs become new
 * `repo` candidates tagged source `npm:<name>`; existing ones are noted.
 *
 * Outputs:
 *   data/npm-mapped.jsonl  — mapping rows
 *   data/candidates-all.jsonl — candidates-full (repos) + new npm→repo rows
 *
 * @module dsh-plugin-insights/stage-01b
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { NPM, raw, sleep } from '../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..')
const FULL = process.argv[2] || join(ROOT, 'data', 'candidates-full.jsonl')
const ALL = join(ROOT, 'data', 'candidates-all.jsonl')

function githubFromUrl(url) {
  if (!url) return null
  const m = String(url).match(/github\.com\/([^/]+)\/([^/#]+)/)
  if (!m) return null
  const owner = m[1], repo = m[2].replace(/\.git$/, '')
  if (!owner || !repo || owner === 'github.com') return null
  return `${owner}/${repo}`
}

async function latestManifest(name) {
  const r = await raw(`${NPM}/${encodeURIComponent(name.replace(/^@/, '%40'))}/latest`)
  if (!r.ok) return null
  return r.body
}

async function npmSearchAll(text = 'dsh deepseek-harness plugin', max = 750) {
  const out = []
  for (let from = 0; from < max; from += 250) {
    const r = await raw(`${NPM}/-/v1/search?text=${encodeURIComponent(text)}&size=250&from=${from}`)
    if (!r.ok) break
    const objs = r.body.objects || []
    out.push(...objs)
    if (objs.length < 250) break
    await sleep(200)
  }
  return out
}

async function main() {
  const lines = existsSync(FULL) ? readFileSync(FULL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  const repoIds = new Set(lines.filter((c) => c.kind === 'repo').map((c) => `${c.owner}/${c.name}`))
  const npmNames = new Set(lines.filter((c) => c.kind === 'npm').map((c) => c.name))
  const search = await npmSearchAll()
  for (const o of search) if (o.package?.name) npmNames.add(o.package.name)
  console.log(`[npm-map] ${npmNames.size} npm packages to map`)

  const mapped = []
  const added = []
  let i = 0
  for (const name of npmNames) {
    i++
    const mani = await latestManifest(name)
    const repo = githubFromUrl(mani?.repository?.url || mani?.repository)
    if (!repo) continue
    mapped.push({ kind: 'npm-map', name, repo, repository: mani.repository?.url || null, latest: mani.version || null, description: mani.description || '' })
    if (!repoIds.has(repo)) {
      const [owner, rname] = repo.split('/')
      repoIds.add(repo)
      added.push({ kind: 'repo', id: repo, source: `npm:${name}`, name: rname, owner, stars: 0, description: (mani.description || '').slice(0, 300), topics: [], archived: false, fork: false, pushed_at: null, created_at: null, default_branch: null, html_url: `https://github.com/${repo}`, npmName: name })
    }
    if (i % 50 === 0) console.log(`[npm-map] ${i}/${npmNames.size} (mapped ${mapped.length}, new repos ${added.length})`)
  }
  writeFileSync(join(ROOT, 'data', 'npm-mapped.jsonl'), mapped.map((r) => JSON.stringify(r)).join('\n') + '\n')
  const merged = [...lines.filter((c) => c.kind === 'repo'), ...added]
  writeFileSync(ALL, merged.map((r) => JSON.stringify(r)).join('\n') + '\n')
  console.log(`[npm-map] mapped ${mapped.length} → new repo candidates ${added.length}; total repos in candidates-all.jsonl: ${merged.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
