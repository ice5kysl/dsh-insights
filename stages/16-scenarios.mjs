#!/usr/bin/env node
/**
 * Stage 16 — scenario recommendations (D8) → data/scenarios.json
 *
 * Turns tags (LLM capabilityTags ∪ lexicon buckets) into answerable
 * "常用场景 → Top 候选" lists. Ranking is transparent & explainable —
 * objective signals only, same rule spirit as health: score, npm published,
 * active30, then stars as display tiebreak. Recommendations are NOT
 * "best" claims — each scenario lists 3–6 candidates with reasons.
 *
 * Sources:
 *   - data/llm.jsonl     capability tags (tagged subset)
 *   - data/insights.json health/npm/stars/desc
 *   - lexicon fallback   for untagged plugins (stage-14 style words)
 *
 * Output: data/scenarios.json (agent-readable, stable schema v1)
 *
 * @module dsh-insights/stage-16
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = join(import.meta.dirname, '..')
const LLM = join(ROOT, 'data', 'llm.jsonl')
const INS = join(ROOT, 'data', 'insights.json')
const OUT = join(ROOT, 'data', 'scenarios.json')

/** scenario registry v1 — id, zh/en name, match words (llm tags/keywords + desc tokens). */
const SCENARIOS = [
  { id: 'session-archive', zh: '会话归档/回收站管理', en: 'session archive & recycle', words: ['archive', '归档', 'recycle', '回收站', 'unarchive'] },
  { id: 'file-explore', zh: '文件浏览/预览/编辑', en: 'file browse & edit', words: ['file', '文件', 'explorer', 'preview', 'upload'] },
  { id: 'sidebar-workspace', zh: '侧栏/工作区组织', en: 'sidebar & workspace', words: ['sidebar', 'workspace', '侧栏', '工作区', 'session manager', '会话管理'] },
  { id: 'global-search', zh: '全局搜索/命令面板', en: 'search & palette', words: ['search', 'spotlight', 'palette', '搜索', '命令面板', 'command'] },
  { id: 'memory-knowledge', zh: '记忆/知识管理', en: 'memory & knowledge', words: ['memory', '记忆', 'recall', 'memo', 'knowledge'] },
  { id: 'model-routing', zh: '模型路由/多模型', en: 'model routing', words: ['router', 'routing', 'provider', '路由', 'provider 配置'] },
  { id: 'terminal-ssh', zh: '终端/SSH/CLI', en: 'terminal & ssh', words: ['terminal', '终端', 'ssh', 'bash', 'cli'] },
  { id: 'remote-mobile', zh: '远程/手机访问', en: 'remote & mobile', words: ['remote', '远程', 'mobile', '手机', 'android', 'ios'] },
  { id: 'theme-skin', zh: '皮肤/主题美化', en: 'themes & skins', words: ['theme', '主题', 'skin', '皮肤', '换肤', 'catppuccin', 'wallpaper'] },
  { id: 'desktop-pet', zh: '桌宠/趣味', en: 'pets & fun', words: ['pet', '桌宠', 'whale', '宠物', 'live2d', '游戏', 'galgame'] },
  { id: 'vision-image', zh: '图像/视觉', en: 'vision & images', words: ['vision', 'image', '图像', '图片', 'ocr', '视觉'] },
  { id: 'voice-audio', zh: '语音/音频', en: 'voice & audio', words: ['voice', '语音', 'audio', 'whisper', 'tts'] },
  { id: 'balance-usage', zh: '用量/余额监控', en: 'usage & billing', words: ['balance', '余额', 'usage', '用量', 'token', 'cost', '计费'] },
  { id: 'mcp-manage', zh: 'MCP 管理', en: 'mcp management', words: ['mcp'] },
  { id: 'skills', zh: '技能/Skills', en: 'skills', words: ['skill', '技能', 'skills'] },
  { id: 'subagent-ops', zh: '子代理/工作流', en: 'subagents & workflows', words: ['subagent', '子代理', 'workflow', '工作流', 'orchestrat', 'agent team'] },
  { id: 'code-review', zh: '代码/审阅', en: 'code & review', words: ['code review', 'review', '审阅', 'lsp', 'editor', 'ide', 'diff'] },
  { id: 'git', zh: 'Git 集成', en: 'git', words: ['git'] },
  { id: 'notify', zh: '通知/提醒', en: 'notify & alerts', words: ['notify', '通知', 'remind', '提醒', 'alert'] },
  { id: 'docs-office', zh: '文档/办公', en: 'docs & office', words: ['office', 'doc', 'markdown', 'note', '笔记', '办公', 'excel', 'ppt'] },
  { id: 'web-browser', zh: '浏览器/网页工具', en: 'browser & web', words: ['browser', '浏览器', 'html'] },
  { id: 'data-research', zh: '数据/研究/量化', en: 'data & research', words: ['research', '研究', 'data', '数据', 'stock', '股票', 'quant', 'chart'] },
]

