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

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS, readJsonl, readJson, byFullName } from '../../lib/data.mjs'

const OUT_DIR = PATHS.reportsDir
mkdirSync(OUT_DIR, { recursive: true })
const BRAND = 'DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）'
const FOOTER = [
  '---',
  '',
  `> 由 ${BRAND} 自动生成 · 数据快照 ${new Date().toISOString().slice(0, 10)}`,
  '> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/',
  '> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。',
  '',
  '> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。',
  '',
].join('\n')

const plugins = readJsonl(PATHS.plugins)
const enrich = readJson(PATHS.enrich, [])
const dlDoc = readJson(PATHS.downloads)
const llmRows = readJsonl(PATHS.llm)
const dlMap = dlDoc?.map || {}
const plugBy = byFullName(plugins)
const enBy = byFullName(enrich)
const llmBy = byFullName(llmRows)

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

// 扣分 code → 修复建议（code 单一事实来自 score.mjs RULES；pts 仅用于排序：fail=20 / warn=5）
const ADVICE = {
  'docs.no-readme': { label: '补 README', why: '最基础的门面（唯一的 fail 级扣分）', how: '写简介/安装/使用/边界四节' },
  'docs.zh-missing': { label: '补充中英/双语文档', why: '中文生态第一印象', how: '加 README.zh-CN.md 并与英文版互链' },
  'repo.no-license': { label: '补 LICENSE', why: '开源可信度', how: '加 MIT LICENSE 文件并在 package.json 声明 license' },
  'manifest.no-client-export': { label: '补 client 导出', why: 'GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）', how: '按官方 bundle 规范补 exports["./client"]' },
  'manifest.not-lib-main': { label: 'main 对齐 lib/index.js', why: '产物布局符合官方 bundle 惯例', how: '调整 package.json main 或产物目录' },
  'manifest.no-files-whitelist': { label: '补 files 白名单', why: '发布卫生，避免把杂物打进 npm 包', how: 'package.json 加 files: ["lib", ...]' },
  'npm.unpublished': { label: '发布到 npm', why: '一键安装与进商店的前提', how: 'npm publish（先查包名是否被占用）' },
  'npm.version-drift': { label: '同步 npm 版本', why: '避免商店展示旧版（也可能是包名抢注，需核查）', how: '把仓库当前版本发到 npm' },
  'repo.no-dsh-topic': { label: '打 dsh-plugin topic', why: '官方唯一的发现机制', how: 'GitHub repo → Topics 加 dsh-plugin' },
  'activity.too-young': { label: '度过新仓观察期', why: '仓库 <1 天，存活未知', how: '保持稳定提交即可，时间会消除这条' },
  'activity.dormant': { label: '恢复维护节奏', why: '超 30 天无提交会被标记停滞风险', how: '一次实质提交（修 issue/跟 rc）即可解除' },
}

function advice(r, en) {
  const drops = (en.drops || []).map((d) => ({ ...ADVICE[d.code], sev: d.sev, code: d.code })).filter((a) => a.label)
  const SEV_P = { fail: 20, major: 10, warn: 5, minor: 2 }
  drops.sort((a, b) => (SEV_P[b.sev] || 5) - (SEV_P[a.sev] || 5))
  const out = drops.map((a) => ({ label: a.label, why: a.why, how: a.how }))
  // 收录渠道建议（不进分数，排在分数项之后）
  if (!en.inAwesome) out.push({ label: '提交 awesome-dsh-plugin', why: '上架主目录（曝光+反链）', how: 'data/plugins/<owner>__<repo>.yml 提 PR' })
  if (!en.inImsai) out.push({ label: '提交 imsai/deepseek1024', why: '覆盖另一主流渠道', how: 'catalog/plugins JSON，一个 PR 一条' })
  return out
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
  L.push(`# 致 ${name} 的作者：一期一会 · 体检与建议`)
  L.push('')
  L.push(`> ${full} · 第 1 期（数据快照 ${new Date().toISOString().slice(0, 10)}）`)
  L.push('')
  L.push(`你好！我是 **${BRAND}** 的自动观测员。这封信聊聊 ${name} 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。`)
  L.push('')
  const catTxt = peers ? `在「${peers.cat}」类 ${peers.count || ''} 个插件里超过 ${peers.pct}% 的同类` : '尚无可比同类'
  L.push(`**本期概览：${en.grade}（${en.score}/100）· ${catTxt}${peers?.median != null ? `（同类中位 ${peers.median}）` : ''}**`)
  L.push('')
  L.push(`- ★${r.stars || 0} · ${r.description ? (r.description || '').slice(0, 160) : '（无描述）'}`)
  if (r.pkgName) L.push(`- npm：${n.published ? '`' + r.pkgName + '@' + n.latest + '`（' + n.versions + ' 个版本）' : '尚未发布'}`)
  if (dl) L.push(`- 周下载：**${dl.d}**`)
  L.push(`- 最近 push ${(r.pushed_at || '').slice(0, 10)} · 收录：${en.inAwesome ? 'awesome-dsh-plugin ✅' : 'awesome —'} ${en.inImsai ? '· imsai ✅' : '· imsai —'}`)
  L.push('')
  const good = passedRules(en)
  if (good.length) {
    L.push(`**做得好的**：${good.join('、')} 等检查全部通过${llm ? '；按 README 解读，主要能力是「' + (llm.summaryZh || llm.summaryEn || '').slice(0, 120) + '」' : ''}。这些是你的基本盘，保持即可。`)
    L.push('')
  }
  if (adv.length) {
    L.push(`**本期最值得做（Top ${Math.min(3, adv.length)}，按扣分权重）**：`)
    L.push('')
    adv.slice(0, 3).forEach((a, i) => {
      L.push(`${i + 1}. **${a.label}** —— ${a.why}。怎么做：${a.how}。`)
    })
    if (adv.length > 3) {
      L.push('')
      L.push('其次还可以考虑：' + adv.slice(3).map((a) => `${a.label}（${a.why}）`).join('；') + '。')
    }
    L.push('')
  } else {
    L.push('本期没有明显的启发式短板。剩下的成长来自真实迭代：新能力、issue 响应、跟随 dsh rc 升级。')
    L.push('')
  }
  if (llm && llm.capabilityTags && llm.capabilityTags.length) {
    L.push(`**能力标签**：${llm.capabilityTags.join('、')}${llm.claims && llm.claims.length ? `；README 宣称：${llm.claims.slice(0, 4).join('；')}` : ''}`)
    L.push('')
  }
  L.push('> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。')
  L.push('')
  if (!en.inAwesome || !en.inImsai) {
    L.push('**想被更多人看到？** 下面这段可直接复制去提交收录：')
    L.push('')
    L.push('```text')
    L.push(`Add ${full} to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2${r.npm?.published ? `, published as ${r.pkgName}@${r.npm.latest}` : ''}.`)
    L.push('```')
    L.push('')
  }
  L.push(FOOTER)
  return L.join('\n') + '\n'
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const self = ['ice5kysl/dsh-workspace-kit', 'ice5kysl/dsh-file-explorer-kit']
  const targets = args.length ? args : self
  const written = []
  for (const full of targets) {
    writeFileSync(join(OUT_DIR, full.replace('/', '__') + '.md'), render(full))
    written.push(full)
  }
  console.log(`[letter] ${written.length} → data/reports/\n` + written.map((w) => '  · ' + w).join('\n'))
}

main()
