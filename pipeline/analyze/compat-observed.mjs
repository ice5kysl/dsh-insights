#!/usr/bin/env node
/**
 * pipeline/analyze · compat-observed — 全语料库「实测兼容」矩阵 → data/compat-observed.json
 *
 * 对权威集（data/insights.json）中每个已发布 npm 的插件，取其最新版 tarball，
 * 找到 client bundle（package.json exports["./client"]，否则惯例 lib/client.js），
 * 静态提取 require("X") 字面量集合，逐「当前相关 shell 版本」判定可加载性：
 *
 *   require 词 X 可解析 ⟺ X ∈ 该 shell 版本 seed 词表（data/shell-seeds.json）
 *     ∨ stripClientSuffix(X) = 插件自身包名
 *     ∨ stripClientSuffix(X) ∈ 语料库已知插件包名（图行近似——如实记录口径：
 *       真实图行 = composition 里有 dsh.client 面的包，语料库包名是下限近似，
 *       未含 dsh 内置的非 seed 包）
 *
 *   守卫感知（2026-09 假阳性修正）：dsh 官方 loader（@deepseek-ai/dsh-client-modules）
 *   的 require 是调用时解析——factory 体执行到 require() 才查表，try/catch 可兜住
 *   「missed the module table」错误。故提取时给每个 require 标注守卫上下文
 *   （花括号配对识别 try{...}catch{...}，跳过字符串/模板/注释/正则字面量）：
 *     unguarded（不在任何配对 try/catch 内；try 无 catch 视同 unguarded——异常穿透）
 *     in-try（在有配对 catch 的 try 块内）/ in-catch（在 catch 块内）
 *   每版本判定：unguarded missing 非空 → broken（现状不变）；否则逐 try/catch 对
 *   求值——try 块 require 全部可解析 → 该对 OK；try 有 missing → 看 catch：
 *   catch 块 require 全部可解析（含空 catch，优雅降级）→ OK（兜底路径可用）；
 *   catch 也有 missing → broken。全部通过 → ok。
 *   典型：dsh-dream-skin 的 try(store)/catch(runtime-client) 双代宿主兼容写法，
 *   旧口径误判全版本 never，守卫感知后 supported-since 0.1.2-alpha.2（store 入表版本）。
 *
 * 判定轴（dshVersions）：shell-seeds.json distTags 的 latest/next/alpha 去重，
 * 作为详情页展示矩阵。另有 verdict：跨 shell-seeds 全部已发布版本（semver 序）
 * 的纯集合运算判定——ok（全部可加载）/ never（从发布起即崩）/ broken-since X
 * （X 起崩，此前可用）/ supported-since X（X 起才可加载，shell 后来补了模块）/
 * mixed（反复横跳，理论上不该出现）。outreach 话术与详情页「崩于何时」据此。
 * 没有 client bundle 的插件不进结果（不是 ok）；下载/解析失败跳过并计数。
 *
 * 提取器移植自 dsh-insights-kit src/host/shell.ts（extractRequires 排除模板串
 * require——dsh-better-sidebar 的 require(`${spec}`) 教训：静态不可判定，不报假 missing）。
 *
 * 网络礼节：并发 ≤8、每包 30s 超时；tarball URL 按 npm 惯例
 *   https://registry.npmjs.org/<name>/-/<basename>-<version>.tgz（scoped 取 / 后段）。
 * 增量：按 pkg@version 缓存提取结果于 data/compat-observed-cache.json（data/ 根、入 git——
 *   state/ 目录被 gitignore，放这里 CI 的 `git add data/` 才能带上缓存，daily 跑矩阵才是增量成本）
 * （gitignore 的 data/state/ 惯例），版本不变零网络。缓存条目含 requiresV2
 * （守卫上下文）；旧条目缺失时：全版本无 missing 的原位升级（守卫不影响全 ok
 * 结论），有 missing 的重抓 bundle 提取守卫，重抓失败沿用旧口径结论保底。
 *
 * Usage: node pipeline/analyze/compat-observed.mjs [--limit N] [--only pkg1,pkg2]
 *
 * @module dsh-insights/pipeline-analyze-compat-observed
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NPM } from '../../lib/api.mjs'
import { DATA, PATHS, readJson, writeJson } from '../../lib/data.mjs'

const CACHE = join(DATA, 'compat-observed-cache.json')
const CONCURRENCY = 8
const PER_PKG_TIMEOUT = 30_000

/** client bundle 的外部 require 说明符（去重、按出现序；模板串/动态 require 排除）。 */
export function extractRequires(bundleText) {
  const seen = new Set()
  const pattern = /\b__require\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g
  let match
  while ((match = pattern.exec(bundleText)) !== null) {
    const spec = match[1] ?? match[2]
    if (!spec.includes('${')) seen.add(spec)
  }
  return [...seen]
}

