#!/usr/bin/env node
/**
 * Stage 8 — health scoring over the authoritative set (data/plugins.jsonl).
 *
 * M1: turns every validated plugin row into an explainable 0–100 health score
 * with an A–D grade, per-dimension breakdown and evidence for every deduction.
 * Module-exported so downstream stages (09 JSON export, site) reuse it.
 *
 * Design rules (see docs/schema.md §health):
 *   - purely objective signals; no community ratings, no star-based scoring.
 *   - deductions only; start at 100; warn −5 / fail −20, clamp ≥ 0.
 *   - missing data is never invented: unavailable probes are listed under
 *     `missing` and skipped (no deduction for what we could not see).
 *   - every rule bump must change RULE_VERSION and add a changelog entry.
 *
 * Outputs:
 *   data/scored.jsonl  plugins rows + `health` object (join key full_name)
 *   data/health.json   aggregates (grades, avg, top deductions)
 *
 * @module dsh-insights/stage-8
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'data', 'plugins.jsonl')
const OUT = join(ROOT, 'data', 'scored.jsonl')
const SUMMARY = join(ROOT, 'data', 'health.json')

export const RULE_VERSION = 'health-v2'

/** Deduction book: code → { sev: 'warn'|'fail', label } */
export const RULES = {
  // manifest shape
  'manifest.no-client-export': { sev: 'warn', label: 'exports["./client"] 缺失（Web 客户端入口）' },
  'manifest.not-lib-main': { sev: 'warn', label: 'main 不是 lib/index.js（产物布局非常规）' },
  'manifest.no-files-whitelist': { sev: 'warn', label: 'package.json 无 files 白名单（发布卫生）' },
  // npm
  'npm.unpublished': { sev: 'warn', label: '未发布到 npm（仅仓库安装）' },
  'npm.version-drift': { sev: 'warn', label: 'npm latest 与仓库版本不一致（含抢注/错配可能）' },
  // docs
  'docs.no-readme': { sev: 'fail', label: '无 README' },
  'docs.zh-missing': { sev: 'warn', label: '无中文文档（生态惯例 zh/双语）' },
  // repo hygiene
  'repo.no-license': { sev: 'warn', label: '无 LICENSE 文件/许可声明' },
  'repo.no-dsh-topic': { sev: 'warn', label: '未打 dsh-plugin topic（可发现性）' },
  // activity
  'activity.too-young': { sev: 'warn', label: '仓库不足 1 天（存活未知）' },
  'activity.dormant': { sev: 'warn', label: '超 30 天无提交（维护停滞风险）' },
}

export function scoreOne(r) {
  const drops = []
  const missing = []
  const add = (code, evidence) => {
    const rule = RULES[code]
    if (!rule) throw new Error(`unknown rule ${code}`)
    drops.push({ code, sev: rule.sev, label: rule.label, evidence: evidence ?? null })
  }
  const warn = (code, ev) => add(code, ev)

  const files = r.files ?? null
  const evl = r.eval ?? null
  const npm = r.npm ?? null
  const met = r.metrics ?? null

  // manifest
  if (evl && typeof evl.hasClientExport === 'boolean') {
    if (evl.hasClientExport === false) warn('manifest.no-client-export', { hasClientExport: false })
  } else missing.push('manifest')
  if (evl && typeof evl.mainIsLib === 'boolean') {
    if (evl.mainIsLib === false) warn('manifest.not-lib-main', { mainIsLib: false })
  }
  if (evl) {
    if (evl.filesWhitelist == null) warn('manifest.no-files-whitelist', { filesWhitelist: null })
  }

  // npm
  if (npm) {
    if (npm.published === false) {
      warn('npm.unpublished', { pkgName: r.pkgName ?? null })
    } else if (npm.published === true) {
      if (npm.latest && r.version && npm.latest !== r.version) {
        warn('npm.version-drift', { repo: r.version, npm: npm.latest, versions: npm.versions ?? null })
      }
    } else missing.push('npm')
  } else missing.push('npm')

  // docs
  if (files && typeof files.readme === 'boolean') {
    if (files.readme === false) {
      warn('docs.no-readme', { readme: false })
    } else if (met && met.hasZhDocs === false) {
      warn('docs.zh-missing', { hasZhDocs: false })
    }
  } else if (!files) missing.push('files')

  // repo hygiene
  if (files) {
    if (files.license === false) warn('repo.no-license', { licenseFile: false })
  }
  if (Array.isArray(r.topics) && r.topics.length > 0 && !r.topics.includes('dsh-plugin')) {
    warn('repo.no-dsh-topic', { topics: r.topics.slice(0, 6) })
  } else if (!Array.isArray(r.topics)) missing.push('topics')

  // activity
  // too-young means 'survivability unknown': a repo <1 day old. It does NOT
  // apply to plugins with >=2 published npm versions — a release history is
  // survivability evidence (re-created/migrated repos are the common case).
  const matureShip = npm?.published === true && (npm.versions || 0) >= 2
  if (met) {
    if (met.ageGate1 === false && !matureShip) warn('activity.too-young', { ageDays: met.ageDays ?? null, npmVersions: npm?.versions ?? null })
    if (met.active30 === false) warn('activity.dormant', { idleDays: met.idleDays ?? null })
  } else missing.push('metrics')

  const penalty = drops.reduce((s, d) => s + (d.sev === 'fail' ? 20 : 5), 0)
  const score = Math.max(0, 100 - penalty)
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'

  const byDim = {}
  for (const d of drops) {
    const dim = d.code.split('.')[0]
    ;(byDim[dim] ??= []).push(d)
  }

  return {
    score,
    grade,
    ruleVersion: RULE_VERSION,
    at: new Date().toISOString(),
    dims: byDim,
    drops,
    missing: [...new Set(missing)],
  }
}

function readRows(f) {
  const rows = []
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { /* tolerate trailing partial appends */ }
  }
  return rows
}

export function scoreAll(rows) {
  const out = rows.map((r) => ({ ...r, health: scoreOne(r) }))
  const grades = { A: 0, B: 0, C: 0, D: 0 }
  let sum = 0
  const dropCounter = {}
  for (const r of out) {
    grades[r.health.grade]++
    sum += r.health.score
    for (const d of r.health.drops) dropCounter[d.code] = (dropCounter[d.code] ?? 0) + 1
  }
  const sorted = [...out].sort((a, b) => b.health.score - a.health.score)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)].health.score : 0
  const summary = {
    generatedAt: new Date().toISOString(),
    ruleVersion: RULE_VERSION,
    total: out.length,
    grades,
    avg: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
    median,
    topDeductions: Object.entries(dropCounter).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([code, count]) => ({ code, count, pct: Math.round((count / Math.max(1, rows.length)) * 1000) / 10 })),
  }
  return { out, summary }
}

function main() {
  const rows = readRows(SRC)
  const { out, summary } = scoreAll(rows)
  writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(SUMMARY, JSON.stringify(summary, null, 2) + '\n')
  console.log(`[score] ${out.length} rows · ${JSON.stringify(summary.grades)} · avg ${summary.avg} · median ${summary.median} · rule ${RULE_VERSION}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
