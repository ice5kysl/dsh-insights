#!/usr/bin/env node
/**
 * Stage 14 — overlap-family detection (D1, analysis-layer moat) → data/overlap.json
 *
 * Groups plugins into approximate capability families from a bilingual
 * keyword lexicon over name/description/topics. Answers "how crowded is this
 * family and who competes with whom" — the duplication pain quantified.
 *
 * NOTE v1 is a heuristic vocabulary pass, NOT functional-equivalence
 * detection; the LLM stage (ANALYSIS-DEPTH.md D3) refines families later.
 * Output members sorted by health desc then stars desc.
 *
 * @module dsh-insights/stage-14
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'data', 'insights.json')
const OUT = join(ROOT, 'data', 'overlap.json')

// tag → { label, words } (lowercased substring match over name+desc+topics)
const BUCKETS = {
  'file-browse': { label: '文件浏览/预览/编辑', words: ['file', 'files', 'explorer', 'folder', 'tree', 'upload', 'preview', '文件', '上传', '预览'] },
  'workspace-session': { label: '侧栏/工作区/会话管理', words: ['sidebar', 'workspace', 'session', '会话', '侧栏', '工作区', 'archive', '归档'] },
  'search': { label: '搜索/命令面板', words: ['search', 'spotlight', 'palette', 'command', 'find', '搜索', '命令'] },
  'memory': { label: '记忆/知识', words: ['memory', 'memo', 'recall', 'mnemonic', 'knowledge', '记忆'] },
  'theme-skin': { label: '皮肤/主题/壁纸', words: ['theme', 'skin', 'catppuccin', 'endfield', 'skin', 'wallpaper', '皮肤', '主题', '换肤'] },
  'pet': { label: '桌宠/互动角色', words: ['pet', 'whale', 'live2d', 'mascot', '桌宠', '宠物'] },
  'terminal': { label: '终端/SSH/CLI', words: ['terminal', 'bash', 'ssh', 'cli', 'tui', '终端'] },
  'remote-mobile': { label: '远程/手机端', words: ['remote', 'mobile', 'phone', 'android', 'ios', 'wsl', '远程', '手机'] },
  'vision-image': { label: '视觉/图像', words: ['image', 'vision', 'ocr', 'photo', 'picture', '图像', '图片', '看图'] },
  'voice': { label: '语音/音频', words: ['voice', 'audio', 'whisper', 'tts', 'speech', '语音'] },
  'code-dev': { label: '编码/IDE/审阅', words: ['codex', 'ide', 'editor', 'diff', 'lsp', 'debug', 'format', 'lint', '代码', '审查', '编辑器'] },
  'git': { label: 'Git', words: ['git', 'commit', 'branch', 'pull'] },
  'agent-ops': { label: '子代理/工作流编排', words: ['subagent', 'agent-team', 'agentic', 'multi-agent', 'orchestrat', 'workflow', '子代理', '工作流', '编排'] },
  'mcp': { label: 'MCP 管理', words: ['mcp'] },
  'skills': { label: 'Skills', words: ['skill', 'skills', '技能'] },
  'model-router': { label: '模型/路由/Provider', words: ['provider', 'router', 'routing', 'model-config', 'model-switch', '模型切换', '供应商'] },
  'balance-usage': { label: '用量/余额/计费', words: ['balance', 'usage', 'token', 'cost', 'billing', 'quota', 'balance', '余额', '用量', '计费'] },
  'notify': { label: '通知/提醒', words: ['notify', 'remind', 'alert', '通知', '提醒'] },
  'office-docs': { label: '办公/文档', words: ['office', 'excel', 'ppt', 'word', 'doc', 'markdown', 'note', '笔记'] },
  'browser-web': { label: '浏览器/网页', words: ['browser', 'html', '网页', '浏览器'] },
  'network': { label: '网络/网关/代理', words: ['network', 'gateway', 'proxy', 'lan', '内网', '网络', '网关'] },
  'game-fun': { label: '游戏/娱乐', words: ['game', 'galgame', 'gomoku', 'minigame', 'tavern', '游戏', '娱乐'] },
  'data-research': { label: '数据/研究/交易', words: ['data', 'research', 'chart', 'stock', 'trade', 'quant', '数据', '研究', '股票', '科研'] },
}

function main() {
  const doc = JSON.parse(readFileSync(SRC, 'utf8'))
  const plugins = doc.plugins || []
  const buckets = Object.entries(BUCKETS).map(([tag, b]) => {
    const members = plugins.filter((p) => {
      const hay = `${p.full_name} ${(p.topics || []).join(' ')} ${(p.description || '').toLowerCase()}`
      return b.words.some((w) => hay.toLowerCase().includes(w.toLowerCase()))
    })
    return {
      tag, label: b.label,
      count: members.length,
      members: members
        .map((p) => ({ full_name: p.full_name, stars: p.stars ?? 0, score: p.health?.score ?? null, grade: p.health?.grade ?? null }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.stars - a.stars)),
    }
  }).filter((b) => b.count >= 3).sort((a, b) => b.count - a.count)

  // dedupe a plugin can land in several families — keep all, it's fine (multi-capability)
  const out = {
    generatedAt: new Date().toISOString(),
    ruleNote: '词汇启发式 v1：bilingual keyword lexicon over name/description/topics — approximate capability families, NOT functional-equivalence detection. LLM stage refines (see docs/ANALYSIS-DEPTH.md D3).',
    totalPlugins: plugins.length,
    buckets,
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`[overlap] ${buckets.length} families (top: ${buckets.slice(0, 5).map((b) => `${b.tag}×${b.count}`).join(', ')}) → data/overlap.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
