#!/usr/bin/env node
/**
 * pipeline/verify · replay — **D4 最小切片**：真实运行时加载回放。
 *
 * 目的：`data/compat-observed.json` 的 broken/never 判定是**静态分析**（扫 client
 * bundle 的 require 字面量 × shell 模块表）。2026-09-10 的 vision-router 误报证明
 * 静态口径会漏掉两层：① 图行工厂注册（require 在调用时可解析）② host 侧 tapIndex
 * 改写模块面。本阶段用**真实 shell + 真实浏览器**跑一遍，把「加载即崩」从推断
 * 升级为事实——这是高危触达（指控作者插件崩溃）的**发送前门禁**。
 *
 * 做法（每个目标 2 次启动，baseline 只需一次）：
 *   1. 隔离 DSH_HOME（默认 ./.d4-sandbox/home，绝不碰用户的 ~/.dsh）
 *   2. 从 dsh 自带模板造一个干净 profile
 *   3. `dsh plugin --profile <n> add <pkg>@<version>`（会写进 dsh.profile.bundles）
 *   4. `dsh --profile <n> web --port 0 --no-open` 起真实 shell，取带 token 的 URL
 *   5. headless Chromium（CDP）打开该 URL，抓 Runtime exception / console error / Log error
 *   6. 与 baseline（同流程不装插件）做差集 → 归因，给 verdict
 *
 * ⚠️ 安全边界：本阶段会**真实执行第三方 npm 包的 host 侧代码**（在隔离 DSH_HOME
 * 与临时 profile 内，不写用户目录、不装进用户的 profile）。因此它**不进任何自动
 * profile**（hourly/daily/monday/snapshot），只在 CI 或本机手动跑。
 *
 * 用法：
 *   node pipeline/verify/replay.mjs FSMargoo/dsh-at-file Tkingxiao/dsh-any-background
 *   node pipeline/verify/replay.mjs --baseline-only
 *   node pipeline/verify/replay.mjs --fresh-baseline <targets…>
 *   node pipeline/verify/replay.mjs --settle 12000 <targets…>
 *
 * Output: data/replay.json
 *
 * @module dsh-insights/pipeline-verify-replay
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PATHS, ROOT, readJsonl, readJson } from '../../lib/data.mjs'
import { capturePage, findChrome, launchChrome, sleep } from '../../lib/cdp.mjs'

const DSH = process.env.DSH_BIN || 'dsh'
const SANDBOX = process.env.DSH_REPLAY_SANDBOX || join(ROOT, '.d4-sandbox')
const HOME_DIR = join(SANDBOX, 'home')
const OUT = join(ROOT, 'data', 'replay.json')

/** 页面探针：应用真的挂起来了吗（而不是白屏 / 启动即崩）。 */
const PROBE = `JSON.stringify({
  title: document.title,
  bodyLen: document.body ? document.body.innerHTML.length : 0,
  roots: Array.from(document.querySelectorAll('#root,#app,.app,[data-dsh-root]')).map(e => e.childElementCount)
})`

/** 归因：这些签名说明「插件加载失败」，而不是无关噪声（favicon 404 之类不计）。 */
const LOAD_FAIL_RE = /Failed to resolve|Cannot find module|does not provide an export|Module not found|ERR_MODULE_NOT_FOUND|Unable to resolve|error loading plugin|failed to load plugin|Cannot read properties of undefined \(reading 'client'\)|not a function \(reading/i

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
}

function dshEnv(extra = {}) {
  return { ...process.env, DSH_HOME: HOME_DIR, ...extra }
}

// 用 `web` 这个内置 profile 名（在隔离的 DSH_HOME 里）：`dsh plugin --profile web add`
// 会自动以 web 模板建号（bundles 含 @deepseek-ai/dsh-web-app），`dsh web` 直接可启。
// 自定义 profile 名走 `dsh --profile X` 时拿不到 web app 的 --port/--no-open，故不采用。
const PROFILE = 'web'

function resetProfile() {
  rmSync(join(HOME_DIR, 'profiles', PROFILE), { recursive: true, force: true })
}

function addPlugin(spec) {
  run(DSH, ['plugin', '--profile', PROFILE, 'add', spec], { env: dshEnv(), timeout: 240000 })
}

/** 起真实 shell，返回 { url, proc }。 */
async function bootShell({ bootTimeoutMs = 90000 } = {}) {
  clearStaleLocks() // 上一轮残留的 atomic-write 锁会让本次启动直接超时（见 clearStaleLocks 注释）
  const proc = spawn(DSH, ['web', '--port', '0', '--no-open'], {
    env: dshEnv(),
    detached: true, // 自成进程组，便于整组回收
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let buf = ''
  const url = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), bootTimeoutMs)
    const onData = (d) => {
      buf += String(d)
      const m = /(http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+)/.exec(buf)
      if (m) { clearTimeout(t); resolve(m[1]) }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)
    proc.on('exit', () => { clearTimeout(t); resolve(null) })
  })
  return { url, proc, log: buf }
}

