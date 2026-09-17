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

/**
 * 首启弹窗关闭器：shell 首次启动会弹「Internal Testing Notice」，**盖住整个 UI**。
 * 不关掉的话截图全是同一张公告图、插件面板也看不见，截图这项能力等于白做。
 */
const DISMISS = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim()
  const els = Array.from(document.querySelectorAll('button, [role="button"], a'))
  const hit = els.find((el) => /^(continue|got it|ok|知道了|继续|我同意|同意)$/i.test(norm(el.textContent)))
  if (hit) { hit.click(); return 'clicked:' + norm(hit.textContent) }
  const dlg = document.querySelector('dialog[open], [role="dialog"]')
  if (dlg) { const b = dlg.querySelector('button'); if (b) { b.click(); return 'dialog-clicked' } }
  return 'none'
})()`

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

/**
 * append-only 合并：同一 (date, shell, repo) 用新行覆盖（当天重跑不产生重复行），
 * 其余历史一律保留——历史是「修好了」事件与崩溃率趋势的唯一来源，绝不能丢。
 */
export function mergeHistoryRows(prevRows, freshRows) {
  const key = (r) => `${r.date}|${r.shell}|${r.repo}`
  const fresh = new Set(freshRows.map(key))
  return [...prevRows.filter((r) => !fresh.has(key(r))), ...freshRows]
}

/**
 * 读装出来的插件目录，拿**安装期**就能看到的事实（供应链信号）。 */
export function readInstalledMeta(pkg) {
  const dir = join(HOME_DIR, 'profiles', PROFILE, 'node_modules', pkg)
  try {
    const pj = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const scripts = pj.scripts || {}
    const lifecycle = ['preinstall', 'install', 'postinstall', 'prepare'].filter((s) => scripts[s])
    return {
      depCount: Object.keys(pj.dependencies || {}).length,
      peerCount: Object.keys(pj.peerDependencies || {}).length,
      installScripts: lifecycle,
      license: pj.license ?? null,
      declaredEnginesDsh: pj.dsh?.engines?.dsh ?? null,
    }
  } catch { return null }
}

/** 跑一次「装/不装插件 → 起 shell → 开页面」，返回观测。 */
async function observe({ label, chromeUserDir, settleMs, wantShot = false }) {
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
      hostBootMs: null,
      exitCode: proc.exitCode,
      shellError: extractShellError(log),
      shellLog: String(log).slice(-2000),
      errors: [],
      warnings: [],
      egress: [],
      probe: null,
      screenshot: null,
      durationMs: Date.now() - t0,
    }
  }
  const hostBootMs = Date.now() - t0 // 进程起来到 URL 可用 = host 侧启动耗时
  const cdp = await launchChrome({ userDataDir: chromeUserDir })
  try {
    const { errors, warnings, egress, probe, screenshot } = await capturePage(cdp, {
      url, settleMs, probeExpr: PROBE, network: true, dismissExpr: DISMISS,
      screenshot: wantShot ? { width: 1280, height: 800, format: 'webp', quality: 70 } : null,
    })
    const parsed = (() => { try { return JSON.parse(probe) } catch { return null } })()
    return {
      label,
      shellBooted: true,
      appBooted: Boolean(parsed && parsed.bodyLen > 500),
      hostBootMs,
      probe: parsed,
      errors,
      warnings: [...new Map(warnings.map((w) => [norm(w.text), w])).values()].slice(0, 20),
      egress,
      screenshot,
      durationMs: Date.now() - t0,
    }
  } finally {
    cdp.close()
    await killShell(proc)
    clearStaleLocks()
    await sleep(300)
  }
}

/**
 * 取 npm 上的**真实** latest。
 *
 * 为什么不能直接用权威集里的 `npm.latest`：那是 `validate` 首次校验时冻结的，
 * 而 `refresh` 只刷新 stars/pushed_at 等字段、不重探 npm（与 health-v6 修的活跃度
 * 是同一类缺陷）。实测抽样 40 个已发布插件，**约 25% 的 corpus 版本已过期**——
 * 拿它做回放等于验一个旧包。所以这里现探 registry，并记下 drift 供反馈。
 */
async function npmLatest(pkg) {
  try {
    const r = await fetch(`https://registry.npmjs.org/-/package/${encodeURIComponent(pkg)}/dist-tags`, {
      headers: { 'user-agent': 'dsh-insights' },
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    return (await r.json()).latest ?? null
  } catch { return null }
}

