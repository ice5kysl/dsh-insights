#!/usr/bin/env node
/**
 * pipeline/collect · lists — fetch membership of curated plugin directories (channels).
 *
 * Stores data/listed.json:
 *   { fetchedAt, awesome: ["owner/repo", ...], imsai: [...], dshpluginTopic: true }
 *
 * @module dsh-insights/stage-00
 */

import { join } from 'node:path'
import { ghApi } from '../../lib/api.mjs'
import { writeJson } from '../../lib/data.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

async function listDir(owner, repo, path) {
  async function readTree(ref) {
    const r = await ghApi(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}`)
    if (!r.ok) throw new Error(`[lists] ${owner}/${repo} tree ${ref}: HTTP ${r.status}`)
    if (r.body?.truncated !== false || !Array.isArray(r.body.tree)) {
      throw new Error(`[lists] ${owner}/${repo} tree ${ref}: incomplete or malformed response`)
    }
    for (const entry of r.body.tree) {
      if (!entry || typeof entry.path !== 'string' || !entry.path ||
          !['blob', 'tree', 'commit'].includes(entry.type) || typeof entry.sha !== 'string' || !entry.sha) {
        throw new Error(`[lists] ${owner}/${repo} tree ${ref}: malformed entry`)
      }
    }
    return r.body.tree
  }

  // Contents caps directories at 1,000 entries. Walk non-recursive trees by
  // SHA so all path segments belong to the same HEAD snapshot.
  let entries = await readTree('HEAD')
  for (const segment of path.split('/')) {
    const dir = entries.find((entry) => entry.path === segment && entry.type === 'tree')
    if (!dir) throw new Error(`[lists] ${owner}/${repo}: missing directory ${path}`)
    entries = await readTree(dir.sha)
  }
  return entries.filter((entry) => entry.type === 'blob').map((entry) => entry.path)
}

function toRepo(filename, pattern) {
  const match = filename.match(pattern)
  return match ? `${match[1]}/${match[2]}` : null
}

async function main() {
  const awesome = (await listDir('awesome-dsh-plugin', 'awesome-dsh-plugin', 'data/plugins'))
    .map((name) => toRepo(name, /^([a-z\d-]+)__([\w.-]+)\.yml$/i)).filter(Boolean)
  const imsai = (await listDir('imsai-sh', 'awesome-deepseek-harness-plugins', 'catalog/plugins'))
    .map((name) => toRepo(name, /^([a-z\d-]+?)--([\w.-]+)\.json$/i)).filter(Boolean)
  // Publish only after both catalogs were collected completely.
  writeJson(join(ROOT, 'data', 'listed.json'), { fetchedAt: new Date().toISOString(), awesome, imsai }, true)
  console.log(`[lists] awesome ${awesome.length} · imsai ${imsai.length} → data/listed.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
