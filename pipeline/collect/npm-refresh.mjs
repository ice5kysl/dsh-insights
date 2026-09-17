#!/usr/bin/env node
/**
 * pipeline/collect · npm-refresh — 让权威集的 npm 数据保持新鲜。
 *
 * 背景（health-v7，2026-09-17）：`r.npm`（latest/versions/latestTime）由 `validate`
 * 首次校验时算完即**永久冻结**，而 `refresh.mjs` 只刷新 stars/pushed_at/archived/
 * fork/topics——于是版本号会一直停在入库那天。抽样重探 40 个已发布插件，**约 25%
 * 的版本号已过期**（与 health-v6 修掉的活跃度是同一类缺陷）。它不只是显示问题：
 * `npm.version-drift` 是计分规则；更糟的是 D4 回放会据此安装**旧包**，从而制造假阳性
 * （dsh-any-background：corpus 记 0.2.2 崩、npm 真实 0.2.9 早已修好）。
 *
 * 做法（两级，把成本压到可日跑）：
 *   1. 每个有 pkgName 的行做一次极廉价的 `/-/package/<pkg>/dist-tags` 探测（几百字节）
 *      · latest 未变 → 什么都不用改（versions/latestTime 都是从 latest 派生的）
 *      · latest 变了 / 首次发布 → 才拉一次完整 packument，更新 versions / latestTime
 *   2. 未发布的行同样被探测，**首次发布**（未发布 → 已发布）会被抓到
 *
 * 只在该改的时候改：没有实质变化就**不写文件、不更新任何时间戳**——避免每天把
 * 11k 行全改一遍（那会让仓库每天多出一个整文件 diff）。
 *
 * 成本：~11k 次小请求/天（并发 12 ≈ 2 分钟）+ 少量完整 packument（仅当天真有新版发布的包）。
 * 只想压成本时用 `--published-only`（未发布的行不动）。
 *
 * 失败纪律：瞬时失败（网络/5xx/429）**绝不清空已有数据**，只计数；404 才判定为
 * 「registry 上不存在」。写入用 tmp+rename 原子替换，并与 validate 并发时放弃写入。
 *
 * Usage:
 *   node pipeline/collect/npm-refresh.mjs                # 全量探测（已发布 + 未发布）
 *   node pipeline/collect/npm-refresh.mjs --published-only
 *   node pipeline/collect/npm-refresh.mjs --limit 200 --concurrency 16
 *
 * Output: data/plugins.jsonl（仅在有实质变化时原地更新 npm 字段）
 *
 * @module dsh-insights/pipeline-collect-npm-refresh
 */

import { readFileSync, writeFileSync, statSync, renameSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PATHS } from '../../lib/data.mjs'
import { NPM, npmDoc } from '../../lib/api.mjs'

/** 廉价探测：只取 dist-tags（几百字节）。
 *
 * 状态判定（实测，2026-09-17）：
 *   - 200 → ok
 *   - **401/403 → missing**：npm 对「不存在的作用域包」在 `/-/package/<spec>/dist-tags`
 *     上返回 401 Unauthorized 而不是 404（避免泄露私有包是否存在），而完整 packument
 *     对同一个包返回 404。私有包对匿名请求同样是 401 —— 两者都「公网装不上」，
 *     归为 missing 是对的。**曾经把它当瞬时失败，导致每次都白重试一遍。**
 *   - 404（unscoped 不存在）→ missing
 *   - 网络异常 / 429 / 5xx → transient（保留原值，绝不因此清空数据）
 */
export async function distTags(name) {
  const url = `${NPM}/-/package/${encodeURIComponent(name)}/dist-tags`
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': 'dsh-insights', accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (r.status === 404 || r.status === 401 || r.status === 403) return { state: 'missing', status: r.status }
    if (!r.ok) return { state: 'transient', status: r.status }
    const d = await r.json()
    return { state: 'ok', latest: d?.latest ?? null }
  } catch (e) {
    return { state: 'transient', error: String(e?.message || e).slice(0, 120) }
  }
}

/** 极简并发池（管线零依赖，不引 p-limit）。 */
export async function pool(items, concurrency, worker) {
  const out = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return out
}

/**
 * 比较并更新一行的 npm 字段。
 * @returns {'changed'|'first'|'removed'|'none'|'transient'} 实际发生了什么
 */
