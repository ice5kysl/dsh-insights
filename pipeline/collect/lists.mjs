#!/usr/bin/env node
/**
 * pipeline/collect · lists — fetch membership of curated plugin directories (channels).
 *
 * Stores data/listed.json:
 *   { fetchedAt, awesome: ["owner/repo", ...], imsai: [...], dshpluginTopic: true }
 *
 * @module dsh-insights/stage-00
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ghApi } from '../../lib/api.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

async function listDir(owner, repo, path) {
  const out = []
  const r = await ghApi(`/repos/${owner}/${repo}/contents/${path}`)
  if (!r.ok) return out
  for (const it of r.body || []) if (typeof it.name === 'string') out.push(it.name)
  return out
}

function toRepo(filename) {
  const base = filename.replace(/\.(yml|json)$/, '').split('__').join('/').split('--').join('/')
  return base.includes('/') ? base : null
}

async function main() {
  const awesome = (await listDir('awesome-dsh-plugin', 'awesome-dsh-plugin', 'data/plugins')).map(toRepo).filter(Boolean)
  const imsai = (await listDir('imsai-sh', 'awesome-deepseek-harness-plugins', 'catalog/plugins')).map(toRepo).filter(Boolean)
  writeFileSync(join(ROOT, 'data', 'listed.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), awesome, imsai }, null, 2))
  console.log(`[lists] awesome ${awesome.length} · imsai ${imsai.length} → data/listed.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
