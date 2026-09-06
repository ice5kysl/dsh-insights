#!/usr/bin/env node
/**
 * pipeline/analyze · score — health scoring over the authoritative set (data/plugins.jsonl).
 *
 * M1: turns every validated plugin row into an explainable 0–100 health score
 * with an A–D grade, per-dimension breakdown and evidence for every deduction.
 * Module-exported so downstream stages (09 JSON export, site) reuse it.
 *
 * Design rules (see docs/SCHEMA.md §health):
 *   - purely objective signals; no community ratings, no star-based scoring.
 *   - deductions only; start at 100; warn −5 / fail −20, clamp ≥ 0.
 *   - missing data is never invented: unavailable probes are listed under
 *     `missing` and skipped (no deduction for what we could not see).
 *   - every rule bump must change RULE_VERSION and add a changelog entry.
 *
 * 唯一评分真源：analyze（enrich.json）、export-json（insights.json）、
 * badges、history 全部经 scoreAll 取分；本 stage 只落盘聚合 health.json。
 *
 * Outputs:
 *   data/health.json   aggregates (grades, avg, top deductions)
 *
 * @module dsh-insights/pipeline-analyze-score
 */

import { pathToFileURL } from 'node:url'
import { PATHS, readJsonl, writeJson, loadPlugins } from '../../lib/data.mjs'

export const RULE_VERSION = 'health-v4'

/**
 * 评估指标体系 v1（docs/SCHEMA.md §health 有完整定义与说明）。
 * 六维框架：工程质量 eng / 文档完整性 docs / 可发现性 discover / 维护活跃 maint
 * 计分；安全卫生 safety 与采用度 adoption 只展示不进分；兼容性 compat 预留。
 */
export const DIMS = {
  eng: { label: '工程质量', desc: 'bundle 规范与发布卫生' },
  docs: { label: '文档完整性', desc: '上手材料与许可' },
  discover: { label: '可发现性', desc: '被找到的能力（topic/收录）' },
  maint: { label: '维护活跃', desc: '存活与持续维护信号' },
}
const DIM_OF = {
  'manifest.no-client-export': 'eng',
  'manifest.not-lib-main': 'eng',
  'manifest.no-files-whitelist': 'eng',
  'npm.unpublished': 'eng',
  'npm.version-drift': 'eng',
  'docs.no-readme': 'docs',
  'docs.zh-missing': 'docs',
  'repo.no-license': 'docs',
  'repo.no-dsh-topic': 'discover',
  'repo.sparse-topics': 'discover',
  'activity.too-young': 'maint',
  'activity.dormant': 'maint',
  'npm.single-release': 'maint',
  'npm.release-stale': 'maint',
  'eng.no-tests': 'eng',
  'eng.no-ci': 'eng',
  'docs.no-docs-dir': 'docs',
  'docs.no-description': 'docs',
  'docs.tiny-readme': 'docs',
}

/** 扣分档：fail −20 / major −10 / warn −5 / minor −2 */
export const SEV_PENALTY = { fail: 20, major: 10, warn: 5, minor: 2 }