export function applyNpmProbe(row, probe, doc) {
  const prev = row.npm || {}
  if (probe.state === 'transient') return 'transient'
  if (probe.state === 'missing') {
    if (prev.published === true) {
      row.npm = { ...prev, published: false }
      return 'removed'
    }
    if (prev.published === false) return 'none'
    row.npm = { published: false }
    return 'none'
  }
  // probe.state === 'ok'
  if (prev.published === true && prev.latest === probe.latest) return 'none'
  if (!prev.published) {
    if (!doc) return 'transient'
    row.npm = { published: true, latest: doc.latest ?? probe.latest, versions: doc.versions ?? null, latestTime: doc.latestTime ?? null }
    return 'first'
  }
  if (!doc) return 'transient'
  row.npm = { published: true, latest: doc.latest ?? probe.latest, versions: doc.versions ?? prev.versions ?? null, latestTime: doc.latestTime ?? null }
  return 'changed'
}

async function main() {
  const argv = process.argv.slice(2)
  const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
  const limit = Number(flag('--limit', 0)) || 0
  const concurrency = Number(flag('--concurrency', 12)) || 12
  const publishedOnly = argv.includes('--published-only')

  const before = statSync(PATHS.plugins)
  const lines = readFileSync(PATHS.plugins, 'utf8').split('\n').filter(Boolean)
  // 解析失败的行原样保留（refresh.mjs 同款纪律，绝不因解析失败丢行）
  const rows = lines.map((l) => { try { return { ok: true, obj: JSON.parse(l) } } catch { return { ok: false, raw: l } } })

  const targets = rows
    .filter((r) => r.ok && r.obj.pkgName && (!publishedOnly || r.obj.npm?.published === true))
    .map((r) => r.obj)
  const picked = limit ? targets.slice(0, limit) : targets
  console.log(`[npm-refresh] 目标 ${picked.length}（已发布 ${picked.filter((r) => r.npm?.published).length} · 未发布 ${picked.filter((r) => !r.npm?.published).length}）· 并发 ${concurrency}`)

  const tally = { changed: 0, first: 0, removed: 0, none: 0, transient: 0 }
  await pool(picked, concurrency, async (r) => {
    // 瞬时失败重试：日更任务必须收敛，别把 5xx/超时留成「这一行今天没更上」
    let probe = await distTags(r.pkgName)
    for (let i = 0; i < 2 && probe.state === 'transient'; i++) {
      await new Promise((res) => setTimeout(res, 400 * (i + 1)))
      probe = await distTags(r.pkgName)
    }
    // 只有 latest 变了才值得拉完整 packument（省掉 99% 的重请求）
    const needDoc = probe.state === 'ok'
      && !(r.npm?.published === true && r.npm?.latest === probe.latest)
    let doc = needDoc ? await npmDoc(r.pkgName) : null
    if (needDoc && !doc && probe.state === 'ok') {
      await new Promise((res) => setTimeout(res, 500))
      doc = await npmDoc(r.pkgName)
    }
    tally[applyNpmProbe(r, probe, doc)]++
  })

  const material = tally.changed + tally.first + tally.removed
  if (material > 0) {
    // 并发守卫：读→写之间 plugins.jsonl 若被 validate 追加则放弃，稍后重试
    const after = statSync(PATHS.plugins)
    if (after.mtimeMs !== before.mtimeMs || after.size !== before.size) {
      console.error('[npm-refresh] plugins.jsonl 运行期间被并发写入（validate 在跑？）——放弃本次写入，稍后重试')
      process.exit(1)
    }
    const tmp = PATHS.plugins + '.tmp'
    writeFileSync(tmp, rows.map((r) => (r.ok ? JSON.stringify(r.obj) : r.raw)).join('\n') + '\n')
    renameSync(tmp, PATHS.plugins)
  }

  console.log(
    `[npm-refresh] 探测 ${picked.length}：新版本 ${tally.changed} · 首次发布 ${tally.first} · 已下架 ${tally.removed} · ` +
    `无变化 ${tally.none} · 瞬时失败 ${tally.transient}（保留原值）` +
    (material > 0 ? ' · 已写回 plugins.jsonl' : ' · 无实质变化，未写文件')
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
