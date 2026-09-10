#!/usr/bin/env node
/**
 * pipeline/collect · shell-rows — dsh 各版本「客户端图行」清单采集 → data/shell-rows.json
 *
 * 背景（2026-09-10 误判修正）：dsh web loader 的 require 解析顺序是
 *   seed 词 → 已物化模块 → 已注册工厂 → 抛错（dsh-client-modules/lib/client.js）。
 * 工厂在 bundle 脚本执行时按【包名】注册——而所有挂载进 composition 的 dsh.client 包
 * （图行）的 bundle 随 combo 批次脚本执行，即「图行包」是可被 require 解析的第三类模块，
 * 与 seed 词无关。0.1.0-rc.8 把 ui-attachment 等从 seed 移除，但它们仍作为图行挂载，
 * 只认 seed 的旧模型因此把 10 个插件误判为 broken（含 dsh-vision-router）。
 *
 * 图行的确定性分两档（dsh-web-frontend 启动序列）：
 *   immediately — dsh.client.immediately=true，prefetchImmediateTier 在任何插件
 *                 物化前完成预取 → require 必解析（确定可解析）；
 *   lazy        — 普通图行，其批次脚本在任一同行插件到达时执行 → 多数情形下可解析，
 *                 但跨批次时序无保证（组合批次按 URL ≤3072B 切分），且插件可用
 *                 dsh.client.external/inject 声明获得确定到达——判「条件可解析」。
 *
 * 图行集合 = 安装树里带 dsh.client 声明的包全集（dsh-web-app 的依赖树即覆盖全部
 * web 图行；不再 ∩ roster 文件名——roster 抓取会漏平台条件挂载的行，如
 * directory-picker-native 真实出现在 __DSH_BOOT__ 却不在两个 patch 文件的 name 行里；
 * 宁宽的偏置方向与「不误报缺失」的目标一致）。已对 0.1.2-rc.1 用真实
 * `__DSH_BOOT__`（47 条目）验证：产出为真实图的超集（+2 平台选择器行）。
 *
 * 提取方式：按版本 `npm install @deepseek-ai/dsh-web-app@<V>`（与 dsh-web-frontend
 * 版本锁步；依赖树 ~179 包，秒级），扫描 node_modules 中 package.json 的 dsh.client。
 * 增量：已提取版本跳过；failed 版本每次重试。成本≈一次性 16 次安装，此后随发版 +1。
 *
 * Output: data/shell-rows.json
 *   { generatedAt, pkg, note, versions: { [version]: { immediate: string[], lazy: string[] } },
 *     failed: { [version]: string } }
 *
 * Usage: node pipeline/collect/shell-rows.mjs [--only v1,v2]
 *
 * @module dsh-insights/pipeline-collect-shell-rows
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NPM } from '../../lib/api.mjs'
import { PATHS, readJson, writeJson } from '../../lib/data.mjs'

const PKG = '@deepseek-ai/dsh-web-app'
// npm 共享缓存锁会让并发安装实质串行——并发开高只放大单任务超时率
const CONCURRENCY = 2

/** 安装树扫描（顶层 + @scope 一层 + 包内嵌套一层），收集带 dsh.client 声明的包。 */
function scanClientPackages(nmdir) {
  const found = new Map() // name -> { immediately }
  const visit = (dir, depth) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const sub = join(dir, e.name)
      if (e.name.startsWith('@')) { visit(sub, depth); continue } // scope 目录本身不含 package.json
      const pj = join(sub, 'package.json')
      if (existsSync(pj)) {
        try {
          const d = JSON.parse(readFileSync(pj, 'utf8'))
          const client = d?.dsh?.client
          if (client && d.name && !found.has(d.name)) {
            found.set(d.name, { immediately: client.immediately === true })
          }
        } catch { /* 坏 package.json 跳过 */ }
      }
      if (depth > 0) visit(join(sub, 'node_modules'), depth - 1) // 嵌套依赖（非 hoisted 部分）
    }
  }
  visit(nmdir, 1)
  return found
}