const IDENT = /[A-Za-z0-9_$]/

/**
 * 花括号配对扫描：识别 try{...}catch{...} 对，返回各对的 try/catch 内容区间
 * （不含花括号本身）。跳过字符串/模板字面量（含 ${} 嵌套表达式）/行块注释/正则字面量，
 * 避免其中的花括号或 try/catch 字样干扰配对。try 无配对 catch（裸 try / try-finally）
 * 不产出对——异常穿透，内容按 unguarded 处理。EOF 时未闭合的对丢弃（保守：按 unguarded）。
 */
function scanTryCatchPairs(text) {
  const pairs = []
  const stack = [] // { kind: 'block'|'try'|'catch'|'tpl-expr', contentStart, pairId? }
  const n = text.length
  let i = 0
  let state = 'code' // code | str | tpl | line | block | regex | regex-class
  let quote = ''
  let prevSig = '' // 上一个有效字符（正则 vs 除法启发）
  let prevWord = '' // 上一个标识符词（return /re/ 等场景）

  const skipWsComments = (j) => {
    while (j < n) {
      const c = text[j]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v') { j++; continue }
      if (c === '/' && text[j + 1] === '/') { const e = text.indexOf('\n', j); j = e < 0 ? n : e + 1; continue }
      if (c === '/' && text[j + 1] === '*') { const e = text.indexOf('*/', j + 2); j = e < 0 ? n : e + 2; continue }
      break
    }
    return j
  }

  while (i < n) {
    const c = text[i]
    if (state === 'code') {
      if (c === '_' || c === '$' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
        let j = i + 1
        while (j < n && IDENT.test(text[j])) j++
        const w = text.slice(i, j)
        if (w === 'try') {
          const k = skipWsComments(j)
          if (text[k] === '{') {
            stack.push({ kind: 'try', contentStart: k + 1 })
            prevSig = '{'; prevWord = ''
            i = k + 1
            continue
          }
        }
        prevWord = w
        prevSig = w[w.length - 1]
        i = j
        continue
      }
      if (c === "'" || c === '"') { state = 'str'; quote = c; i++; continue }
      if (c === '`') { state = 'tpl'; i++; continue }
      if (c === '/') {
        const nx = text[i + 1]
        if (nx === '/') { state = 'line'; i += 2; continue }
        if (nx === '*') { state = 'block'; i += 2; continue }
        const regexAllowed = !prevSig || '([{,;:!&|?+-*%^~<>='.includes(prevSig) ||
          ['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'else', 'do', 'yield', 'await', 'instanceof'].includes(prevWord)
        if (regexAllowed) { state = 'regex'; i++; continue }
        prevSig = '/'; prevWord = ''; i++; continue
      }
      if (c === '{') { stack.push({ kind: 'block' }); prevSig = '{'; prevWord = ''; i++; continue }
      if (c === '}') {
        const top = stack.pop()
        if (top?.kind === 'tpl-expr') { state = 'tpl'; i++; continue } // ${} 结束，回到模板串
        if (top?.kind === 'try') {
          let j = skipWsComments(i + 1)
          if (text.startsWith('catch', j) && !IDENT.test(text[j + 5] || '')) {
            j = skipWsComments(j + 5)
            if (text[j] === '(') { // catch 参数（可含解构花括号/默认字符串）：平衡跳到配对 )
              let depth = 0
              while (j < n) {
                const ch = text[j]
                if (ch === "'" || ch === '"') { const q = ch; j++; while (j < n && text[j] !== q) j += text[j] === '\\' ? 2 : 1; j++; continue }
                if (ch === '(') depth++
                else if (ch === ')') { depth--; if (!depth) { j++; break } }
                j++
              }
              j = skipWsComments(j)
            }
            if (text[j] === '{') {
              const pairId = pairs.length
              pairs.push({ tryStart: top.contentStart, tryEnd: i, catchStart: j + 1, catchEnd: null })
              stack.push({ kind: 'catch', pairId })
              prevSig = '{'; prevWord = ''
              i = j + 1
              continue
            }
          }
          prevSig = '}'; prevWord = ''; i++; continue // 无 catch：finally/裸 try，不成对
        }
        if (top?.kind === 'catch') {
          pairs[top.pairId].catchEnd = i
          prevSig = '}'; prevWord = ''; i++; continue
        }
        prevSig = '}'; prevWord = ''; i++; continue
      }
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
      prevSig = c
      prevWord = ''
      i++
      continue
    }
    if (state === 'str') {
      if (c === '\\') { i += 2; continue }
      if (c === quote) { state = 'code'; prevSig = quote; prevWord = '' }
      i++
      continue
    }
    if (state === 'tpl') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { state = 'code'; prevSig = '`'; prevWord = ''; i++; continue }
      if (c === '$' && text[i + 1] === '{') { stack.push({ kind: 'tpl-expr' }); state = 'code'; i += 2; continue }
      i++
      continue
    }
    if (state === 'line') {
      if (c === '\n') state = 'code'
      i++
      continue
    }
    if (state === 'block') {
      if (c === '*' && text[i + 1] === '/') { state = 'code'; i += 2; continue }
      i++
      continue
    }
    if (state === 'regex') {
      if (c === '\\') { i += 2; continue }
      if (c === '[') { state = 'regex-class'; i++; continue }
      if (c === '/') { state = 'code'; prevSig = '/'; prevWord = ''; i++; continue }
      if (c === '\n') { state = 'code'; i++; continue } // 未终止正则：防御性回到 code
      i++
      continue
    }
    if (state === 'regex-class') {
      if (c === '\\') { i += 2; continue }
      if (c === ']') state = 'regex'
      i++
      continue
    }
  }
  return pairs.filter((p) => p.catchEnd != null)
}

