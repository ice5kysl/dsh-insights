#!/usr/bin/env node
/**
 * pipeline/content · letters — per-plugin "letter to the author": a periodic health &
 * improvement report written like a note from the ecosystem watcher,
 * plus a small promotion footer for the product.
 *
 * 分数与扣分唯一真源：pipeline/analyze/score.mjs（health-v2）。
 * 建议 = health.drops 映射修复动作（fail 优先），另附收录渠道建议（不进分数）。
 *
 * Output: data/reports/{owner}__{repo}.md
 * Run: npm run report  |  node pipeline/content/letters.mjs owner/repo […]
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, PATHS, readJsonl, readJson, byFullName, loadPlugins } from '../../lib/data.mjs'

const OUT_DIR = PATHS.reportsDir
mkdirSync(OUT_DIR, { recursive: true })
const BRAND = 'DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）'
// 快照日期取 analysis.json 的 generatedAt（数据不变则信件不变）；缺失时才退回当天（否则 diff 驱动失效，每周五全量重写）
const SNAP = String(readJson(PATHS.analysis, {}).generatedAt ?? new Date().toISOString()).slice(0, 10)
const FOOTER = [
  '---',
  '',
  `> 由 ${BRAND} 自动生成 · 数据快照 ${SNAP}`,
  '> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。',
  '',
].join('\n')

const plugins = loadPlugins()
const enrich = readJson(PATHS.enrich, [])
const dlDoc = readJson(PATHS.downloads)
const llmRows = readJsonl(PATHS.llm)
const dlMap = dlDoc?.map || {}
const plugBy = byFullName(plugins)
const enBy = byFullName(enrich)
const llmBy = byFullName(llmRows)
// LLM 深度建议（可选输入，data/llm-advice.jsonl）：规则书之外的个性化建议——标注 LLM 生成、不进分数（LLM 使用纪律）
const adviceBy = byFullName(existsSync(join(DATA, 'llm-advice.jsonl')) ? readJsonl(join(DATA, 'llm-advice.jsonl')) : [])

function peersOf(full) {
  const cat = enBy.get(full)?.category
  const score = enBy.get(full)?.score ?? 0
  if (!cat) return null
  const same = enrich.filter((x) => x.category === cat && x.full_name !== full).map((x) => x.score)
  if (!same.length) return { cat, pct: null, median: null }
  same.sort((a, b) => a - b)
  const below = same.filter((v) => v < score).length
  return { cat, count: same.length + 1, pct: Math.min(99, Math.round((below / Math.max(1, same.length)) * 100)), median: same[Math.floor(same.length / 2)] }
}

// 扣分 code → 观察描述（label 为中性现象描述而非祈使句——信件是建议型语气，见 render）
const ADVICE = {
  'docs.no-readme': { label: 'README 目前缺失', why: '这是用户了解插件的第一入口', how: '简介/安装/使用/边界四节即可' },
  'docs.zh-missing': { label: '文档只有单语言', why: '中文用户占生态大头，双语能覆盖更多用户', how: '加 README.zh-CN.md 并与英文版互链' },
  'repo.no-license': { label: '未声明 LICENSE', why: '没有许可证会让谨慎的用户和企业不敢用', how: '加 MIT LICENSE 文件并在 package.json 声明 license' },
  'manifest.no-client-export': { label: '未声明 client 导出', why: 'GUI 能力无法被 dsh web 加载（TUI/CLI 类插件可忽略）', how: '按官方 bundle 规范补 exports["./client"]' },
  'manifest.not-lib-main': { label: 'main 未对齐 lib/index.js', why: '与官方 bundle 惯例不一致，部分装载路径可能认不出', how: '调整 package.json main 或产物目录' },
  'manifest.no-files-whitelist': { label: '未配置 files 白名单', why: '发布卫生，避免把杂物打进 npm 包', how: 'package.json 加 files: ["lib", ...]' },
  'npm.unpublished': { label: '尚未发布到 npm', why: '一键安装和商店收录都以 npm 为前提', how: 'npm publish（先查包名是否被占用）' },
  'npm.version-drift': { label: 'npm 版本落后于仓库', why: '商店会展示旧版（也可能是包名被抢注，值得核查）', how: '把仓库当前版本发到 npm' },
  'repo.no-dsh-topic': { label: '未打 dsh-plugin topic', why: 'topic 是目前生态发现的主要机制', how: 'GitHub repo → Topics 加 dsh-plugin' },
  'activity.too-young': { label: '仓库刚创建', why: '新仓的存活率还没经过时间检验，部分用户会观望', how: '无需操作，保持稳定提交即可' },
  'activity.dormant': { label: '超过 30 天没有提交', why: '会被观望中的用户解读为维护停滞', how: '如果仍在维护，一次实质提交即可解除该信号' },
}

function advice(r, en) {
  const drops = (en.drops || []).map((d) => ({ ...ADVICE[d.code], sev: d.sev, code: d.code })).filter((a) => a.label)
  const SEV_P = { fail: 20, major: 10, warn: 5, minor: 2 }
  drops.sort((a, b) => (SEV_P[b.sev] || 5) - (SEV_P[a.sev] || 5))
  return drops.map((a) => ({ label: a.label, why: a.why, how: a.how }))
  // 注：目录收录（awesome-dsh-plugin / imsai）不再是「建议项」——路人反馈其读起来像
  // 为第三方仓库引流的指令（2026-09-09 DSH-better-sidebar#581 评论）。收录信息由
  // render 里一段中性、带无隶属声明的话承载。
}

// 已通过的检查项（扣分未触发且该维度有探测数据）——"做得好的"（正向措辞）
const PASSED_LABEL = {
  'manifest.no-client-export': 'client 导出齐备',
  'manifest.not-lib-main': '产物布局规范',
  'manifest.no-files-whitelist': 'files 白名单',
  'npm.unpublished': 'npm 已发布',
  'npm.version-drift': 'npm 版本同步',
  'docs.no-readme': 'README 齐备',
  'docs.zh-missing': '中文/双语文档',
  'repo.no-license': 'LICENSE',
  'repo.no-dsh-topic': 'dsh-plugin topic',
  'activity.too-young': '已度过新仓观察期',
  'activity.dormant': '近期活跃',
}
const MISSING_DIMS = { files: ['docs', 'repo'], topics: ['repo'], metrics: ['activity'], manifest: ['manifest'], npm: ['npm'] }
function passedRules(en) {
  const dropCodes = new Set((en.drops || []).map((d) => d.code))
  const missingDims = new Set((en.missing || []).flatMap((m) => MISSING_DIMS[m] || []))
  return Object.keys(PASSED_LABEL)
    .filter((code) => !dropCodes.has(code) && !missingDims.has(code.split('.')[0]))
    .map((code) => PASSED_LABEL[code])
}

function render(full) {
  const r = plugBy.get(full)
  const en = enBy.get(full)
  if (!r || !en) return `# 致作者的信 · ${full}\n\n> 该插件暂不在当前权威集中（数据缺失/待重跑）。\n\n${FOOTER}\n`
  const llm = llmBy.get(full)
  const dl = r.pkgName ? dlMap[r.pkgName] ?? null : null
  const peers = peersOf(full)
  const adv = advice(r, en)
  const name = full.split('/')[1]
  const n = r.npm || {}
  const L = []
  L.push(`# 致 ${name} 的作者：一期一会 · 观测分享`)
  L.push('')
  L.push(`> ${full} · 第 1 期（数据快照 ${SNAP}）`)
  L.push('')
  L.push(`你好！我们是 **${BRAND}**——一个对 dsh 插件生态做公开观测的小项目。这封信把我们采集到的关于 ${name} 的公开数据和一些不成熟的想法分享给你，**仅供参考，不构成任何要求**；说得不对的地方欢迎直接指出（评分规则公开在 [About](https://dsh-insights.com/about/)，可复核可反驳）。`)
  L.push('')
  const catTxt = peers ? `在「${peers.cat}」类 ${peers.count || ''} 个插件的分布里大致位于前列（同类中位 ${peers.median}）` : '暂无可比同类'
  L.push(`**我们的启发式模型给当前状态的读数：${en.grade}（${en.score}/100）** · ${catTxt}。模型只看公开信号（文档/发布/维护节奏等），读不出插件的真实质量——它更适合用来发现「可能被忽略的细节」，而不是下结论。`)
  L.push('')
  L.push(`- ★${r.stars || 0} · ${r.description ? (r.description || '').slice(0, 160) : '（无描述）'}`)
  if (r.pkgName) L.push(`- npm：${n.published ? '`' + r.pkgName + '@' + n.latest + '`（' + n.versions + ' 个版本）' : '尚未发布'}`)
  if (dl) L.push(`- 周下载：**${dl.d}**`)
  L.push(`- 最近 push ${(r.pushed_at || '').slice(0, 10)}`)
  L.push('')
  const good = passedRules(en)
  if (good.length) {
    L.push(`以下几项检查未发现问题（仅作记录）：${good.join('、')}${llm ? '；按 README 解读，主要能力是「' + (llm.summaryZh || llm.summaryEn || '').slice(0, 120) + '」' : ''}。`)
    L.push('')
  }
  if (adv.length) {
    L.push(`**如果只看几点，这些可能值得留意**（按模型权重排序，均为建议，是否采纳完全由你）：`)
    L.push('')
    adv.slice(0, 3).forEach((a, i) => {
      L.push(`${i + 1}. **${a.label}** —— ${a.why}。参考做法：${a.how}。`)
    })
    if (adv.length > 3) {
      L.push('')
      L.push('其余信号：' + adv.slice(3).map((a) => `${a.label}（${a.why}）`).join('；') + '。')
    }
    L.push('')
  } else {
    L.push('本期观测没有发现明显的短板信号。')
    L.push('')
  }
  // LLM 深度建议（规则书之外的个性化视角）：可选输入 data/llm-advice.jsonl，按 LLM 使用纪律标注、不进分数
  const extra = adviceBy.get(full)?.advice
  if (Array.isArray(extra) && extra.length) {
    L.push('**观察员的额外视角**（LLM 生成 · 仅供思路，不进分数）：')
    L.push('')
    extra.slice(0, 3).forEach((a, i) => L.push(`${i + 1}. **${a.label}** —— ${a.detail}`))
    L.push('')
  }
  if (llm && llm.capabilityTags && llm.capabilityTags.length) {
    L.push(`**能力标签**：${llm.capabilityTags.join('、')}${llm.claims && llm.claims.length ? `；README 宣称：${llm.claims.slice(0, 4).join('；')}` : ''}`)
    L.push('')
  }
  L.push('> 后续：我们每周做一次全生态观测，下期会附上与本期对比的变化。**如果这类信件对你构成打扰，回复一声即可，我们此后不再发送到贵仓库。**')
  L.push('')
  L.push('这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue。我们也写了一个 dsh 内的自检小工具 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`），觉得有用可以试试，没用也请忽略。')
  L.push('')
  L.push(FOOTER)
  return L.join('\n') + '\n'
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const self = ['ice5kysl/dsh-workspace-kit', 'ice5kysl/dsh-file-explorer-kit']
  const targets = args.length ? args : process.argv.includes('--self') ? self : plugins.map((r) => r.full_name)
  const written = []
  for (const full of targets) {
    writeFileSync(join(OUT_DIR, full.replace('/', '__') + '.md'), render(full))
    written.push(full)
  }
  console.log(`[letter] ${written.length} → data/reports/\n` + written.map((w) => '  · ' + w).join('\n'))
}

main()
