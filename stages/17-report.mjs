#!/usr/bin/env node
/**
 * Stage 17 — per-plugin "letter to the author": a periodic health &
 * improvement report written like a note from the ecosystem watcher,
 * plus a small promotion footer for the product.
 *
 * Output: data/reports/{owner}__{repo}.md
 * Run: npm run report  |  node stages/17-report.mjs owner/repo […]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'data', 'reports')
mkdirSync(OUT_DIR, { recursive: true })
const BRAND = 'DSH 插件洞察（dsh-insights.com）'
const FOOTER = [
  '---',
  '',
  `> 由 ${BRAND} 自动生成 · 数据快照 ${new Date().toISOString().slice(0, 10)}`,
  '> 开源管线 [dsh-plugin-insights](https://github.com/ice5kysl/dsh-plugin-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://ice5kysl.github.io/dsh-plugin-insights/',
  '> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。',
  '',
  '> 注：本报告为启发式数据初稿，非安全审计；打分阈值 A≥90 · B≥72 · C≥52。',
  '',
].join('\n')

const jl = (f) => { try { return readFileSync(join(ROOT, 'data', f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }
const plugins = jl('plugins.jsonl')
const enrich = JSON.parse(readFileSync(join(ROOT, 'data', 'enrich.json'), 'utf8'))
let dlDoc = null
try { dlDoc = JSON.parse(readFileSync(join(ROOT, 'data', 'downloads.json'), 'utf8')) } catch { /* ok */ }
const llmRows = jl('llm.jsonl')
const dlMap = dlDoc?.map || {}
const plugBy = new Map(plugins.map((r) => [r.full_name, r]))
const enBy = new Map(enrich.map((x) => [x.full_name, x]))
const llmBy = new Map(llmRows.map((x) => [x.full_name, x]))

function peersOf(full) {
  const cat = enBy.get(full)?.category
  const score = enBy.get(full)?.score ?? 0
  if (!cat) return null
  const same = enrich.filter((x) => x.category === cat && x.full_name !== full).map((x) => x.score)
  if (!same.length) return { cat, pct: null, median: null }
  same.sort((a, b) => a - b)
  const below = same.filter((v) => v <= score).length
  return { cat, count: same.length + 1, pct: Math.round((below / Math.max(1, same.length)) * 100), median: same[Math.floor(same.length / 2)] }
}

function advice(r) {
  const f = r.files || {}
  const e = r.eval || {}
  const m = r.metrics || {}
  const n = r.npm || {}
  const en = enBy.get(r.full_name) || {}
  const out = []
  const push = (label, why, how, pts, ok) => { if (!ok) out.push({ label, why, how, pts }) }
  push('补 README', '最基础的门面（+6）', '写简介/安装/开发/边界', 6, f.readme)
  push('补充中英/双语文档', '中文生态第一印象（+10）', '加 README.zh-CN.md 并互链', 10, m.hasZhDocs || f.readmeZh)
  push('补 LICENSE', '开源可信度（+4）', '加 MIT/LICENSE 并声明 license', 4, Boolean(f.license || r.license))
  push('补浏览器面（lib/client.js + client 导出）', 'GUI 能力可被加载（+9）', '按官方 bundle 规范补 client 面', 9, f.libClient && e.hasClientExport)
  push('发布到 npm', '一键安装与商店前提（+8）', 'npm publish（先查包名占用）', 8, n.published)
  push('同步 npm 版本', '避免商店展示旧版（+6）', '把仓库当前版本发到 npm', 6, n.published && r.version && n.latest === r.version)
  push('提交 awesome-dsh-plugin', '上架主目录（曝光+反链）（+5）', 'data/plugins/<owner>__<repo>.yml PR', 5, en.inAwesome)
  push('提交 imsai/deepseek1024', '覆盖另一主流渠道（+5）', 'catalog/plugins JSON，一个 PR 一条', 5, en.inImsai)
  return out.sort((a, b) => b.pts - a.pts)
}

function render(full) {
  const r = plugBy.get(full)
  const en = enBy.get(full)
  if (!r || !en) return `# 致作者的信 · ${full}\n\n> 该插件暂不在当前权威集中（数据缺失/待重跑）。\n\n${FOOTER}\n`
  const llm = llmBy.get(full)
  const dl = r.pkgName ? dlMap[r.pkgName] ?? null : null
  const peers = peersOf(full)
  const adv = advice(r)
  const name = full.split('/')[1]
  const m = r.metrics || {}
  const n = r.npm || {}
  const L = []
  L.push(`# 致 ${name} 的作者：一期一会 · 体检与建议`)
  L.push('')
  L.push(`> ${full} · 第 1 期（数据快照 ${new Date().toISOString().slice(0, 10)}）`)
  L.push('')
  L.push(`你好！我是 **${BRAND}** 的自动观测员。这封信聊聊 ${name} 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。`)
  L.push('')
  const catTxt = peers ? `在「${peers.cat}」类 ${peers.count || ''} 个插件里处于前 ${peers.pct}%` : '尚无可比同类'
  L.push(`**本期概览：${en.grade}（${en.score}/100）· ${catTxt}${peers?.median != null ? `（同类中位 ${peers.median}）` : ''}**`)
  L.push('')
  L.push(`- ★${r.stars || 0} · ${r.description ? (r.description || '').slice(0, 160) : '（无描述）'}`)
  if (r.pkgName) L.push(`- npm：${n.published ? '`' + r.pkgName + '@' + n.latest + '`（' + n.versions + ' 个版本）' : '尚未发布'}`)
  if (dl) L.push(`- 周下载：**${dl.d}**`)
  L.push(`- 最近 push ${(r.pushed_at || '').slice(0, 10)} · 收录：${en.inAwesome ? 'awesome-dsh-plugin ✅' : 'awesome —'} ${en.inImsai ? '· imsai ✅' : '· imsai —'}`)
  L.push('')
  const good = (en.parts || []).map((p) => p.label)
  if (good.length) {
    L.push(`**做得好的**：${good.join('、')} 都已具备${llm ? '；按 README 解读，主要能力是「' + (llm.summaryZh || llm.summaryEn || '').slice(0, 120) + '」' : ''}。这些是你的基本盘，保持即可。`)
    L.push('')
  }
  if (adv.length) {
    L.push(`**本期最值得做（Top ${Math.min(3, adv.length)}，按性价比）**：`)
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