/**
 * extractRequires 的守卫感知版：requires 与旧提取器完全一致（同 regex、同模板串排除），
 * requiresV2 额外标注每个 require 的守卫上下文——
 *   { spec, guard: 'unguarded' }                    不在任何配对 try/catch 内
 *   { spec, guard: 'in-try',  pair: <id> }          在有配对 catch 的 try 块内
 *   { spec, guard: 'in-catch', pair: <id> }         在该对的 catch 块内
 * 同一 spec 在不同守卫上下文多次出现时按上下文分别保留（pair id 为单次扫描的分组键，
 * 按 try 闭合顺序分配，仅自洽于本次扫描的 requiresV2 内部）。
 */
export function extractRequiresV2(bundleText) {
  const pairs = scanTryCatchPairs(bundleText)
  const regions = []
  for (const [id, p] of pairs.entries()) {
    regions.push({ start: p.tryStart, end: p.tryEnd, kind: 'in-try', pair: id })
    regions.push({ start: p.catchStart, end: p.catchEnd, kind: 'in-catch', pair: id })
  }
  const seenFlat = new Set()
  const seenV2 = new Set()
  const requires = []
  const requiresV2 = []
  const pattern = /\b__require\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g
  let match
  while ((match = pattern.exec(bundleText)) !== null) {
    const spec = match[1] ?? match[2]
    if (spec.includes('${')) continue
    if (!seenFlat.has(spec)) { seenFlat.add(spec); requires.push(spec) }
    let best = null // 内层优先：含该位置且 start 最大的区域
    for (const rg of regions) {
      if (match.index >= rg.start && match.index < rg.end && (!best || rg.start > best.start)) best = rg
    }
    const key = best ? `${spec} ${best.kind} ${best.pair}` : `${spec} `
    if (seenV2.has(key)) continue
    seenV2.add(key)
    requiresV2.push(best ? { spec, guard: best.kind, pair: best.pair } : { spec, guard: 'unguarded' })
  }
  return { requires, requiresV2 }
}