/**
 * 清掉沙箱里残留的 atomic-write 锁。
 *
 * 踩坑记录：dsh 用 `$DSH_HOME/.credentials.yaml.lock` 这类文件做写入互斥，被
 * SIGKILL 的 shell 不会自己释放；残留的锁会让**下一个** shell 启动时
 * `atomic-write: timed out waiting for the writer lock` 而失败——表现为
 * 「所有插件（含已知正常的对照组）都 broken」的环境性假阳性。沙箱归本阶段独占，
 * 且每次 boot 前都确认上一轮进程组已回收，故可直接清理。
 */
function clearStaleLocks(dir = HOME_DIR, depth = 4) {
  if (depth < 0 || !existsSync(dir)) return 0
  let n = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      n += clearStaleLocks(p, depth - 1)
    } else if (e.name.endsWith('.lock')) {
      rmSync(p, { force: true })
      n++
    }
  }
  return n
}

/** 先 SIGTERM 给 shell 机会自己释放锁/端口，超时才 SIGKILL 整组。 */
async function killShell(proc) {
  if (!proc) return
  try { process.kill(-proc.pid, 'SIGTERM') } catch { try { proc.kill('SIGTERM') } catch {} }
  for (let i = 0; i < 20; i++) {
    if (proc.exitCode !== null || proc.signalCode) break
    await sleep(150)
  }
  try { process.kill(-proc.pid, 'SIGKILL') } catch { try { proc.kill('SIGKILL') } catch {} }
  await sleep(300)
}

const norm = (t) => String(t).replace(/\s+/g, ' ').trim().slice(0, 300)

/**
 * 从 shell 启动日志里抽一条人话的失败根因（host 侧启动即崩时，这是唯一证据源，
 * 且往往比 client bundle 的静态判定更准确——dsh-at-file 即为例：静态说 client
 * require 有问题，真实运行报的是 host 侧 `settingsNamespace` 导出不存在）。
 */
export function extractShellError(log) {
  const text = String(log || '')
  const hit = /(?:Error|SyntaxError|TypeError):\s*([^\n]{0,300})/.exec(text)
  if (hit) return hit[1].trim()
  const line = text.split('\n').map((l) => l.trim()).filter(Boolean).pop()
  return line ? line.slice(0, 300) : null
}

/** 跑一次「装/不装插件 → 起 shell → 开页面」，返回观测。 */
async function observe({ label, chromeUserDir, settleMs }) {
  const t0 = Date.now()
  let { url, proc, log } = await bootShell()
  // 锁竞争是环境性噪声（不是插件缺陷）：清锁重试一次，避免把「对照组也 broken」的假阳性
  // 当成结论。重试后仍失败才算插件问题。
  if (!url && /writer lock/.test(String(log))) {
    console.log('[replay]   命中残留写锁，清锁后重试一次…')
    clearStaleLocks()
    ;({ url, proc, log } = await bootShell())
  }
  if (!url) {
    await killShell(proc)
    clearStaleLocks()
    return {
      label,
      appBooted: false,
      shellBooted: false,
      exitCode: proc.exitCode,
      shellError: extractShellError(log),
      shellLog: String(log).slice(-2000),
      errors: [],
      probe: null,
      durationMs: Date.now() - t0,
    }
  }
  const cdp = await launchChrome({ userDataDir: chromeUserDir })
  try {
    const { errors, probe } = await capturePage(cdp, { url, settleMs, probeExpr: PROBE })
    const parsed = (() => { try { return JSON.parse(probe) } catch { return null } })()
    return {
      label,
      shellBooted: true,
      appBooted: Boolean(parsed && parsed.bodyLen > 500),
      probe: parsed,
      errors,
      durationMs: Date.now() - t0,
    }
  } finally {
    cdp.close()
    await killShell(proc)
    clearStaleLocks()
    await sleep(300)
  }
}

