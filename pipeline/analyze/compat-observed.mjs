#!/usr/bin/env node
/**
 * pipeline/analyze · compat-observed — 全语料库「实测兼容」矩阵 → data/compat-observed.json
 *
 * 对权威集（data/insights.json）中每个已发布 npm 的插件，取其最新版 tarball，
 * 找到 client bundle（package.json exports["./client"]，否则惯例 lib/client.js），
 * 静态提取 require("X") 字面量集合，逐「当前相关 shell 版本」判定可加载性。
 *
 * 可解析性模型（2026-09-10 修正，对齐官方 loader 真实语义）——loader 的 require 解析
 * 顺序（dsh-client-modules/lib/client.js makeRequire）：seed 词 → 已物化模块 → 已注册
 * 工厂 → 抛错。工厂由图行 bundle 随 combo 批次按【包名】注册。故 require 词 X 分四类：
 *   ok          X ∈ seed 词表（data/shell-seeds.json）∨ stripClientSuffix(X)=自身包名
 *               ∨ X ∈ 语料库插件包名（跨插件工厂近似）∨ X ∈ 该版本 immediate 图行
 *               （data/shell-rows.json；插件物化前已预取）∨ X ∈ 图行且插件在自己的
 *               dsh.client.external/inject 里声明了它（arriveGraphRow 保证先行到达）
 *   conditional X ∈ lazy 图行且未声明——批次时序多数可解析但无保证（2026-09-10 实测：
 *               vision-router require ui-attachment 在 0.1.2-rc.1 单批次下加载正常）
 *   missing     其余（如 dsh-client-runtime/*——从未存在于任何已发布 shell 的模块表）
 * 每版本判定三态：broken（启动路径必崩）/ conditional（条件可解析，建议声明
 * dsh.client.external 获得确定性）/ ok。
 *
 * 提取口径（同日修正）：仅「代码态」的 require 字面量——注释/字符串/模板字面量内的
 * require 字样不计（纯正则时代的假阳性）；相对路径/绝对路径 spec 不计——bundle 自带
 * 模块表（localRequire 模式）就地服务，永不进 loader（dsh-safe-delete 等 8 个插件
 * 曾因此误判 broken）。
 *
 * 守卫感知（2026-09 假阳性修正）：require 是调用时解析，try/catch 可兜「missed the
 * module table」。每个 require 标注守卫上下文（花括号配对 try{...}catch{...}，跳过
 * 字符串/模板/注释/正则）：unguarded（裸 try/try-finally 视同）/ in-try / in-catch。
 * 逐对求值：try 全 ok → OK；try 有 missing → catch 全 ok（空 catch=优雅降级）→ OK，
 * catch 有 conditional → conditional，catch 有 missing → broken；unguarded missing
 * → broken，unguarded conditional → conditional。
 * 典型：dsh-dream-skin 的 try(store)/catch(runtime-client) 双代宿主兼容写法，
 * 旧口径误判全版本 never，守卫感知后 supported-since 0.1.2-alpha.2（store 入表版本）。
 *
 * 判定轴（dshVersions）：shell-seeds.json distTags 的 latest/next/alpha 去重，
 * 作为详情页展示矩阵。另有 verdict：跨 shell-seeds 全部已发布版本（semver 序）
 * 的纯集合运算判定——ok（全部可加载）/ never（从发布起即崩）/ broken-since X
 * （X 起崩，此前可用）/ supported-since X（X 起才可加载）/ conditional（无崩版本但
 * 存在条件可解析版本）/ mixed（反复横跳）。verdict.conditional 列出条件可解析版本。
 * 没有 client bundle 的插件不进结果（不是 ok）；下载/解析失败跳过并计数。
 *
 * 网络礼节：并发 ≤8、每包 30s 超时；tarball URL 按 npm 惯例
 *   https://registry.npmjs.org/<name>/-/<basename>-<version>.tgz（scoped 取 / 后段）。
 * 增量：按 pkg@version 缓存提取结果于 data/compat-observed-cache.json（data/ 根、入 git——
 *   state/ 目录被 gitignore，放这里 CI 的 `git add data/` 才能带上缓存，daily 跑矩阵才是增量成本），
 *   版本不变零网络。缓存条目带提取器版本 xv——口径升级（xv 2：代码态提取+相对路径排除）
 *   自动重抓；重抓失败的旧条目先剔除相对路径 spec 后兜底沿用（标 stale）。
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

const IDENT = /[A-Za-z0-9_$]/

/**
 * 单趟状态机扫描：同时产出
 *   pairs — try{...}catch{...} 对的 try/catch 内容区间（不含花括号本身）
 *   hits  — 「代码态」require 字面量 [{ index, spec }]（字符串/模板/注释/正则里的
 *           require 字样不产出；动态/模板实参静态不可判定，不产出——与旧正则口径一致）
 * 字符串、模板（含 ${} 嵌套表达式）、行/块注释、正则字面量全程跳过，其中内容既不干扰
 * 配对也不产出 require。try 无配对 catch（裸 try / try-finally）不产出对——异常穿透，
 * 内容按 unguarded 处理。EOF 时未闭合的对丢弃（保守：按 unguarded）。
 */