/** 与 dsh-client-modules 一致："pkg/client" 形式的 require 解析到 "pkg"。 */
export function stripClientSuffix(spec) {
  return spec.endsWith('/client') ? spec.slice(0, -'/client'.length) : spec
}

/** 精简 semver 比较：数值段逐位比，预发布段 tag 字典序（alpha < beta < rc）后比编号；正式版 > 预发布。 */
export function compareShellVersions(a, b) {
  const [ma, pa] = a.split('-'), [mb, pb] = b.split('-')
  const na = ma.split('.').map(Number), nb = mb.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (na[i] !== nb[i]) return na[i] - nb[i]
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  const [ta, na2] = pa.split('.'), [tb, nb2] = pb.split('.')
  if (ta !== tb) return ta < tb ? -1 : 1
  return (Number(na2) || 0) - (Number(nb2) || 0)
}

/** 单 require 在某 shell 版本下的可解析性（seed 词表 ∪ 自身包名 ∪ 图行近似）。 */
function resolvable(spec, seed, pkgName, knownPkgs) {
  return seed.has(spec) || stripClientSuffix(spec) === pkgName || knownPkgs.has(stripClientSuffix(spec))
}

/**
 * 守卫感知的单版本判定：
 *   unguarded missing 非空 → broken（loader 启动路径上必崩）；
 *   否则逐 try/catch 对求值——try 全部可解析 → OK（catch 不执行）；try 有 missing →
 *   catch 全部可解析（含空 catch＝优雅降级）→ OK（兜底路径可用）；catch 也 missing → broken。
 * 返回 { status: 'ok' } | { status: 'broken', missing }——missing 含 unguarded miss
 * 及崩坏对两侧的 miss（ok 版本不记 missing：被守卫兜住的 require 不是缺陷）。
 */
function statusFor(requiresV2, seed, pkgName, knownPkgs) {
  const hardMissing = []
  const pairMiss = new Map() // pair -> { try: [], catch: [] }
  for (const r of requiresV2) {
    if (resolvable(r.spec, seed, pkgName, knownPkgs)) continue
    if (r.guard === 'unguarded') hardMissing.push(r.spec)
    else {
      const e = pairMiss.get(r.pair) || { try: [], catch: [] }
      e[r.guard === 'in-try' ? 'try' : 'catch'].push(r.spec)
      pairMiss.set(r.pair, e)
    }
  }
  if (hardMissing.length) return { status: 'broken', missing: hardMissing }
  const missing = []
  for (const e of pairMiss.values()) {
    if (!e.try.length) continue
    if (!e.catch.length) continue
    missing.push(...e.try, ...e.catch)
  }
  return missing.length ? { status: 'broken', missing } : { status: 'ok' }
}
export { statusFor }

/**
 * 全版本判定：requiresV2 在按 semver 排序的全部 shell 版本上逐一跑守卫感知判定，
 * 依 ok/broken 序列的形态分类。seed 变更史上只有单调删（0.1.0-rc.8）与单调加，
 * 故正常只会出现 ok / never / broken-since / supported-since；mixed 如实记录。
 */
function verdictFor(requiresV2, pkgName, allVersions, seedAll, knownPkgs) {
  const okOn = [], brokenOn = []
  for (const v of allVersions) {
    ;(statusFor(requiresV2, seedAll.get(v), pkgName, knownPkgs).status === 'ok' ? okOn : brokenOn).push(v)
  }
  const total = allVersions.length
  if (!brokenOn.length) return { cls: 'ok', total }
  if (!okOn.length) return { cls: 'never', total }
  // 严格前后缀判定，防止反复横跳被误分类（横跳落 mixed 如实呈现）
  if (compareShellVersions(okOn[okOn.length - 1], brokenOn[0]) < 0) {
    return { cls: 'broken-since', since: brokenOn[0], okUntil: okOn[okOn.length - 1], total }
  }
  if (compareShellVersions(brokenOn[brokenOn.length - 1], okOn[0]) < 0) {
    return { cls: 'supported-since', since: okOn[0], total }
  }
  return { cls: 'mixed', okOn, brokenOn, total }
}