/** 解析目标：owner/repo → 权威集里的 pkgName + npm latest；pkg@ver 直接透传。 */
function resolveTargets(list) {
  const plugins = readJsonl(PATHS.plugins)
  const byName = new Map(plugins.map((p) => [p.full_name, p]))
  const out = []
  for (const t of list) {
    if (t.includes('@') && !t.startsWith('@') ) {
      const [pkg, version] = t.split('@')
      out.push({ target: t, pkg, version, repo: null })
      continue
    }
    if (t.startsWith('@') && t.split('@').length > 2) {
      const i = t.lastIndexOf('@')
      out.push({ target: t, pkg: t.slice(0, i), version: t.slice(i + 1), repo: null })
      continue
    }
    const p = byName.get(t)
    if (!p) { out.push({ target: t, error: 'not in authoritative set' }); continue }
    if (!p.pkgName || !p.npm?.published) { out.push({ target: t, error: 'not published to npm (cannot install)' }); continue }
    out.push({ target: t, repo: t, pkg: p.pkgName, version: p.npm.latest, repoStars: p.stars ?? 0 })
  }
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
  const settleMs = Number(flag('--settle', 9000))
  const baselineOnly = argv.includes('--baseline-only')
  const freshBaseline = argv.includes('--fresh-baseline')
  const targets = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--settle'))

  mkdirSync(SANDBOX, { recursive: true })
  const baselinePath = join(SANDBOX, 'baseline.json')
  const chrome = findChrome()
  if (!chrome) { console.error('[replay] 找不到 Chromium —— 装 `npx playwright install chromium` 或设 DSH_REPLAY_CHROME'); process.exit(2) }
  console.log(`[replay] shell=${run(DSH, ['--version'], { env: dshEnv() }).trim()} · sandbox=${SANDBOX}`)

  // ---- baseline：干净 profile，不装任何插件 ----
  let baseline
  if (!freshBaseline && existsSync(baselinePath)) {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
    console.log(`[replay] baseline 复用 ${baseline.at}`)
  } else {
    console.log('[replay] baseline 采集（干净 profile）…')
    resetProfile()
    baseline = await observe({ label: 'baseline', chromeUserDir: join(SANDBOX, 'chrome-baseline'), settleMs })
    baseline.at = new Date().toISOString()
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2))
    console.log(`[replay] baseline: appBooted=${baseline.appBooted} errors=${baseline.errors.length}`)
  }
  if (baselineOnly) { console.log('[replay] --baseline-only，结束'); return }

  if (!targets.length) { console.error('[replay] 没有目标。用法: node pipeline/verify/replay.mjs <owner/repo> […]'); process.exit(2) }

  const baselineSet = new Set(baseline.errors.map((e) => norm(e.text)))
  const resolved = resolveTargets(targets)

  const results = []
  for (const [i, t] of resolved.entries()) {
    if (t.error) { console.log(`[replay] SKIP ${t.target} — ${t.error}`); results.push({ ...t, verdict: 'skipped' }); continue }
    const name = `d4-${i + 1}`
    console.log(`[replay] ${t.repo || t.target} → ${t.pkg}@${t.version} …`)
    resetProfile()
    let installError = null
    try { addPlugin(`${t.pkg}@${t.version}`) } catch (e) { installError = String(e.stderr || e.message).slice(0, 300) }
    if (installError) {
      console.log(`[replay]   install 失败：${installError.slice(0, 120)}`)
      results.push({ ...t, verdict: 'install-failed', installError }); continue
    }
    const obs = await observe({ label: name, chromeUserDir: join(SANDBOX, `chrome-${name}`), settleMs })
    const novel = obs.errors.filter((e) => !baselineSet.has(norm(e.text)))
    const loadFail = novel.filter((e) => LOAD_FAIL_RE.test(e.text))
    const [verdict, reason] = !obs.shellBooted ? ['broken', 'shell-boot-failed']
      : !obs.appBooted ? ['broken', 'app-did-not-mount']
        : loadFail.length ? ['broken', 'page-load-error']
          : novel.length ? ['degraded', 'page-novel-errors']
            : ['ok', 'loaded']
    console.log(`[replay]   → ${verdict}（${reason} · appBooted=${obs.appBooted} · novel=${novel.length}）`)
    if (obs.shellError) console.log(`        shell: ${obs.shellError.slice(0, 180)}`)
    for (const e of (loadFail.length ? loadFail : novel).slice(0, 3)) console.log(`        ${e.kind}: ${e.text.slice(0, 160)}`)
    results.push({
      ...t,
      verdict,
      reason,
      appBooted: obs.appBooted,
      shellBooted: obs.shellBooted,
      shellError: obs.shellError ?? null,
      shellLog: obs.shellBooted ? null : obs.shellLog,
      novelErrors: novel.slice(0, 12),
      loadFailErrors: loadFail.slice(0, 6),
      probe: obs.probe,
      durationMs: obs.durationMs,
    })
    writeFileSync(OUT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      shell: run(DSH, ['--version'], { env: dshEnv() }).trim(),
      method: '真实 shell（dsh web）+ headless Chromium（CDP）加载真实插件；与干净 profile baseline 做差集归因。非静态分析。',
      baseline: { appBooted: baseline.appBooted, errorCount: baseline.errors.length },
      targets: results,
    }, null, 2))
    rmSync(join(SANDBOX, `chrome-${name}`), { recursive: true, force: true })
  }

  const ok = results.filter((r) => r.verdict === 'ok').length
  const broken = results.filter((r) => r.verdict === 'broken').length
  console.log(`[replay] 完成：${results.length} 个目标 · ok ${ok} · broken ${broken} → data/replay.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('[replay] 失败：', e); process.exit(1) })
}

export { resolveTargets, observe }