function scanBundle(text) {
  const pairs = []
  const hits = []
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
        if ((w === 'require' || w === '__require') && text[j] === '(') {
          // 与旧正则 \brequire\(\s*["']([^"']+)["']\s*\) 同口径：紧贴 '('，引号前可空白
          let k = j + 1
          while (k < n && (text[k] === ' ' || text[k] === '\t' || text[k] === '\n' || text[k] === '\r' || text[k] === '\f' || text[k] === '\v')) k++
          const q = text[k]
          if (q === '"' || q === "'") {
            const s = k + 1
            let e = s
            while (e < n && text[e] !== '"' && text[e] !== "'") e++
            if (e > s && text[e] === q) {
              let z = e + 1
              while (z < n && (text[z] === ' ' || text[z] === '\t' || text[z] === '\n' || text[z] === '\r' || text[z] === '\f' || text[z] === '\v')) z++
              if (text[z] === ')') hits.push({ index: i, spec: text.slice(s, e) })
            }
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
  return { pairs: pairs.filter((p) => p.catchEnd != null), hits }
}

/**
 * 守卫感知的 require 提取。单趟状态机产出代码态 require 字面量（注释/字符串/模板/
 * 正则里的字样不计）；相对路径与绝对路径 spec 不计入 requires（bundle 自带模块表
 * 就地服务，loader 永不可解析此类 spec），以 local 计数返回。
 *   requires   — 扁平去重的外部 spec 集（模板串/动态 require 排除——含 ${ 的字面量不计）
 *   requiresV2 — 每个 require 的守卫上下文：
 *   { spec, guard: 'unguarded' } / { spec, guard: 'in-try', pair: id } / { spec, guard: 'in-catch', pair: id }
 * 同一 spec 在不同守卫上下文多次出现时按上下文分别保留（pair id 为单次扫描的分组键，
 * 按 try 闭合顺序分配，仅自洽于本次扫描的 requiresV2 内部）。
 */
export function extractRequiresV2(bundleText) {
  const { pairs, hits } = scanBundle(bundleText)
  const regions = []
  for (const [id, p] of pairs.entries()) {
    regions.push({ start: p.tryStart, end: p.tryEnd, kind: 'in-try', pair: id })
    regions.push({ start: p.catchStart, end: p.catchEnd, kind: 'in-catch', pair: id })
  }
  const seenFlat = new Set()
  const seenV2 = new Set()
  const requires = []
  const requiresV2 = []
  let local = 0
  for (const hit of hits) {
    const spec = hit.spec
    if (spec.includes('${')) continue
    if (spec[0] === '.' || spec[0] === '/') { local++; continue } // 相对/绝对路径：bundle 内部模块表
    if (!seenFlat.has(spec)) { seenFlat.add(spec); requires.push(spec) }
    let best = null // 内层优先：含该位置且 start 最大的区域
    for (const rg of regions) {
      if (hit.index >= rg.start && hit.index < rg.end && (!best || rg.start > best.start)) best = rg
    }
    const key = best ? `${spec} ${best.kind} ${best.pair}` : `${spec} `
    if (seenV2.has(key)) continue
    seenV2.add(key)
    requiresV2.push(best ? { spec, guard: best.kind, pair: best.pair } : { spec, guard: 'unguarded' })
  }
  return { requires, requiresV2, local }
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

const RANK = { ok: 0, conditional: 1, missing: 2 }

/**
 * 单 require 在某 shell 版本下的归类（对齐 loader 真实解析序 seed→物化→工厂→抛错）：
 *   ok          seed 词 / 自身包名 / 语料库插件包名（跨插件工厂近似）/ immediate 图行
 *               / lazy 图行且插件在自己 dsh.client.external/inject 里声明（保证先行到达）
 *   conditional lazy 图行且未声明（批次时序无保证）
 *   missing     其余（永不存在的模块表成员）
 * rows = { immediate: Set, lazy: Set }（该 shell 版本的图行清单，data/shell-rows.json）。
 */
function classify(spec, seed, pkgName, knownPkgs, rows, declared) {
  if (seed.has(spec)) return 'ok'
  const id = stripClientSuffix(spec)
  if (id === pkgName || knownPkgs.has(id)) return 'ok'
  if (rows.immediate.has(id)) return 'ok'
  if (rows.lazy.has(id)) return declared.has(id) ? 'ok' : 'conditional'
  return 'missing'
}

/**
 * 守卫感知的单版本三态判定：
 *   unguarded missing → broken；unguarded conditional → conditional；
 *   逐 try/catch 对：try 全 ok → OK；try 有 missing → catch 全 ok → OK（兜底可用），
 *   catch 有 conditional → conditional，catch 有 missing → broken；try 有 conditional
 *   → catch 全 ok → OK，否则 conditional。
 * 返回 { status: 'ok' } | { status: 'conditional', conditional } | { status: 'broken', missing }
 * （ok 不记清单：被守卫兜住的 require 不是缺陷）。
 */
function statusFor(requiresV2, seed, pkgName, knownPkgs, rows = EMPTY_ROWS, declared = EMPTY_SET) {
  const hardMissing = []
  const hardCond = []
  const pairRank = new Map() // pair -> { try, catch, trySpecs, catchSpecs }
  for (const r of requiresV2) {
    const cls = classify(r.spec, seed, pkgName, knownPkgs, rows, declared)
    if (cls === 'ok') continue
    if (r.guard === 'unguarded') {
      ;(cls === 'missing' ? hardMissing : hardCond).push(r.spec)
    } else {
      const e = pairRank.get(r.pair) || { try: 0, catch: 0, trySpecs: [], catchSpecs: [] }
      const side = r.guard === 'in-try' ? 'try' : 'catch'
      e[side] = Math.max(e[side], RANK[cls])
      e[`${side}Specs`].push(r.spec)
      pairRank.set(r.pair, e)
    }
  }
  if (hardMissing.length) return { status: 'broken', missing: hardMissing }
  const missing = []
  const cond = [...hardCond]
  for (const e of pairRank.values()) {
    if (e.try === 0) continue
    if (e.try === 2) {
      if (e.catch === 0) continue
      ;(e.catch === 1 ? cond : missing).push(...e.trySpecs, ...e.catchSpecs)
    } else { // try === 1：很可能可解析；若抛错看 catch——catch 有非 ok 项则整体 conditional
      if (e.catch > 0) cond.push(...e.trySpecs, ...e.catchSpecs)
    }
  }
  if (missing.length) return { status: 'broken', missing }
  if (cond.length) return { status: 'conditional', conditional: cond }
  return { status: 'ok' }
}
export { statusFor }
const EMPTY_ROWS = { immediate: new Set(), lazy: new Set() }
const EMPTY_SET = new Set()

/**
 * 全版本判定：requiresV2 在按 semver 排序的全部 shell 版本上逐一跑三态判定。
 * cls 依 ok/broken 序列形态分类（conditional 版本不参与形态、单列 conditional 字段）：
 * ok / never / broken-since / supported-since / mixed；全部版本均非崩非 ok（纯
 * conditional）时 cls='conditional'。seed 变更史上只有单调删（0.1.0-rc.8）与单调加，
 * 故正常只会出现 ok / never / broken-since / supported-since；mixed 如实记录。
 */
function verdictFor(requiresV2, pkgName, allVersions, seedAll, knownPkgs, rowsAll, declared) {
  const okOn = [], brokenOn = [], condOn = []
  for (const v of allVersions) {
    const s = statusFor(requiresV2, seedAll.get(v), pkgName, knownPkgs, rowsAll.get(v) ?? EMPTY_ROWS, declared).status
    ;(s === 'ok' ? okOn : s === 'broken' ? brokenOn : condOn).push(v)
  }
  const total = allVersions.length
  const cond = condOn.length ? { conditional: condOn } : {}
  if (!brokenOn.length && !okOn.length) return { cls: 'conditional', ...cond, total }
  if (!brokenOn.length) return { cls: 'ok', ...cond, total }
  if (!okOn.length) return { cls: 'never', ...cond, total }
  // 严格前后缀判定，防止反复横跳被误分类（横跳落 mixed 如实呈现）
  if (compareShellVersions(okOn[okOn.length - 1], brokenOn[0]) < 0) {
    return { cls: 'broken-since', since: brokenOn[0], okUntil: okOn[okOn.length - 1], ...cond, total }
  }
  if (compareShellVersions(brokenOn[brokenOn.length - 1], okOn[0]) < 0) {
    return { cls: 'supported-since', since: okOn[0], ...cond, total }
  }
  return { cls: 'mixed', okOn, brokenOn, ...cond, total }
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
 * 同时浅扫 host 入口（package.json main / exports["."]）的 tapIndex 引用——server 侧
 * index transform 会改写 client 实际拿到的模块面（如 vision-router 的 scopedRequire
 * 前奏），静态判定对此类插件不可靠，标记 hostTransform 供展示层加注（不改判定）。
 * 返回 { requires, requiresV2, local, declaredDeps, client, xv } | { noClient: true }；
 * 失败抛错（调用方计数，不缓存）。
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
    if (!existsSync(join(xdir, 'package', client))) return { noClient: true, declared: client, xv: 3 }
    // hostTransform 标记：全量解包后深扫 host 侧 .js（排除 client bundle 本身），
    // 命中 tapIndex / scopedRequire 即「server 端改写了 client 拿到的模块面」——
    // 浅扫 main 文件不够（vision-router 的入口是多层 import 链，prelude 在深层模块里）。
    let hostTransform = false
    try {
      execFileSync('tar', ['-xzf', tgz, '-C', xdir], { stdio: ['ignore', 'ignore', 'ignore'] })
      const hit = execFileSync('grep', ['-rl', '--include=*.js', '-e', 'tapIndex', '-e', 'scopedRequire', join(xdir, 'package')], { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').filter(Boolean)
      hostTransform = hit.some((f) => f !== join(xdir, 'package', client))
    } catch { /* grep 无命中会 exit 1 —— 空结果即无标记 */ }
    const dc = pkgJson?.dsh?.client
    const declaredDeps = [...(Array.isArray(dc?.external) ? dc.external : []), ...(Array.isArray(dc?.inject) ? dc.inject : [])].map(stripClientSuffix)
    const { requires, requiresV2, local } = extractRequiresV2(readFileSync(join(xdir, 'package', client), 'utf8'))
    return { requires, requiresV2, local, declaredDeps, client, hostTransform, xv: 3 }
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

  // 判定轴：distTags latest/next/alpha 去重（须已有 seed 表），外加
  // DSH_MATRIX_EXTRA_SHELLS 指定的「升级源」版本（如 0.1.2-rc.1——大多数用户
  // 所在线；回答「我从 X 升上来会不会坏」需要 X 也在矩阵里，而 dist-tag 一移
  // 它就会从判定轴消失）。逗号分隔，忽略无 seed 表的版本。
  const tags = shells.distTags || {}
  const extraShells = (process.env.DSH_MATRIX_EXTRA_SHELLS || '').split(',').map((s) => s.trim()).filter(Boolean)
  const dshVersions = [...new Set([...['latest', 'next', 'alpha'].map((k) => tags[k]), ...extraShells].filter(Boolean))]
    .filter((v) => shells.versions[v])
  if (!dshVersions.length) { console.error('[compat-observed] shell-seeds distTags 无可判定版本'); process.exit(1) }
  const seedByVersion = new Map(dshVersions.map((v) => [v, new Set(shells.versions[v])]))
  // verdict 判定轴：全部已发布 shell 版本（semver 序），纯集合运算，零额外网络
  const allVersions = Object.keys(shells.versions).sort(compareShellVersions)
  const seedAll = new Map(allVersions.map((v) => [v, new Set(shells.versions[v])]))

  // 图行清单（data/shell-rows.json）：loader 真实可解析的第三类模块——缺失时降级为空集
  // （=旧模型，可能误红卡；故告警但不阻断）
  const rowsDoc = readJson(PATHS.shellRows)
  if (!rowsDoc?.versions) console.error('[compat-observed] 警告：data/shell-rows.json 缺失——图行按空集处理（先跑 shell-rows 获得正确判定）')
  const rowsFor = (v) => {
    const r = rowsDoc?.versions?.[v]
    return r ? { immediate: new Set(r.immediate), lazy: new Set(r.lazy) } : EMPTY_ROWS
  }
  const rowsByVersion = new Map(dshVersions.map((v) => [v, rowsFor(v)]))
  const rowsAll = new Map(allVersions.map((v) => [v, rowsFor(v)]))

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
  // --only/--limit 是调试通道：合并进既有文档而不是覆盖（否则一次定向重扫就会
  // 把全量矩阵写成几个插件的子集——2026-09-10 踩过）。
  const prior = only || limit ? (readJson(PATHS.compatObserved) || {}) : {}
  const plugins = { ...((prior.plugins && typeof prior.plugins === 'object') ? prior.plugins : {}) }
  let done = 0

  try {
    await pool(targets, CONCURRENCY, async (p) => {
      const key = `${p.pkgName}@${p.npm.latest}`
      let probe = cache[key]
      if (probe?.noClient && probe.xv !== 3) {
        probe.xv = 3 // noClient 条目不受提取口径影响：原位升级，零网络
        stats.cached++
      } else if (probe?.requires && probe.xv !== 3) {
        // 缓存迁移（提取器口径 xv 3：代码态提取 + 相对路径排除 + hostTransform 标记）：
        // 需重抓 bundle。重抓失败的旧条目剔除相对路径 spec 后兜底沿用（标 stale——
        // 注释/字符串口径与 tapIndex 标记无法离线修正，下一跑再试）。
        try {
          probe = await probePackage(p.pkgName, p.npm.latest, workDir)
          cache[key] = probe
          stats.refetched++
        } catch (e) {
          probe = cache[key]
          probe.requires = probe.requires.filter((s) => s[0] !== '.' && s[0] !== '/')
          probe.requiresV2 = (probe.requiresV2 || probe.requires.map((s) => ({ spec: s, guard: 'unguarded' })))
            .filter((r) => r.spec[0] !== '.' && r.spec[0] !== '/')
          probe.stale = true
          stats.failed++
          failedNames.push(`${p.pkgName}: ${String(e?.message || e).slice(0, 80)}`)
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
        const declared = new Set(probe.declaredDeps || [])
        const results = {}
        for (const v of dshVersions) results[v] = statusFor(probe.requiresV2, seedByVersion.get(v), p.pkgName, knownPkgs, rowsByVersion.get(v), declared)
        plugins[p.pkgName] = { repo: p.full_name, version: p.npm.latest, requires: probe.requires, results, verdict: verdictFor(probe.requiresV2, p.pkgName, allVersions, seedAll, knownPkgs, rowsAll, declared) }
        if (probe.stale) plugins[p.pkgName].stale = true
        if (probe.hostTransform) plugins[p.pkgName].hostTransform = true
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
  const condBy = Object.fromEntries(dshVersions.map((v) => [v, Object.values(plugins).filter((x) => x.results[v]?.status === 'conditional').length]))
  // verdict 汇总：broken-since / supported-since 按转折版本计数
  const verdicts = { ok: 0, never: 0, conditional: 0, 'broken-since': {}, 'supported-since': {}, mixed: 0 }
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
    note: '实测兼容 = 静态分析口径：提取插件 npm 最新版 client bundle 中「代码态」require("X") 字面量（注释/字符串/模板/正则里的字样不计；模板串/动态 require 静态不可判定不计；相对/绝对路径 spec 不计——bundle 自带模块表就地服务，不进 loader），逐 shell 版本按官方 loader 真实解析序归类：ok=seed 词表/插件自身/语料库插件包名/immediate 图行/已声明的 lazy 图行；conditional=未声明的 lazy 图行（批次时序多数可解析但无保证，声明 dsh.client.external 可获确定性）；missing=其余（如 dsh-client-runtime/*）。守卫感知：require 为调用时解析，try{...}catch{...} 花括号配对识别——unguarded missing 即 broken、unguarded conditional 即 conditional；try 块缺失看配对 catch（全 ok 含空 catch=兜底可用判 ok，catch 有 conditional 判 conditional，catch 有 missing 判 broken）；try 无配对 catch 视同无守卫。非运行时测试；无 client bundle 的插件不在结果中。results 为 distTag 展示轴（ok/conditional/broken 三态）；verdict 为跨全部已发布 shell 版本的分类（ok/never/conditional/broken-since/supported-since/mixed，conditional 版本单列）。图行清单见 data/shell-rows.json（已对 0.1.2-rc.1 真实 __DSH_BOOT__ 验证一致）。已知盲区：插件 host 侧的 server 端 index/HTML 变换（如 WebServer tapIndex 注入 require 改写前奏）不建模——带 hostTransform 标记的插件其判定仅供参考。Observed compatibility = static analysis: code-state literal require() specifiers of each plugin\'s latest npm client bundle (comments/strings/templates/regex contents excluded; dynamic/template requires undecidable; relative/absolute specifiers excluded — bundle-local module tables serve them, never the loader), classified per shell version following the official loader\'s real resolution order: ok = seed word / own package / corpus plugin package / immediate graph row / declared lazy graph row; conditional = undeclared lazy graph row (batch-arrival timing usually resolves but is not guaranteed — declaring dsh.client.external makes it deterministic); missing = everything else. Guard-aware: require resolves at call time, so try{...}catch{...} pairs are brace-matched — an unguarded missing specifier breaks that shell version, unguarded conditional marks it conditional; a try-side miss falls back to its catch (all-ok catch, empty included, stays ok; conditional catch → conditional; missing catch → broken); a try without catch counts as unguarded. Not a runtime test; plugins without a client bundle are absent. results covers the distTag display axis (ok/conditional/broken); verdict classifies across all published shell versions (ok/never/conditional/broken-since/supported-since/mixed, conditional versions listed separately). Graph rows: data/shell-rows.json (validated against the real __DSH_BOOT__ on 0.1.2-rc.1). Known blind spot: server-side index/HTML transforms in a plugin\'s host half (e.g. WebServer tapIndex preludes rewriting the module surface) are not modeled — verdicts of hostTransform-flagged plugins are indicative only.',
    stats: { targets: targets.length, observed: Object.keys(plugins).length, ...stats },
    verdicts,
    plugins,
  }, true)
  if (stats.failed) console.error(`[compat-observed] 失败 ${stats.failed} 个（跳过或旧条目兜底）：${failedNames.slice(0, 5).join(' · ')}${failedNames.length > 5 ? ' …' : ''}`)
  console.log(`[compat-observed] ${Object.keys(plugins).length} plugins observed (no-client ${stats.noClient} · failed ${stats.failed}) · broken per shell: ${JSON.stringify(brokenBy)} · conditional per shell: ${JSON.stringify(condBy)} → data/compat-observed.json`)
  console.log(`[compat-observed] verdicts across ${allVersions.length} shell versions: ${JSON.stringify(verdicts)}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1) })
}

export { run }
