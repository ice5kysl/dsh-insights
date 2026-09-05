#!/usr/bin/env node
/**
 * Stage 17 — per-plugin health & improvement report generator.
 *
 * Input:  none (batch) or `node stages/17-report.mjs owner/repo [owner/repo ...]`
 * Default batch: the two self plugins + top-5 优质未收录 suggestions.
 *
 * For each plugin writes data/reports/{owner}__{repo}.md
 * (score card · breakdown · signals · actionable optimization checklist ·
 *  channel pitch snippet · peer percentile · LLM reading when available).
 *
 * @module dsh-plugin-insights/stage-17
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'data', 'reports')
mkdirSync(OUT_DIR, { recursive: true })

const jl = (f) => { try { return readFileSync(join(ROOT, 'data', f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) } catch { return [] } }

// authoritative records + enrich + downloads + llm
const plugins = jl('plugins.jsonl')
const enrich = JSON.parse(readFileSync(join(ROOT, 'data', 'enrich.json'), 'utf8'))
const dlDoc = (() => { try { return JSON.parse(readFileSync(join(ROOT, 'data', 'downloads.json'), 'utf8')) } catch { return null } })()
const llmRows = jl('llm.jsonl')
const dlMap = dlDoc?.map || {}
const plugBy = new Map(plugins.map((r) => [r.full_name, r]))
const enBy = new Map(enrich.map((x) => [x.full_name, x]))
const llmBy = new Map(llmRows.map((x) => [x.full_name, x]))

function catPeers(full) {
  const cat = enBy.get(full)?.category
  if (!cat) return null
  const score = enBy.get(full)?.score ?? 0
  const same = enrich.filter((x) => x.category === cat && x.full_name !== full)
  if (!same.length) return { cat, below: '—', count: 0, median: null }
  const sc = same.map((x) => x.score).sort((a, b) => a - b)
  const below = sc.filter((v) => v <= score).length
  const median = sc[Math.floor(sc.length / 2)]
  return { cat, below, count: same.length + 1, median }
}

function actions(r, en, llm, dl) {
  const f = r.files || {}
  const e = r.eval || {}
  const m = r.metrics || {}
  const n = r.npm || {}
  const out = []
  const add = (p, what, why, how) => { if (p) out.push({ what, why, how }) }
  add(!f.readme, '补充 README', '+6 质量分 · 用户/收录方首先看它', '按官方规范写简介/安装/开发/限制，参考同分位插件 README')
  add(!(f.readmeZh || m.hasZhDocs), '补充中文/双语文档', '+10 质量分 · 覆盖中文生态', '加 README.zh-CN.md 或至少双语小节；仓库加中英互链')
  add(!(f.license || r.license || e.licenseField), '补 LICENSE', '+4 · 开源可商用信号', '加 MIT/LICENSE 并在 package.json 声明 license')
  add(!f.libClient, '提供浏览器客户端产物 lib/client.js', '+5 · 若面向 GUI 增强，浏览器面才生效', '按官方 bundle 规范加 ./client 面并构建到 lib/')
  add(!e.hasClientExport, '声明 exports["./client"]', '+4 · 官方加载器解析需要', 'package.json exports 增加 ./client → lib/client.js')
  add(!n.published, '发布到 npm', '+8 · 一键安装/被商店收录的前提', `npm login && npm publish（包名 ${r.pkgName || r.repo} 需未被占用）`)
  if (n.published && r.version && n.latest && n.latest !== r.version) add(true, '同步 npm 版本', '+6 · 商店显示旧版会被弃用', `npm publish 发布 ${r.version}（当前 latest ${n.latest}）`)
  if (!en.inAwesome) add(true, '提交 awesome-dsh-plugin', '曝光与反向链接（见下方文案）', 'fork → data/plugins/<owner>__<repo>.yml → PR（≤3 条/PR）')
  if (!en.inImsai) add(true, '提交 imsai / deepseek1024 目录', '覆盖另一主流渠道', 'fork → catalog/plugins JSON → 一个 PR 一条')
  if (n.published && dl == null) add(true, '等待周下载数据入库', '用于展示真实使用度', '由 CI refresh 自动补齐 downloads.json')
  return out
}

function pitch(full, en, r) {
  const npmTxt = r.npm?.published ? `npm：\`${r.pkgName}@${r.npm.latest}\`` : 'npm：待发布'
  const zh = (r.metrics?.hasZhDocs ? '中英双语' : 'README 英文')
  return [
    `## 提交收录（可复制）`,
    '',
    `### awesome-dsh-plugin（data/plugins/${full.replace('/', '__')}.yml）`,
    '```yaml',
    `url: https://github.com/${full}`,
    `name: ${full}`,
    'category: ui',
    'description:',
    `  en: ${(r.description || '').slice(0, 220)}`,
    '```',
    '',
    `### PR 描述（EN/中文）`,
    '',
    `Add ${full}（category ui）—— 标准 Cordis bundle 插件，${zh}，目标 dsh ≥ 0.1.1-rc.2；${npmTxt}。`,
    '',
  ].join('\n')
}

function render(full) {
  const r = plugBy.get(full)
  const en = enBy.get(full)
  const llm = llmBy.get(full)
  if (!r || !en) return `# ${full}\n\n> 不在当前权威集中或数据缺失\n`
  const dl = r.pkgName ? dlMap[r.pkgName] ?? null : null
  const peers = catPeers(full)
  const acts = actions(r, en, llm, dl)
  const f = r.files || {}
  const n = r.npm || {}
  const m = r.metrics || {}
  const flags = (k) => (k ? '✅' : '—')
  const L = []
  L.push(`# 插件报告 · ${full}`)
  L.push('')
  L.push(`> 生成 ${new Date().toISOString().slice(0, 10)} · dsh-plugin-insights / Stage 17 · 启发式评估，非安全审计`)
  L.push('')
  L.push(`**${en.grade}**（${en.score}/100）· 分类「${en.category}」· ★${r.stars || 0}`)
  L.push('')
  L.push(`- 仓库：${r.html_url || ('https://github.com/' + full)}`)
  if (r.pkgName) L.push(`- npm：${n.published ? '`' + r.pkgName + '@' + n.latest + '`（' + n.versions + ' 版本）' : '未发布'}`)
  if (dl) L.push(`- 周下载：**${dl.d}**（${(dl.start || '').slice(0, 10)} ~ ${(dl.end || '').slice(0, 10)}）`)
  L.push(`- 最近 push：${(r.pushed_at || '').slice(0, 10)} · 创建 ${(r.created_at || '').slice(0, 10)}`)
  L.push(`- 收录：${en.inAwesome ? 'awesome-dsh-plugin ✅' : 'awesome-dsh-plugin —'} · ${en.inImsai ? 'imsai ✅' : 'imsai —'}`)
  if (peers && peers.median != null) L.push(`- 同类（${peers.cat}，${peers.count} 个）分位：击败 **${Math.round((peers.below / Math.max(1, peers.count - 1)) * 100)}%**（中位 ${peers.median} 分）`)
  L.push('')
  L.push('## 打分明细')
  L.push('')
  L.push('| 加分项 | +分 |')
  L.push('|---|---|')
  for (const p of en.parts || []) L.push(`| ${p.label} | +${p.v} |`)
  L.push(`| 基分 | 25 |`)
  L.push('')
  L.push('## 清单与产物')
  L.push('')
  L.push(`README ${flags(f.readme)} · 中文/双语 ${flags(m.hasZhDocs || f.readmeZh)} · LICENSE ${flags(f.license || r.license)} · cordis.patch ${flags(f.cordisPatch)} · lib/index.js ${flags(f.libIndex)} · lib/client.js ${flags(f.libClient)} · client 导出 ${flags(r.eval?.hasClientExport)}`)
  L.push('')
  if (llm) {
    L.push('## LLM 解读')
    L.push('')
    if (llm.summaryZh || llm.summaryEn) L.push((llm.summaryZh || llm.summaryEn).slice(0, 400))
    if (llm.category) L.push(`- 能力主类：${llm.category}`)
    if (llm.capabilityTags && llm.capabilityTags.length) L.push(`- 能力标签：${llm.capabilityTags.join('、')}`)
    if (llm.claims && llm.claims.length) L.push(`- 可验证宣称：${llm.claims.slice(0, 5).join('；')}`)
    L.push('')
  }
  L.push('## 建议优化清单（按性价比）')
  L.push('')
  if (!acts.length) {
    L.push('- ✅ 暂无启发式缺项；可持续发布迭代（新增能力、修复 issue、跟进 dsh rc）。')
  } else {
    L.push('| 动作 | 影响 | 怎么做 |')
    L.push('|---|---|---|')
    for (const a of acts) L.push(`| ${a.what} | ${a.why} | ${a.how} |`)
  }
  L.push('')
  L.push('---')
  L.push('')
  L.push(pitch(full, en, r))
  return L.join('\n') + '\n'
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const self = ['ice5kysl/dsh-workspace-kit', 'ice5kysl/dsh-file-explorer-kit']
  let targets
  if (args.length) targets = args
  else {
    const analysis = JSON.parse(readFileSync(join(ROOT, 'data', 'analysis.json'), 'utf8'))
    const top = (analysis.suggested || []).slice(0, 5).map((s) => s.full_name)
    targets = [...self, ...top]
  }
  const written = []
  for (const full of targets) {
    const name = full.replace('/', '__')
    const md = render(full)
    writeFileSync(join(OUT_DIR, name + '.md'), md)
    written.push(full)
  }
  console.log(`[report] ${written.length} reports → data/reports/\n` + written.map((w) => '  - ' + w).join('\n'))
}

main()
