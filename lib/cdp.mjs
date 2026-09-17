/**
 * lib/cdp — 零依赖 headless Chromium 驱动（D4 实装 smoke 测试用）。
 *
 * 为什么不用 playwright：本管线保持零运行时依赖（package.json 无 dependencies）。
 * Node ≥22 自带全局 WebSocket，配合 CDP（Chrome DevTools Protocol）的
 * Target/Runtime/Log 三个域就够做「真实浏览器加载真实 shell，抓真实报错」。
 * 浏览器二进制复用 Playwright 已下载的缓存（不额外下载，也不依赖其 npm 包）。
 *
 * 踩过的坑（别改回去）：
 *   - 必须 `--no-sandbox`：本机文件沙箱会挡掉 Chrome 写
 *     ~/Library/Application Support/.../Crashpad，进程随后不稳定、ws 会在
 *     一两秒后以 1006 断开（表现为「连接成功但所有命令超时」）。
 *   - 必须 `--remote-allow-origins=*`（Chrome ≥111 起 CDP ws 的准入校验）。
 *   - page target 的 ws 端点会被立刻关闭；用 **browser 端点 + flatten session**。
 *
 * @module dsh-insights/lib-cdp
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 在 Playwright 的浏览器缓存里找可用的 Chromium（可用 DSH_REPLAY_CHROME 覆盖）。 */
export function findChrome() {
  if (process.env.DSH_REPLAY_CHROME) return process.env.DSH_REPLAY_CHROME
  const plat = process.env.PLAYWRIGHT_BROWSERS_PATH
    || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : process.platform === 'win32' ? join(process.env.LOCALAPPDATA || homedir(), 'ms-playwright')
        : join(homedir(), '.cache', 'ms-playwright'))
  if (!existsSync(plat)) return null
  const cands = []
  for (const d of readdirSync(plat)) {
    if (!/^chromium(-headless-shell)?-\d+$/.test(d)) continue
    for (const rel of [
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-linux/chrome',
      'chrome-linux64/chrome',
      'chrome-headless-shell-linux64/chrome-headless-shell',
    ]) cands.push(join(plat, d, rel))
  }
  return cands.find((p) => existsSync(p)) || null
}

/** 极简 CDP 客户端：browser 端点 + flatten session。 */
export class Cdp {
  constructor(ws, chromeProc) {
    this.ws = ws
    this.proc = chromeProc
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (m) => {
      let s = m.data
      if (typeof s !== 'string') s = Buffer.from(s).toString('utf8')
      let msg
      try { msg = JSON.parse(s) } catch { return }
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id) }
      else if (msg.method) this.events.push(msg)
    })
  }

  send(method, params = {}, sessionId = null, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const id = ++this.id
      const t = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`cdp timeout: ${method}`))
      }, timeoutMs)
      this.pending.set(id, (msg) => {
        clearTimeout(t)
        if (msg.error) reject(new Error(`cdp ${method}: ${msg.error.message}`))
        else resolve(msg.result)
      })
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }

  close() {
    try { this.ws.close() } catch {}
    try { this.proc.kill('SIGKILL') } catch {}
  }
}

/** 启动 headless Chromium 并连上 CDP。 */
export async function launchChrome({ chromePath, userDataDir, debugPort = 0, extraArgs = [] } = {}) {
  const bin = chromePath || findChrome()
  if (!bin) throw new Error('no chromium found — set DSH_REPLAY_CHROME or install playwright browsers')
  const port = debugPort || 0
  const proc = spawn(bin, [
    '--headless=new',
    ...(port ? [`--remote-debugging-port=${port}`] : ['--remote-debugging-port=0']),
    '--remote-allow-origins=*',
    '--no-sandbox',            // 见文件头：缺它会在本机沙箱下 1006 断连
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--disable-extensions', '--disable-background-networking',
    '--disable-crash-reporter', '--disable-breakpad',
    '--disable-component-update', '--disable-sync',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
    ...extraArgs,
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  // 端口写死时轮询 HTTP；否则从 stderr 的 "DevTools listening on ws://…" 取
  let wsUrl = null
  if (port) {
    for (let i = 0; i < 60 && !wsUrl; i++) {
      await sleep(200)
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl
      } catch {}
    }
  } else {
    wsUrl = await new Promise((resolve) => {
      let buf = ''
      const t = setTimeout(() => resolve(null), 15000)
      proc.stderr.on('data', (d) => {
        buf += String(d)
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf)
        if (m) { clearTimeout(t); resolve(m[1]) }
      })
      proc.on('exit', () => { clearTimeout(t); resolve(null) })
    })
  }
  if (!wsUrl) { proc.kill('SIGKILL'); throw new Error('chromium devtools endpoint never came up') }

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('cdp ws open timeout')), 10000)
    ws.addEventListener('open', () => { clearTimeout(t); resolve() })
    ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('cdp ws error')) })
  })
  return new Cdp(ws, proc)
}

