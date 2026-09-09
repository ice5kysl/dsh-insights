#!/usr/bin/env node
/**
 * pipeline/collect · shell-seeds — dsh shell 模块表（seed 词）全版本采集 → data/shell-seeds.json
 *
 * 背景（0.1.2-rc.1 事故）：dsh web 的客户端模块表解析规则 =
 *   seed 词（烘焙在 @deepseek-ai/dsh-web-frontend 的 dist/assets/index-*.js，
 *   形态 `function zp(){return{react:q5,...}}`，被 `staticModules:zp()` 调用）
 *   ∪ 图行包（composition 里有 dsh.client 面的包，strip 尾部 "/client" 匹配）。
 * 插件 client bundle `require("X")` 的 X 两者皆不在 → 浏览器 loader 启动即崩。
 * 本步骤把每个已发布 shell 版本的 seed 词表提取出来落盘，供
 * pipeline/analyze/compat-observed.mjs 做全语料库「实测兼容」判定。
 *
 * 提取器移植自 dsh-insights-kit src/host/shell.ts（已对全部已发布版本验证可提取），
 * 严格模式：任何形态偏差返回失败并记入 failed，不产出半成品表（防误红卡）。
 *
 * 增量：版本列表基本静止（dsh 发版才新增），已提取版本跳过；failed 版本每次重试。
 *
 * Output: data/shell-seeds.json
 *   { generatedAt, pkg, distTags, versions: { [version]: string[] }, failed: { [version]: string } }
 *
 * @module dsh-insights/pipeline-collect-shell-seeds
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { NPM } from '../../lib/api.mjs'
import { PATHS, readJson, writeJson } from '../../lib/data.mjs'

const PKG = '@deepseek-ai/dsh-web-frontend'

/**
 * 从 shell SPA bundle 提取 seed 词表：boot 代码调 `staticModules:<fn>()`，
 * <fn> 返回对象字面量，其 KEY 即 seed 词（value 是压缩后的引用）。
 * 严格：形态不符返回 null，不给部分表。
 */
export function extractSeedWords(source) {
  const call = /staticModules:([A-Za-z_$][\w$]*)\(\)/.exec(source)
  if (!call) return null
  const fn = call[1].replace(/[$]/g, '\\$&')
  const def = new RegExp(`function ${fn}\\(\\)\\{return\\{`).exec(source)
  if (!def) return null
  const keys = []
  let i = def.index + def[0].length
  for (;;) {
    const entry = /^[\s,]*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*([A-Za-z_$][\w$]*)/.exec(source.slice(i, i + 240))
    if (!entry) return null
    keys.push(entry[1] ?? entry[2] ?? entry[3])
    i += entry[0].length
    if (source[i] === '}') break
    if (source[i] !== ',') return null
  }
  return keys.length > 0 ? keys : null
}

async function fetchTarball(url, dest) {
  const r = await fetch(url, { headers: { 'user-agent': 'dsh-insights' }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`http ${r.status}`)
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

/** 下载一个版本的 tarball，解出 dist/assets/index-*.js，提取 seed 词。 */
async function extractVersion(version, tarball, workDir) {
  const tgz = join(workDir, `shell-${version}.tgz`)
  await fetchTarball(tarball, tgz)
  execFileSync('tar', ['-xzf', tgz, '-C', workDir])
  rmSync(tgz, { force: true })
  try {
    // tar 解出固定为 package/；index-*.js 取排序第一个（与 kit 提取器一致）
    const assetsDir = join(workDir, 'package', 'dist', 'assets')
    const asset = readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f)).sort()[0]
    if (!asset) throw new Error('no dist/assets/index-*.js')
    const seeds = extractSeedWords(readFileSync(join(assetsDir, asset), 'utf8'))
    if (!seeds) throw new Error('staticModules pattern not matched')
    return seeds
  } finally {
    rmSync(join(workDir, 'package'), { recursive: true, force: true })
  }
}

async function run() {
  const prev = readJson(PATHS.shellSeeds) || {}
  const known = prev.versions || {}

  const meta = await fetch(`${NPM}/${PKG.replace(/^@/, '%40')}`, {
    headers: { 'user-agent': 'dsh-insights' },
    signal: AbortSignal.timeout(20000),
  })
  if (!meta.ok) throw new Error(`npm registry http ${meta.status}`)
  const doc = await meta.json()
  const distTags = doc['dist-tags'] || {}
  const all = Object.entries(doc.versions || {}).map(([version, v]) => ({ version, tarball: v.dist?.tarball }))

  const versions = { ...known }
  const failed = {}
  let skipped = 0
  const workDir = mkdtempSync(join(tmpdir(), 'dsh-shell-seeds-'))
  try {
    for (const { version, tarball } of all) {
      if (known[version]) { skipped++; continue }
      if (!tarball) { failed[version] = 'no dist.tarball in registry doc'; continue }
      try {
        versions[version] = await extractVersion(version, tarball, workDir)
        console.log(`[shell-seeds] ${version} → ${versions[version].length} seed words`)
      } catch (e) {
        failed[version] = String(e?.message || e).slice(0, 160)
        console.error(`[shell-seeds] ${version} FAILED: ${failed[version]}`)
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  writeJson(PATHS.shellSeeds, {
    generatedAt: new Date().toISOString(),
    pkg: PKG,
    note: 'dsh shell（dsh-web-frontend）各版本烘焙的客户端模块表 seed 词；提取器严格模式，形态不符的版本记入 failed 不产出部分表。Seed words baked into each published shell build; extraction is strict — shape deviations land in failed, never partial tables.',
    distTags,
    versions,
    failed,
  }, true)
  console.log(`[shell-seeds] ${Object.keys(versions).length}/${all.length} versions extracted (${skipped} cached, ${Object.keys(failed).length} failed) → data/shell-seeds.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1) })
}

export { run }
