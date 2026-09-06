#!/usr/bin/env node
/**
 * pipeline/analyze · llm-tags — LLM capability tagging (D3) → data/llm.jsonl (append, resumable)
 *
 * Batches the authoritative set through a chat-completions API (DeepSeek or
 * any OpenAI-compatible endpoint) and stores STRUCTURED, HUMAN-SPOT-CHECKABLE
 * outputs — never free-text verdicts, never fed into the health score.
 *
 * Rules (docs/ROADMAP.md 附录A（LLM 使用纪律）):
 *   - only reads; output fields are {category, capabilityTags[], commands[],
 *     summaryZh, summaryEn, claims[], confidence} — claims list facts to verify.
 *   - resume: rows already tagged (id in data/state/llm.done) are skipped.
 *   - cost guard: env LLM_MAX (default 200) rows per run; LLM_BATCH (default 10).
 *   - API: DEEPSEEK_API_KEY (required) · DEEPSEEK_BASE_URL (default
 *     https://api.deepseek.com) · LLM_MODEL (default deepseek-chat).
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-… node pipeline/analyze/llm-tags.mjs            # first 200
 *   DEEPSEEK_API_KEY=sk-… LLM_MAX=0 node pipeline/analyze/llm-tags.mjs  # all
 *   node pipeline/analyze/llm-tags.mjs --dry-run                        # count only
 *
 * @module dsh-insights/stage-15
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sleep } from '../../lib/api.mjs'
import { DATA, PATHS, readJson } from '../../lib/data.mjs'

const SRC = PATHS.insights
const OUT = PATHS.llm
const DONE = PATHS.llmDone

const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || ''
const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const model = process.env.LLM_MODEL || 'deepseek-chat'
const maxRows = Number(process.env.LLM_MAX || 200)
const batch = Math.max(1, Number(process.env.LLM_BATCH || 10))

const SYSTEM = `你是 dsh 插件生态分析助手。给每个 DeepSeek Harness 插件输出结构化 JSON，只做客观描述与能力提取，不做质量评价。
输入每行以 "N. " 开头（N 为 1-based 序号）。逐条输出，每条一行 JSON（无 markdown 包裹），且每行必须带 "n" 字段等于输入序号，用于对位校验：
{"n":序号,"category":"主分类(英文kebab)","capabilityTags":["短标签,英文,<=8个"],"commands":["README里出现的命令/动作,没有则[]"],"summaryZh":"<=40字中文","summaryEn":"<=40词英文","claims":["README中可验证的具体宣称,如'46个工具','支持X协议';没有则[]"],"confidence":0-1}`

function extractJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

async function callLLM(rows) {
  const payload = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: '逐条分析以下插件（保持顺序），每条输出一行 JSON，"n" 字段等于该条序号：\n' +
        rows.map((p, i) => `${i + 1}. ${p.full_name} | ${(p.description || '').slice(0, 400)}`).join('\n') },
    ],
  }
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT || 420000)),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`LLM HTTP ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = await r.json()
  return j.choices?.[0]?.message?.content || ''
}

async function main() {
  if (process.argv.includes('--dry-run')) {
    const doc = readJson(SRC)
    console.log(`[llm] dry-run: ${doc?.plugins?.length || 0} plugins available · env: model=${model} base=${base} key=${key ? 'set' : 'MISSING'} max=${maxRows}`)
    return
  }
  if (!key) { console.error('[llm] DEEPSEEK_API_KEY required (or LLM_API_KEY)'); process.exit(2) }

  const doc = readJson(SRC)
  const plugins = doc?.plugins || []
  // parallel sharding: LLM_SHARDS=n with LLM_SHARD=i lets n processes split the
  // todo by a stable hash — each row is processed by exactly one shard.
  const shards = Number(process.env.LLM_SHARDS || 1)
  const shard = Number(process.env.LLM_SHARD || 0)
  const h = (s2) => { let x = 0; for (const c of String(s2)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x }
  const done = new Set(existsSync(DONE) ? readFileSync(DONE, 'utf8').split('\n').filter(Boolean) : [])
  const todo = plugins.filter((p) => !done.has(p.full_name) && (shards <= 1 || h(p.full_name) % shards === shard))
  const limit = maxRows > 0 ? Math.min(maxRows, todo.length) : todo.length
  console.log(`[llm] shard ${shard}/${shards}: ${todo.length} pending → tagging ${limit} (model=${model}, batch=${batch})`)
  mkdirSync(join(DATA, 'state'), { recursive: true })

  let tagged = 0
  let failed = 0
  const queue = todo.slice(0, limit)
  async function run() {
    while (queue.length) {
      const chunk = queue.splice(0, batch)
      // resilience: retry the SAME chunk up to 3x with backoff before giving up
      let text = null
      for (let attempt = 1; attempt <= 3 && text === null; attempt++) {
        try { text = await callLLM(chunk) }
        catch (e) {
          console.error(`[llm] chunk attempt ${attempt}/3 failed: ${String(e?.message || e).slice(0, 140)} — backoff ${30 * attempt}s`)
          if (attempt < 3) await sleep(30000 * attempt)
        }
      }
      if (text === null) {
        failed++
        console.error(`[llm] chunk abandoned after 3 attempts (abandoned=${failed}) — keep going`)
        if (failed >= 6) { console.error('[llm] too many abandoned chunks — stop (resume later, progress kept)'); break }
        continue
      }
      const lines = String(text).split('\n').filter((l) => l.trim().startsWith('{'))
      // P2-18：序号字段对位校验——按 "n" 匹配输入序号，对不上（缺号/重号/超界）
      // 整个 chunk 丢弃，不写 llm.jsonl、不标 llm.done，下轮重试（杜绝行号错位错标）
      const byN = new Map()
      let alignOk = lines.length > 0
      for (const l of lines) {
        const obj = extractJson(l)
        const n = obj && Number.isInteger(obj.n) ? obj.n : null
        if (!obj || n == null || n < 1 || n > chunk.length || byN.has(n)) { alignOk = false; break }
        byN.set(n, obj)
      }
      if (!alignOk || byN.size !== chunk.length) {
        failed++
        console.warn(`[llm] chunk 序号对位失败（${lines.length} 行输出 / ${chunk.length} 行输入）——整 chunk 丢弃重试（abandoned=${failed}）`)
        if (failed >= 6) { console.error('[llm] too many abandoned chunks — stop (resume later, progress kept)'); break }
        continue
      }
      let batchOk = 0
      chunk.forEach((p, i) => {
        const obj = byN.get(i + 1)
        const row = {
          full_name: p.full_name,
          url: p.url,
          category: obj?.category ?? null,
          capabilityTags: Array.isArray(obj?.capabilityTags) ? obj.capabilityTags.slice(0, 8) : [],
          commands: Array.isArray(obj?.commands) ? obj.commands.slice(0, 12) : [],
          summaryZh: obj?.summaryZh ?? null,
          summaryEn: obj?.summaryEn ?? null,
          claims: Array.isArray(obj?.claims) ? obj.claims.slice(0, 6) : [],
          confidence: typeof obj?.confidence === 'number' ? obj.confidence : null,
          model, taggedAt: new Date().toISOString(),
          spotCheck: 'LLM 生成 · 人工抽查（~5%）· 不进 health 分数',
        }
        if (!row.category && !row.summaryZh) { console.warn(`[llm] no usable JSON for ${p.full_name} — leave pending for catch-up`); return }
        appendFileSync(OUT, JSON.stringify(row) + '\n')
        appendFileSync(DONE, p.full_name + '\n')
        done.add(p.full_name)
        tagged++
        batchOk++
      })
      await sleep(500)
    }
  }
  await run()
  console.log(`[llm] tagged ${tagged} new rows (${done.size} total in state) · failures ${failed}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
