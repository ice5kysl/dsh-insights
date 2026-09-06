#!/usr/bin/env node
/**
 * pipeline/collect · author-graph — 作者协作关系图（生态关键节点人物）。
 *
 * 采样口径（如实标注）：★ Top 200 权威插件的 contributors（GitHub API，
 * ~200 次调用，周级刷新足够）→ 共同出现在同一插件 = 一条协作边。
 * 节点影响力 = 插件数 + 关联插件 ★ 总和；边权重 = 共享插件数 + ★ 量级。
 *
 * Output: data/authors-graph.json
 *   { fetchedAt, sampledPlugins, nodes:[{id, plugins, stars, repos[]}],
 *     links:[{source, target, weight, repos[]}] }
 *
 * Run: node pipeline/collect/author-graph.mjs [采样数=200]
 */

import { PATHS, readJsonl, writeJson, loadPlugins } from '../../lib/data.mjs'
import { ghApi } from '../../lib/api.mjs'

const SAMPLE = Number(process.argv[2]) || 200
const PER_REPO = 10

async function main() {
  const plugins = loadPlugins()
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, SAMPLE)
  console.log(`[author-graph] sampling top ${plugins.length} plugins by ★`)

  const nodeOf = new Map() // login → {id, plugins:Set, stars, repos:Set}
  const edgeOf = new Map() // "a|b" → {source,target,weight,repos:Set}
  const touch = (login, repo, stars) => {
    if (!login || login.endsWith('[bot]') || login.endsWith('-bot')) return null
    let n = nodeOf.get(login)
    if (!n) { n = { id: login, plugins: new Set(), stars: 0, repos: new Set() }; nodeOf.set(login, n) }
    n.plugins.add(repo)
    n.repos.add(repo)
    n.stars += stars || 0
    return n
  }

  let fetched = 0
  for (const p of plugins) {
    const r = await ghApi(`/repos/${p.full_name}/contributors?per_page=${PER_REPO}`)
    fetched++
    if (fetched % 40 === 0) console.log(`[author-graph] ${fetched}/${plugins.length}`)
    if (!r.ok || !Array.isArray(r.body)) continue
    const logins = r.body.map((c) => c.login).filter(Boolean).slice(0, PER_REPO)
    // 保底：API 无贡献者记录时用 owner（保证图谱覆盖采样插件）
    const people = logins.length ? logins : [p.owner]
    for (const login of people) touch(login, p.full_name, p.stars || 0)
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const [a, b] = [people[i], people[j]].sort()
        const key = `${a}|${b}`
        let e = edgeOf.get(key)
        if (!e) { e = { source: a, target: b, weight: 0, repos: new Set() }; edgeOf.set(key, e) }
        e.weight += 1 + Math.log10((p.stars || 0) + 1)
        e.repos.add(p.full_name)
      }
    }
  }

  const nodes = [...nodeOf.values()]
    .map((n) => ({ id: n.id, plugins: n.plugins.size, stars: n.stars, repos: [...n.repos].slice(0, 12) }))
    .sort((a, b) => (b.plugins - a.plugins) || (b.stars - a.stars))
  const links = [...edgeOf.values()]
    .map((e) => ({ source: e.source, target: e.target, weight: Math.round(e.weight * 10) / 10, repos: [...e.repos].slice(0, 6) }))
    .sort((a, b) => b.weight - a.weight)

  // P2-16：限流/失败静默 continue 可能产出空/近空图——此时保留旧文件并告警，绝不覆盖写
  if (nodes.length < 10) {
    console.error(`[author-graph] 采集结果近空（nodes=${nodes.length}，fetched ${fetched}/${plugins.length}）——保留旧 authors-graph.json 不覆盖；疑似限流/网络失败，下轮重跑`)
    return
  }

  const doc = {
    fetchedAt: new Date().toISOString(),
    sampledPlugins: plugins.length,
    note: `★ Top ${plugins.length} 权威插件的 contributors 协作关系（采样，非全量）`,
    nodes,
    links,
  }
  writeJson(PATHS.authorsGraph, doc, true)
  const multi = nodes.filter((n) => n.plugins >= 2).length
  console.log(`[author-graph] ${nodes.length} people（多插件 ${multi}）· ${links.length} edges → ${PATHS.authorsGraph}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
