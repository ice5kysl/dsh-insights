#!/usr/bin/env node
/**
 * pipeline/content · weekly-backfill — 回填 dsh 发布以来的历史周报（一次性/幂等）。
 *
 * dsh 首发于 2026-08-10（@deepseek-ai/dsh 0.0.1-rc.1，W33）。本脚本为
 * 缺失的历史周生成"回填特刊"：当周新增候选/权威插件（按 created_at 归属）、
 * 当周诞生插件龙虎榜、官方版本时间线、当周队列质量概况。
 *
 * 诚实口径（每期刊头明示）：星数/下载/健康分为**当前快照**值，非当周历史值
 * （时间层快照自 2026-09-05 才开始累积，见 ROADMAP 附录A D5）。
 *
 * Output: data/weekly/YYYY-Www-dsh-生态周报.md（仅写缺失周；已有文件不覆盖）
 * Run: node pipeline/content/weekly-backfill.mjs [起始周 YYYY-Www]
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, readJsonl, readJson, loadPlugins } from '../../lib/data.mjs'

const W = PATHS.weeklyDir
mkdirSync(W, { recursive: true })

const plugins = loadPlugins()
const candidates = readJsonl(PATHS.candidatesAll).filter((c) => c.kind === 'repo')
const enrich = readJson(PATHS.enrich, [])
const enBy = new Map(enrich.map((x) => [x.full_name, x]))
const compat = readJson(PATHS.compat)

function isoWeek(d0) {
  const date = new Date(d0)
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const year = date.getUTCFullYear()
  const week = 1 + Math.round(((date - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}
function weekRange(isoWk) {
  // 周一 00:00Z → 下周一
  const m = isoWk.match(/^(\d{4})-W(\d{2})$/)
  const d = new Date(Date.UTC(+m[1], 0, 4))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1 + (+m[2] - 1) * 7)
  return [d, new Date(d.getTime() + 7 * 86400000)]
}

// dsh 官方版本时间线（npm time 字段，覆盖发布以来全部版本）
const officialVersions = (compat?.officialDsh?.versions || [])
  .map((v) => ({ version: v.version, time: v.time, prerelease: v.isPrerelease }))
  .sort((a, b) => (a.time < b.time ? -1 : 1))

const firstDsh = officialVersions[0]?.time || '2026-08-10'
const startWk = process.argv[2] || isoWeek(firstDsh.slice(0, 10) + 'T00:00:00Z')
const currentWk = isoWeek(new Date().toISOString())

function* weeksFrom(start, end) {
  let [s] = weekRange(start)
  const [e] = weekRange(end)
  while (s < e) {
    yield isoWeek(s.toISOString())
    s = new Date(s.getTime() + 7 * 86400000)
  }
}

let made = 0
for (const wk of weeksFrom(startWk, currentWk)) {
  const f = join(W, `${wk}-dsh-生态周报.md`)
  if (existsSync(f)) { console.log(`[backfill] ${wk} 已存在，跳过`); continue }
  const [ws, we] = weekRange(wk)
  const inW = (iso) => { const t = new Date(iso || 0); return t >= ws && t < we }

  const newPlugins = plugins.filter((r) => inW(r.created_at))
  const newCands = candidates.filter((c) => inW(c.created_at))
  const cumul = plugins.filter((r) => new Date(r.created_at || 0) < we).length
  const cumulCands = candidates.filter((c) => new Date(c.created_at || 0) < we).length
  const top = [...newPlugins].sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 8)
  const versions = officialVersions.filter((v) => inW(v.time))
  const grades = { A: 0, B: 0, C: 0, D: 0 }
  let sum = 0, scored = 0
  for (const r of newPlugins) {
    const e = enBy.get(r.full_name)
    if (e) { grades[e.grade] = (grades[e.grade] || 0) + 1; sum += e.score; scored++ }
  }

  const L = []
  const fmtD = (x) => `${x.getUTCFullYear()}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${String(x.getUTCDate()).padStart(2, '0')}`
  L.push(`# DSH 插件生态周报 · ${wk}（${fmtD(ws)}～${fmtD(new Date(we.getTime() - 86400000))}· 回填特刊）`)
  L.push('')
  L.push(`> 回填于 ${new Date().toISOString().slice(0, 10)} · 覆盖 ${ws.toISOString().slice(0, 10)} → ${we.toISOString().slice(0, 10)} · 由 DSH Insights（dsh-insights.com）重建`)
  L.push('>')
  L.push('> **口径说明**：本期为历史回填——「新增」按仓库创建时间归属；星数、健康分、下载为**当前快照**值（时间层快照自 2026-09-05 起才开始累积），仅用于定位，不代表当周读数。')
  L.push('')
  L.push('## 本期速览')
  L.push('')
  L.push(`- 当周新增候选仓库 **${newCands.length}**（累计 ${cumulCands}）· 其中现属权威集 **${newPlugins.length}**（累计 ${cumul}）`)
  if (scored) L.push(`- 当周诞生队列质量（当前评分）：平均 ${Math.round((sum / scored) * 10) / 10} · A ${grades.A} · B ${grades.B} · C ${grades.C} · D ${grades.D}`)
  if (versions.length) L.push(`- 官方版本发布 ${versions.length} 个：${versions.map((v) => `\`${v.version}\`（${v.time.slice(0, 10)}${v.prerelease ? '，pre' : ''}）`).join('、')}`)
  L.push('')
  if (versions.length) {
    L.push('## 官方动态（当周）')
    L.push('')
    for (const v of versions) L.push(`- \`@deepseek-ai/dsh@${v.version}\` · ${v.time.slice(0, 10)}${v.prerelease ? ' · pre-release' : ''}`)
    L.push('')
  }
  L.push('## 当周诞生 · 插件龙虎榜（按当前 ★）')
  L.push('')
  if (top.length) {
    L.push('| 插件 | 当前 ★ | 当前等级 | npm |')
    L.push('|---|---|---|---|')
    for (const r of top) {
      const e = enBy.get(r.full_name) || {}
      L.push(`| ${r.full_name} | ${r.stars || 0} | ${e.grade || '—'} | ${r.npm?.published ? r.npm.latest : '—'} |`)
    }
  } else L.push('（当周无新增权威插件记录）')
  L.push('')
  L.push('---')
  L.push('')
  L.push('> 回填特刊由 DSH Insights 基于创建时间重建 · 正式周报自 2026-W36 起每周五自动发布：https://dsh-insights.com/weekly/')
  writeFileSync(f, L.join('\n') + '\n')
  made++
  console.log(`[backfill] ${wk} ✓（新增候选 ${newCands.length} / 权威 ${newPlugins.length} / 官方版本 ${versions.length}）`)
}
console.log(`[backfill] done，新回填 ${made} 期`)