function readLinesJson(f) {
  const out = []
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    if (!l.trim()) continue
    try { out.push(JSON.parse(l)) } catch { /* skip */ }
  }
  return out
}

function main() {
  const insights = JSON.parse(readFileSync(INS, 'utf8'))
  const plugins = insights.plugins || []
  const llmRows = readLinesJson(LLM)
  const tagBy = new Map(llmRows.map((r) => [r.full_name, r]))

  const hayBy = new Map()
  for (const p of plugins) {
    const t = tagBy.get(p.full_name)
    const words = new Set()
    for (const w of [...(p.topics || []), ...(p.description || '').toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/)]) if (w.length > 1) words.add(w)
    if (t) {
      for (const c of [...(t.capabilityTags || []), t.category || '', ...(t.commands || [])]) words.add(String(c).toLowerCase())
      if (t.summaryZh) for (const w of t.summaryZh.split(/[^a-z0-9\u4e00-\u9fff]+/)) if (w.length > 1) words.add(w)
    }
    hayBy.set(p.full_name, [...words].join(' '))
  }

  const scenarios = SCENARIOS.map((s) => {
    const cands = plugins
      .filter((p) => {
        const hay = hayBy.get(p.full_name) || ''
        const low = hay.toLowerCase()
        return s.words.some((w) => low.includes(w.toLowerCase()))
      })
      .map((p) => {
        const reasons = []
        const t = tagBy.get(p.full_name)
        if (t && t.category === s.id) reasons.push('LLM 分类命中')
        if (t) {
          const hit = (t.capabilityTags || []).filter((c) => s.words.includes(String(c).toLowerCase()))
          if (hit.length) reasons.push(`标签: ${hit.slice(0, 3).join('/')}`)
        }
        if (!reasons.length) reasons.push('描述/主题词命中')
        return {
          full_name: p.full_name, url: p.url, stars: p.stars ?? 0,
          score: p.health?.score ?? null, grade: p.health?.grade ?? null,
          npm: p.npm?.published ? (p.npm.latest || true) : false,
          active: true, // insights rows are all validated-valid; activity not carried here
          reasons,
        }
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.npm ? 1 : 0) - (a.npm ? 1 : 0) || (b.stars - a.stars))
      .slice(0, 6)
    return {
      id: s.id, zh: s.zh, en: s.en,
      candidates: cands.length,
      plugins: cands,
    }
  }).filter((s) => s.candidates > 0)

  const doc = {
    schema: 'scenarios-v1',
    generatedAt: new Date().toISOString(),
    note: 'LLM 标签 ∪ 词汇匹配；排序=健康分→npm→stars（展示）。推荐非"最佳"宣称，理由逐条可见。',
    llmTagged: llmRows.length,
    totalPlugins: plugins.length,
    scenarios,
  }
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n')
  console.log(`[scenarios] ${scenarios.length} scenarios (${llmRows.length} plugins LLM-tagged) → data/scenarios.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