const LEVEL_RE = /^(error|warning)$/

/**
 * 打开一个 URL，收集这段时间内的真实观测，然后在页面里跑一段探针表达式。
 *
 * 设计取向：**一次真实运行要多榨出事实**——起浏览器是最贵的一步，页活着的时候
 * 多拿一份事实的边际成本接近零。所以除报错外还顺手采：外部网络出站（Network 域）、
 * 控制台警告全文、以及可选的页面截图。
 *
 * @param {object} opts
 * @param {boolean} [opts.network]    是否采外部出站主机名（默认 true）
 * @param {object}  [opts.screenshot] 传 { width, height, format, quality } 则截图
 * @returns {{errors:Array, warnings:Array, egress:string[], probe:any, screenshot:string|null, loaded:boolean}}
 */
export async function capturePage(cdp, {
  url, settleMs = 9000, probeExpr = null, network = true, screenshot = null, dismissExpr = null,
} = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const from = cdp.events.length
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Log.enable', {}, sessionId)
  await cdp.send('Page.enable', {}, sessionId)
  if (network) await cdp.send('Network.enable', {}, sessionId)
  if (screenshot) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: screenshot.width || 1280, height: screenshot.height || 800,
      deviceScaleFactor: 1, mobile: false,
    }, sessionId)
  }
  await cdp.send('Page.navigate', { url }, sessionId)
  // 分两段等待：先给应用挂载的时间，跑一次「关掉首启弹窗」，再等它渲染完。
  // 不关弹窗的话，截图全是同一张「Internal Testing Notice」，插件 UI 被盖住。
  const mountMs = Math.min(4000, Math.round(settleMs * 0.45))
  await sleep(mountMs)
  if (dismissExpr) {
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: dismissExpr, returnByValue: true }, sessionId)
      if (r?.result?.value) console.log(`[cdp] dismiss → ${r.result.value}`)
    } catch {}
  }
  await sleep(Math.max(1000, settleMs - mountMs))

  const errors = []
  const warnings = []
  const egress = new Set()
  const seen = new Set()
  let ownOrigin = null
  try { ownOrigin = new URL(url).host } catch {}

  for (const e of cdp.events.slice(from)) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {}
      const desc = d.exception?.description || d.text || ''
      errors.push({ kind: 'exception', text: String(desc).split('\n')[0].slice(0, 400), source: 'runtime' })
    } else if (e.method === 'Runtime.consoleAPICalled') {
      const text = (e.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400)
      const type = e.params?.type
      // 保持原有 verdict 语义：error 与 warning 都进 errors（差集归因用）；
      // warning 另存一份进 warnings，作为「质量信号」单独消费。
      if (type === 'error') errors.push({ kind: 'console.error', text, source: 'console' })
      else if (type === 'warning') {
        warnings.push({ kind: 'console.warning', text })
        errors.push({ kind: 'console.warning', text, source: 'console' })
      }
    } else if (e.method === 'Log.entryAdded') {
      const lvl = e.params?.entry?.level
      const text = String(e.params.entry.text || '').slice(0, 400)
      if (lvl === 'warning') warnings.push({ kind: 'log.warning', text })
      if (LEVEL_RE.test(lvl)) errors.push({ kind: `log.${lvl}`, text, source: 'log' })
    } else if (network && e.method === 'Network.requestWillBeSent') {
      // 只留 host：路径/query 可能带 token 或用户数据，进数据集一律剥掉
      const u = e.params?.request?.url || ''
      const m = /^https?:\/\/([^/?#]+)/i.exec(u)
      if (m) {
        const host = m[1].toLowerCase()
        if (host !== ownOrigin && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) && !seen.has(host)) {
          seen.add(host)
          egress.add(host)
        }
      }
    }
  }

  let probe = null
  if (probeExpr) {
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: probeExpr, returnByValue: true }, sessionId)
      probe = r?.result?.value ?? null
    } catch {}
  }

  let shot = null
  if (screenshot) {
    try {
      const r = await cdp.send('Page.captureScreenshot', {
        format: screenshot.format || 'webp',
        quality: screenshot.quality ?? 70,
        captureBeyondViewport: false,
      }, sessionId, 20000)
      shot = r?.data || null
    } catch {}
  }

  await cdp.send('Target.closeTarget', { targetId }).catch(() => {})
  return { errors, warnings, egress: [...egress].sort(), probe, screenshot: shot, loaded: probe != null }
}

export { sleep }