function tarballUrl(name, version) {
  const base = name.startsWith('@') ? name.split('/')[1] : name
  return `${NPM}/${name}/-/${base}-${version}.tgz`
}

/** exports["./client"] 解析为包内相对路径（string 或 conditions 对象；对齐 kit：import ?? default）。 */
function clientEntryPath(pkgJson) {
  const client = pkgJson?.exports?.['./client']
  const rel = typeof client === 'string'
    ? client
    : client && typeof client === 'object'
      ? client.import ?? client.default ?? null
      : null
  if (typeof rel !== 'string' || rel === '') return null
  const norm = rel.replace(/^\.\//, '')
  return norm.startsWith('../') || norm.startsWith('/') ? null : norm
}

/**
 * 下载 pkg@version 的 tarball，提取 client bundle 的 require 集合（含守卫上下文）。
 * 返回 { requires, requiresV2, client } | { noClient: true }；失败抛错（调用方计数，不缓存）。
 */
async function probePackage(name, version, workDir) {
  const safe = name.replace(/[@/]/g, '_')
  const tgz = join(workDir, `${safe}-${version}.tgz`)
  const xdir = join(workDir, `${safe}-${version}`)
  const r = await fetch(tarballUrl(name, version), {
    headers: { 'user-agent': 'dsh-insights' },
    signal: AbortSignal.timeout(PER_PKG_TIMEOUT),
  })
  if (!r.ok) throw new Error(`http ${r.status}`)
  writeFileSync(tgz, Buffer.from(await r.arrayBuffer()))
  try {
    mkdirSync(xdir, { recursive: true })
    // 两阶段解包：先只取 package.json 定位 client bundle，再只取该文件（省 IO）
    execFileSync('tar', ['-xzf', tgz, '-C', xdir, 'package/package.json'])
    const pkgJson = JSON.parse(readFileSync(join(xdir, 'package', 'package.json'), 'utf8').replace(/^﻿/, ''))
    let client = clientEntryPath(pkgJson)
    if (!client) {
      // 惯例路径：lib/client.js（有 dsh.client 声明但无 exports["./client"] 的包；探测失败是预期分支，静音 stderr）
      try {
        execFileSync('tar', ['-xzf', tgz, '-C', xdir, 'package/lib/client.js'], { stdio: ['ignore', 'ignore', 'ignore'] })
        client = 'lib/client.js'
      } catch { /* no conventional bundle either */ }
    }
    if (!client) return { noClient: true }
    if (!existsSync(join(xdir, 'package', client))) {
      try { execFileSync('tar', ['-xzf', tgz, '-C', xdir, `package/${client}`], { stdio: ['ignore', 'ignore', 'ignore'] }) } catch { /* declared but not packed */ }
    }
    if (!existsSync(join(xdir, 'package', client))) return { noClient: true, declared: client }
    const { requires, requiresV2 } = extractRequiresV2(readFileSync(join(xdir, 'package', client), 'utf8'))
    return { requires, requiresV2, client }
  } finally {
    rmSync(tgz, { force: true })
    rmSync(xdir, { recursive: true, force: true })
  }
}

async function pool(items, size, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(size, items.length) || 1 }, async () => {
    while (i < items.length) await fn(items[i++])
  })
  await Promise.all(workers)
}