/** 安装一个版本并提取图行清单：安装树里全部带 dsh.client 声明的包（宁宽，见头部注释）。返回 { immediate, lazy }。 */
function extractVersion(version, workDir) {
  const dir = join(workDir, `v-${version}`)
  execFileSync('npm', ['install', '--prefix', dir, '--no-save', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error', `${PKG}@${version}`], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 600_000 })
  const clientPkgs = scanClientPackages(join(dir, 'node_modules'))
  const immediate = [], lazy = []
  for (const [name, meta] of [...clientPkgs.entries()].sort()) {
    ;(meta.immediately ? immediate : lazy).push(name)
  }
  if (!immediate.length && !lazy.length) throw new Error('no client rows found (dsh.client scan empty)')
  return { immediate, lazy }
}

async function run() {
  const args = process.argv.slice(2)
  const onlyIdx = args.indexOf('--only')
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').filter(Boolean)) : null

  const seeds = readJson(PATHS.shellSeeds)
  if (!seeds?.versions) { console.error('[shell-rows] data/shell-seeds.json 缺失——先跑 shell-seeds'); process.exit(1) }

  const meta = await fetch(`${NPM}/${PKG.replace(/^@/, '%40')}`, {
    headers: { 'user-agent': 'dsh-insights' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!meta.ok) throw new Error(`npm registry http ${meta.status}`)
  const doc = await meta.json()

  // 判定轴对齐 shell-seeds（dsh-web-frontend 版本，与 CLI 锁步）；CLI 缺的版本记 failed
  const axis = Object.keys(seeds.versions)
  let targets = axis.filter((v) => doc.versions?.[v])
  if (only) targets = targets.filter((v) => only.has(v))
  const prev = readJson(PATHS.shellRows) || {}
  const versions = { ...(prev.versions || {}) }
  const failed = { ...(prev.failed || {}) }
  let skipped = 0
  const todo = targets.filter((v) => {
    if (versions[v] && !only) { skipped++; return false }
    return true
  })
  console.log(`[shell-rows] ${todo.length} versions to extract (${skipped} cached) · axis ${axis.length}`)

  const persist = () => writeJson(PATHS.shellRows, {
    generatedAt: new Date().toISOString(),
    pkg: PKG,
    note: 'dsh 各版本客户端图行清单（@deepseek-ai/dsh-web-app 依赖树里带 dsh.client 声明的包全集——宁宽不收 roster，平台条件挂载的行也计入；与真实 __DSH_BOOT__ 对账为超集，多出的是平台选择器等条件行）。图行包的 bundle 随 combo 批次注册按包名命名的工厂，require 可解析：immediate=dsh.client.immediately（任何插件物化前已预取，确定可解析）；lazy=普通图行（批次到达时序多数可解析但无保证，插件声明 dsh.client.external/inject 可获确定性——判「条件可解析」）。Client graph rows per dsh version (every package with a dsh.client face in the dsh-web-app dependency tree — inclusive by design, platform-conditional mounts included): row bundles register package-name factories via combo batches, so their specifiers resolve at require() time — immediate rows are prefetched before any plugin materializes (deterministic), lazy rows resolve in practice but without ordering guarantee (declaring dsh.client.external/inject makes it deterministic → "conditional").',
    versions,
    failed,
  }, true)

  const workDir = mkdtempSync(join(tmpdir(), 'dsh-shell-rows-'))
  try {
    let i = 0
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) || 1 }, async () => {
      while (i < todo.length) {
        const v = todo[i++]
        try {
          versions[v] = extractVersion(v, workDir)
          delete failed[v]
          console.log(`[shell-rows] ${v} → ${versions[v].immediate.length} immediate + ${versions[v].lazy.length} lazy rows`)
        } catch (e) {
          failed[v] = String(e?.message || e).slice(0, 160)
          console.error(`[shell-rows] ${v} FAILED: ${failed[v]}`)
        }
        persist() // 逐版本落盘：长跑被中断不丢已完成的版本
      }
    }))
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  persist()
  console.log(`[shell-rows] ${Object.keys(versions).length}/${axis.length} versions (${skipped} cached, ${Object.keys(failed).length} failed) → data/shell-rows.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1) })
}

export { run }
