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
 *   否则进 missing；missing 非空 → broken（该 shell 版本下 loader 启动即崩，
 *   即 0.1.2-rc.1 移除 @deepseek-ai/dsh-client-runtime 的事故形态）。
 *
 * 判定轴（dshVersions）：shell-seeds.json distTags 的 latest/next/alpha 去重。
 * 没有 client bundle 的插件不进结果（不是 ok）；下载/解析失败跳过并计数。
 *
 * 提取器移植自 dsh-insights-kit src/host/shell.ts（extractRequires 排除模板串
 * require——dsh-better-sidebar 的 require(`${spec}`) 教训：静态不可判定，不报假 missing）。
 *
 * 网络礼节：并发 ≤8、每包 30s 超时；tarball URL 按 npm 惯例
 *   https://registry.npmjs.org/<name>/-/<basename>-<version>.tgz（scoped 取 / 后段）。
 * 增量：按 pkg@version 缓存提取结果于 data/state/compat-observed-cache.json
 * （gitignore 的 data/state/ 惯例），版本不变零网络。
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

const CACHE = join(DATA, 'state', 'compat-observed-cache.json')
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

/** 与 dsh-client-modules 一致："pkg/client" 形式的 require 解析到 "pkg"。 */
export function stripClientSuffix(spec) {
  return spec.endsWith('/client') ? spec.slice(0, -'/client'.length) : spec
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
 * 下载 pkg@version 的 tarball，提取 client bundle 的 require 集合。
 * 返回 { requires, client } | { noClient: true }；失败抛错（调用方计数，不缓存）。
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
    return { requires: extractRequires(readFileSync(join(xdir, 'package', client), 'utf8')), client }
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
  const stats = { cached: 0, fetched: 0, noClient: 0, failed: 0 }
  const failedNames = []
  const workDir = mkdtempSync(join(tmpdir(), 'dsh-compat-obs-'))
  const plugins = {}
  let done = 0

  try {
    await pool(targets, CONCURRENCY, async (p) => {
      const key = `${p.pkgName}@${p.npm.latest}`
      let probe = cache[key]
      if (probe) stats.cached++
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
      if (probe?.requires) {
        const results = {}
        for (const v of dshVersions) {
          const seed = seedByVersion.get(v)
          const missing = probe.requires.filter((spec) =>
            !seed.has(spec) && stripClientSuffix(spec) !== p.pkgName && !knownPkgs.has(stripClientSuffix(spec)))
          results[v] = missing.length ? { status: 'broken', missing } : { status: 'ok' }
        }
        plugins[p.pkgName] = { repo: p.full_name, version: p.npm.latest, requires: probe.requires, results }
      } else if (probe?.noClient) stats.noClient++
      if (++done % 200 === 0) {
        console.log(`[compat-observed] ${done}/${targets.length} (cached ${stats.cached} · fetched ${stats.fetched} · no-client ${stats.noClient} · failed ${stats.failed})`)
        writeJson(CACHE, cache) // 中途落盘：长跑中断不丢已提取结果
      }
    })
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
  writeJson(CACHE, cache)

  const brokenBy = Object.fromEntries(dshVersions.map((v) => [v, Object.values(plugins).filter((x) => x.results[v]?.status === 'broken').length]))
  writeJson(PATHS.compatObserved, {
    generatedAt: new Date().toISOString(),
    dshVersions,
    shellDistTags: tags,
    note: '实测兼容 = 静态分析口径：提取插件 npm 最新版 client bundle 的 require("X") 字面量（模板串/动态 require 静态不可判定，不计入），逐 shell（@deepseek-ai/dsh-web-frontend）版本比对烘焙 seed 词表；strip 尾部 "/client" 后为插件自身包名或语料库已知插件包名（图行近似，未含 dsh 内置非 seed 包）也算可解析。非运行时测试；无 client bundle 的插件不在结果中。Observed compatibility = static analysis: literal require() specifiers of the plugin\'s latest npm client bundle (template/dynamic requires excluded) vs each shell build\'s baked seed-word table; a specifier whose trailing "/client" is stripped naming the plugin itself or any corpus-known plugin package (graph-row approximation; in-box non-seed dsh packages not included) also resolves. Not a runtime test; plugins without a client bundle are absent from results.',
    stats: { targets: targets.length, observed: Object.keys(plugins).length, ...stats },
    plugins,
  }, true)
  if (stats.failed) console.error(`[compat-observed] 失败 ${stats.failed} 个（跳过不缓存）：${failedNames.slice(0, 5).join(' · ')}${failedNames.length > 5 ? ' …' : ''}`)
  console.log(`[compat-observed] ${Object.keys(plugins).length} plugins observed (no-client ${stats.noClient} · failed ${stats.failed}) · broken per shell: ${JSON.stringify(brokenBy)} → data/compat-observed.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1) })
}

export { run }