async function run() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const onlyIdx = args.indexOf('--only')
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').filter(Boolean)) : null

  const insights = readJson(PATHS.insights)
  if (!insights?.plugins?.length) { console.error('[compat-observed] data/insights.json 缺失——先跑 export-json'); process.exit(1) }
  const shells = readJson(PATHS.shellSeeds)
  if (!shells?.versions || !Object.keys(shells.versions).length) { console.error('[compat-observed] data/shell-seeds.json 缺失——先跑 shell-seeds'); process.exit(1) }

  // 判定轴：distTags latest/next/alpha 去重（须已有 seed 表）
  const tags = shells.distTags || {}
  const dshVersions = [...new Set(['latest', 'next', 'alpha'].map((k) => tags[k]).filter(Boolean))]
    .filter((v) => shells.versions[v])
  if (!dshVersions.length) { console.error('[compat-observed] shell-seeds distTags 无可判定版本'); process.exit(1) }
  const seedByVersion = new Map(dshVersions.map((v) => [v, new Set(shells.versions[v])]))
  // verdict 判定轴：全部已发布 shell 版本（semver 序），纯集合运算，零额外网络
  const allVersions = Object.keys(shells.versions).sort(compareShellVersions)
  const seedAll = new Map(allVersions.map((v) => [v, new Set(shells.versions[v])]))

  // 图行近似：语料库全部已知插件包名
  const knownPkgs = new Set(insights.plugins.map((p) => p.pkgName).filter(Boolean))

  // 目标：有 pkgName 且已发布 npm（版本取 insights.json 的 npm.latest）；同包多仓去重，星高者优先
  const byPkg = new Map()
  for (const p of insights.plugins) {
    if (!p.pkgName || !p.npm?.published || !p.npm?.latest) continue
    const prev = byPkg.get(p.pkgName)
    if (!prev || (p.stars || 0) > (prev.stars || 0)) byPkg.set(p.pkgName, p)
  }
  let targets = [...byPkg.values()].sort((a, b) => (b.stars || 0) - (a.stars || 0))
  if (only) targets = targets.filter((p) => only.has(p.pkgName))
  if (limit) targets = targets.slice(0, limit)
  console.log(`[compat-observed] ${targets.length} target packages (of ${byPkg.size} published) × ${dshVersions.length} shell versions [${dshVersions.join(', ')}]`)

  const cache = readJson(CACHE, {}) || {}
  const stats = { cached: 0, fetched: 0, refetched: 0, noClient: 0, failed: 0 }
  const failedNames = []
  const workDir = mkdtempSync(join(tmpdir(), 'dsh-compat-obs-'))
  const plugins = {}
  let done = 0

  try {
    await pool(targets, CONCURRENCY, async (p) => {
      const key = `${p.pkgName}@${p.npm.latest}`
      let probe = cache[key]
      if (probe?.requires && !probe.requiresV2) {
        // 缓存迁移（守卫上下文缺失的旧条目）：按现有 requires 全部 shell 版本都无 missing
        // 的插件守卫不影响结论（反正全 ok），原位升级、零网络；有 missing 的需重抓 bundle
        // 提取 try/catch 守卫上下文（never / broken-since / supported-since 那批）。
        const anyMissing = allVersions.some((v) =>
          probe.requires.some((spec) => !resolvable(spec, seedAll.get(v), p.pkgName, knownPkgs)))
        if (!anyMissing) {
          probe.requiresV2 = probe.requires.map((spec) => ({ spec, guard: 'unguarded' }))
          stats.cached++
        } else {
          try {
            probe = await probePackage(p.pkgName, p.npm.latest, workDir)
            cache[key] = probe
            stats.refetched++
          } catch (e) {
            // 重抓失败保底：沿用旧缓存条目（守卫视为全 unguarded＝旧口径结论），不丢插件
            probe = cache[key]
            if (probe?.requires) probe.requiresV2 = probe.requires.map((spec) => ({ spec, guard: 'unguarded' }))
            stats.failed++
            failedNames.push(`${p.pkgName}: ${String(e?.message || e).slice(0, 80)}`)
          }
        }
      } else if (probe) stats.cached++
      else {
        try {
          probe = await probePackage(p.pkgName, p.npm.latest, workDir)
          cache[key] = probe
          stats.fetched++
        } catch (e) {
          stats.failed++
          failedNames.push(`${p.pkgName}: ${String(e?.message || e).slice(0, 80)}`)
        }
      }
      if (probe?.requiresV2) {
        const results = {}
        for (const v of dshVersions) results[v] = statusFor(probe.requiresV2, seedByVersion.get(v), p.pkgName, knownPkgs)
        plugins[p.pkgName] = { repo: p.full_name, version: p.npm.latest, requires: probe.requires, results, verdict: verdictFor(probe.requiresV2, p.pkgName, allVersions, seedAll, knownPkgs) }
      } else if (probe?.noClient) stats.noClient++
      if (++done % 200 === 0) {
        console.log(`[compat-observed] ${done}/${targets.length} (cached ${stats.cached} · fetched ${stats.fetched} · refetched ${stats.refetched} · no-client ${stats.noClient} · failed ${stats.failed})`)
        writeJson(CACHE, cache) // 中途落盘：长跑中断不丢已提取结果
      }
    })
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
  writeJson(CACHE, cache)

  const brokenBy = Object.fromEntries(dshVersions.map((v) => [v, Object.values(plugins).filter((x) => x.results[v]?.status === 'broken').length]))
  // verdict 汇总：broken-since / supported-since 按转折版本计数
  const verdicts = { ok: 0, never: 0, 'broken-since': {}, 'supported-since': {}, mixed: 0 }
  for (const x of Object.values(plugins)) {
    const vd = x.verdict
    if (!vd) continue
    if (vd.cls === 'broken-since') verdicts['broken-since'][vd.since] = (verdicts['broken-since'][vd.since] || 0) + 1
    else if (vd.cls === 'supported-since') verdicts['supported-since'][vd.since] = (verdicts['supported-since'][vd.since] || 0) + 1
    else verdicts[vd.cls]++
  }
  writeJson(PATHS.compatObserved, {
    generatedAt: new Date().toISOString(),
    dshVersions,
    allShellVersions: allVersions,
    shellDistTags: tags,
    note: '实测兼容 = 静态分析口径：提取插件 npm 最新版 client bundle 的 require("X") 字面量（模板串/动态 require 静态不可判定，不计入），逐 shell（@deepseek-ai/dsh-web-frontend）版本比对烘焙 seed 词表；strip 尾部 "/client" 后为插件自身包名或语料库已知插件包名（图行近似，未含 dsh 内置非 seed 包）也算可解析。守卫感知：官方 loader 的 require 为调用时解析，花括号配对识别 try{...}catch{...}（跳过字符串/模板/注释/正则字面量）——无守卫 require 缺失即 broken；try 块内缺失时看配对 catch，catch 块 require 全部可解析（含空 catch）则兜底可用判 ok，catch 也缺失才 broken；try 无配对 catch 视同无守卫。非运行时测试；无 client bundle 的插件不在结果中。results 为 distTag 展示轴；verdict 为跨全部已发布 shell 版本的分类——ok 全部可加载 / never 从发布起即崩 / broken-since 某版本起崩（okUntil 之前可用）/ supported-since 某版本起才可加载 / mixed 反复横跳。Observed compatibility = static analysis: literal require() specifiers of the plugin\'s latest npm client bundle (template/dynamic requires excluded) vs each shell build\'s baked seed-word table; a specifier whose trailing "/client" is stripped naming the plugin itself or any corpus-known plugin package (graph-row approximation; in-box non-seed dsh packages not included) also resolves. Guard-aware: the official loader resolves require() at call time, so try{...}catch{...} pairs are recognized by brace matching (skipping strings/templates/comments/regex literals) — an unguarded missing specifier breaks that shell version; a miss inside a try falls back to its catch and stays ok when every catch-block require resolves (empty catch included), broken only when the catch side also misses; a try without catch counts as unguarded. Not a runtime test; plugins without a client bundle are absent from results. results covers the distTag display axis; verdict classifies across every published shell version.',
    stats: { targets: targets.length, observed: Object.keys(plugins).length, ...stats },
    verdicts,
    plugins,
  }, true)
  if (stats.failed) console.error(`[compat-observed] 失败 ${stats.failed} 个（跳过不缓存）：${failedNames.slice(0, 5).join(' · ')}${failedNames.length > 5 ? ' …' : ''}`)
  console.log(`[compat-observed] ${Object.keys(plugins).length} plugins observed (no-client ${stats.noClient} · failed ${stats.failed}) · broken per shell: ${JSON.stringify(brokenBy)} → data/compat-observed.json`)
  console.log(`[compat-observed] verdicts across ${allVersions.length} shell versions: ${JSON.stringify(verdicts)}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1) })
}

export { run }