/** Deduction book: code → { sev: 'warn'|'fail', label } */
export const RULES = {
  // fail −20
  'docs.no-readme': { sev: 'fail', label: '无 README' },
  // major −10
  'npm.unpublished': { sev: 'major', label: '未发布到 npm（无法一键安装，核心可用性）' },
  // warn −5
  'manifest.no-client-export': { sev: 'warn', label: 'exports["./client"] 缺失（Web 客户端入口）' },
  'npm.version-drift': { sev: 'warn', label: 'npm latest 与仓库版本不一致（含抢注/错配可能）' },
  'npm.release-stale': { sev: 'warn', label: 'npm 发布停滞超 90 天' },
  'docs.zh-missing': { sev: 'warn', label: '无中文文档（生态惯例 zh/双语）' },
  'docs.no-description': { sev: 'warn', label: '仓库无描述（发现页第一印象）' },
  'repo.no-license': { sev: 'warn', label: '无 LICENSE 文件/许可声明' },
  'repo.no-dsh-topic': { sev: 'warn', label: '未打 dsh-plugin topic（可发现性）' },
  'activity.too-young': { sev: 'warn', label: '仓库不足 1 天（存活未知）' },
  'activity.dormant': { sev: 'warn', label: '超 30 天无提交（维护停滞风险）' },
  'eng.no-tests': { sev: 'warn', label: '无测试目录/测试文件（工程成熟度）' },
  // minor −2
  'manifest.not-lib-main': { sev: 'minor', label: 'main 不是 lib/index.js（产物布局非常规）' },
  'manifest.no-files-whitelist': { sev: 'minor', label: 'package.json 无 files 白名单（发布卫生）' },
  'repo.sparse-topics': { sev: 'minor', label: 'topics 过少（<2，可发现面窄）' },
  'npm.single-release': { sev: 'minor', label: 'npm 仅 1 个发布版本（迭代深度不足）' },
  'eng.no-ci': { sev: 'minor', label: '无 CI workflow（.github/workflows）' },
  'docs.no-docs-dir': { sev: 'minor', label: '无 docs/ 目录（文档深度不足）' },
  'docs.tiny-readme': { sev: 'minor', label: 'README 过短（<400 字节，信息量不足）' },
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
      if ((npm.versions || 0) === 1) warn('npm.single-release', { versions: 1 })
      if (npm.latestTime && (Date.now() - new Date(npm.latestTime).getTime()) > 90 * 86400000) {
        warn('npm.release-stale', { latestTime: npm.latestTime })
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
    if (files.readme && typeof files.readmeBytes === 'number' && files.readmeBytes < 400) {
      warn('docs.tiny-readme', { readmeBytes: files.readmeBytes })
    }
  } else if (!files) missing.push('files')
  if (typeof r.description === 'string' && !r.description.trim()) {
    warn('docs.no-description', { description: '' })
  }
  // 工程成熟度 / 文档深度（树探测字段随 backfill 落地；探测不到不扣）
  if (files && typeof files.hasTests === 'boolean' && files.hasTests === false) warn('eng.no-tests', { hasTests: false })
  if (files && typeof files.hasCI === 'boolean' && files.hasCI === false) warn('eng.no-ci', { hasCI: false })
  if (files && typeof files.hasDocsDir === 'boolean' && files.hasDocsDir === false) warn('docs.no-docs-dir', { hasDocsDir: false })

  // repo hygiene
  if (files) {
    if (files.license === false) warn('repo.no-license', { licenseFile: false })
  }
  if (Array.isArray(r.topics) && r.topics.length > 0 && !r.topics.includes('dsh-plugin')) {
    warn('repo.no-dsh-topic', { topics: r.topics.slice(0, 6) })
  } else if (!Array.isArray(r.topics)) missing.push('topics')
  if (Array.isArray(r.topics) && r.topics.length === 1) {
    warn('repo.sparse-topics', { topics: r.topics })
  }

  // activity
  // too-young means 'survivability unknown': a repo <1 day old. It does NOT
  // apply to plugins with >=2 published npm versions — a release history is
  // survivability evidence (re-created/migrated repos are the common case).
  const matureShip = npm?.published === true && (npm.versions || 0) >= 2
  if (met) {
    if (met.ageGate1 === false && !matureShip) warn('activity.too-young', { ageDays: met.ageDays ?? null, npmVersions: npm?.versions ?? null })
    if (met.active30 === false) warn('activity.dormant', { idleDays: met.idleDays ?? null })
  } else missing.push('metrics')

  const penalty = drops.reduce((s, d) => s + (SEV_PENALTY[d.sev] || 5), 0)
  const score = Math.max(0, 100 - penalty)
  const grade = score >= 95 ? 'S' : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'

  const byDim = {}
  const dimPenalty = {}
  for (const d of drops) {
    const dim = d.code.split('.')[0]
    ;(byDim[dim] ??= []).push(d)
    const fd = DIM_OF[d.code]
    if (fd) dimPenalty[fd] = (dimPenalty[fd] || 0) + (SEV_PENALTY[d.sev] || 5)
  }
  const dimScores = Object.fromEntries(
    Object.keys(DIMS).map((k) => [k, Math.max(0, 100 - (dimPenalty[k] || 0))])
  )

  return {
    score,
    grade,
    ruleVersion: RULE_VERSION,
    at: new Date().toISOString(),
    dims: byDim,
    dimScores,
    drops,
    missing: [...new Set(missing)],
  }
}

export function scoreAll(rows) {
  const out = rows.map((r) => ({ ...r, health: scoreOne(r) }))
  const grades = { S: 0, A: 0, B: 0, C: 0, D: 0 }
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
  const rows = loadPlugins()
  const { out, summary } = scoreAll(rows)
  writeJson(PATHS.health, summary, true)
  console.log(`[score] ${out.length} rows · ${JSON.stringify(summary.grades)} · avg ${summary.avg} · median ${summary.median} · rule ${RULE_VERSION}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