/** 解析目标：owner/repo → pkgName + **真实** npm latest；pkg@version 直接透传。 */
async function resolveTargets(list) {
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
    const real = await npmLatest(p.pkgName)
    const corpusVersion = p.npm.latest ?? null
    out.push({
      target: t, repo: t, pkg: p.pkgName,
      version: real || corpusVersion,
      corpusVersion,
      versionDrift: Boolean(real && corpusVersion && real !== corpusVersion),
      repoStars: p.stars ?? 0,
    })
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
  const resolved = await resolveTargets(targets)
  // 截图只给「S/A 级 + 回放通过」的插件出（控制仓库体积；顺带是优质插件的正向激励）
  const grades = new Map(readJson(PATHS.enrich, []).map((e) => [e.full_name, e.grade]))
  const shotsDir = join(ROOT, 'data', 'replay-shots')
  const shellVersion = run(DSH, ['--version'], { env: dshEnv() }).trim()
  const today = new Date().toISOString().slice(0, 10)

  const results = []
  for (const [i, t] of resolved.entries()) {
    if (t.error) { console.log(`[replay] SKIP ${t.target} — ${t.error}`); results.push({ ...t, verdict: 'skipped' }); continue }
    const name = `d4-${i + 1}`
    const grade = t.repo ? grades.get(t.repo) : null
    const wantShot = grade === 'S' || grade === 'A'
    console.log(`[replay] ${t.repo || t.target} → ${t.pkg}@${t.version} …${wantShot ? '（S/A，出图）' : ''}${t.versionDrift ? `（corpus 记的是 ${t.corpusVersion}，已按 npm 真实版本修正）` : ''}`)
    resetProfile()
    let installError = null
    try { addPlugin(`${t.pkg}@${t.version}`) } catch (e) { installError = String(e.stderr || e.message).slice(0, 300) }
    if (installError) {
      console.log(`[replay]   install 失败：${installError.slice(0, 120)}`)
      results.push({ ...t, verdict: 'install-failed', installError }); continue
    }
    const installed = readInstalledMeta(t.pkg)
    const obs = await observe({ label: name, chromeUserDir: join(SANDBOX, `chrome-${name}`), settleMs, wantShot })
    const novel = obs.errors.filter((e) => !baselineSet.has(norm(e.text)))
    const novelWarn = obs.warnings.filter((w) => !baselineSet.has(norm(w.text)))
    const loadFail = novel.filter((e) => LOAD_FAIL_RE.test(e.text))
    const [verdict, reason] = !obs.shellBooted ? ['broken', 'shell-boot-failed']
      : !obs.appBooted ? ['broken', 'app-did-not-mount']
        : loadFail.length ? ['broken', 'page-load-error']
          : novel.length ? ['degraded', 'page-novel-errors']
            : ['ok', 'loaded']
    // 截图落盘：只在「通过 + S/A」时保留，其余直接丢（别把 broken 的空白图入库）
    let shotPath = null
    if (obs.screenshot && verdict === 'ok' && wantShot && t.repo) {
      mkdirSync(shotsDir, { recursive: true })
      shotPath = join('data', 'replay-shots', `${t.repo.replace('/', '__')}.webp`)
      writeFileSync(join(ROOT, shotPath), Buffer.from(obs.screenshot, 'base64'))
    }
    console.log(`[replay]   → ${verdict}（${reason} · appBooted=${obs.appBooted} · novel=${novel.length} · 出站 ${obs.egress.length} · ${obs.hostBootMs ?? '—'}ms）`)
    if (obs.shellError) console.log(`        shell: ${obs.shellError.slice(0, 180)}`)
    for (const e of (loadFail.length ? loadFail : novel).slice(0, 3)) console.log(`        ${e.kind}: ${e.text.slice(0, 160)}`)
    results.push({
      ...t,
      grade: grade ?? null,
      verdict,
      reason,
      appBooted: obs.appBooted,
      shellBooted: obs.shellBooted,
      shellError: obs.shellError ?? null,
      shellLog: obs.shellBooted ? null : obs.shellLog,
      hostBootMs: obs.hostBootMs ?? null,
      page: obs.probe ?? null,
      errors: { novel: novel.length, loadFail: loadFail.length, sample: (loadFail.length ? loadFail : novel).slice(0, 6) },
      warnings: novelWarn.slice(0, 10),
      egress: obs.egress,
      installed,
      shot: shotPath,
      durationMs: obs.durationMs,
      at: new Date().toISOString(),
    })
    writeFileSync(OUT, JSON.stringify({
      format: 'replay-v1',
      generatedAt: new Date().toISOString(),
      shell: shellVersion,
      method: '真实 shell（dsh web）+ headless Chromium（CDP）加载真实插件；与干净 profile baseline 做差集归因。非静态分析。',
      signals: ['verdict', 'shellError', 'hostBootMs', 'page', 'errors', 'warnings', 'egress', 'installed', 'shot'],
      note: 'egress = 观测到的外部请求主机名（只留 host、剥掉路径/query，排除 shell 自身与 localhost）。这是**观测事实，非安全审计**，不得据此断言插件恶意。',
      baseline: { appBooted: baseline.appBooted, errorCount: baseline.errors.length },
      targets: results,
    }, null, 2))
    rmSync(join(SANDBOX, `chrome-${name}`), { recursive: true, force: true })
  }

  // ---- append-only 时间序列：同一 (date,shell,repo) 覆盖，其余保留。
  // 有了它才能派生「修好了」事件（上周 broken → 本周 ok）与崩溃率趋势。----
  const histPath = join(ROOT, 'data', 'replay-history.jsonl')
  const prevRows = existsSync(histPath)
    ? readFileSync(histPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    : []
  const freshRows = results
    .filter((r) => r.repo && r.verdict !== 'skipped')
    .map((r) => ({
      format: 'replay-history-v1', date: today, shell: shellVersion,
      repo: r.repo, pkg: r.pkg, version: r.version,
      verdict: r.verdict, reason: r.reason ?? null,
      hostBootMs: r.hostBootMs ?? null, egressCount: (r.egress || []).length,
      versionDrift: Boolean(r.versionDrift),
    }))
  const allRows = mergeHistoryRows(prevRows, freshRows)
  writeFileSync(histPath, allRows.map((r) => JSON.stringify(r)).join('\n') + '\n')

  const ok = results.filter((r) => r.verdict === 'ok').length
  const broken = results.filter((r) => r.verdict === 'broken').length
  console.log(`[replay] 完成：${results.length} 个目标 · ok ${ok} · broken ${broken} → data/replay.json（历史 ${allRows.length} 行）`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('[replay] 失败：', e); process.exit(1) })
}

export { resolveTargets, observe }
