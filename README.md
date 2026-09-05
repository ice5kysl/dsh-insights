# dsh-plugin-insights

> Index / validate / evaluate / analyze the whole **DeepSeek Harness (dsh) plugin ecosystem**. 全量 dsh 插件索引、评估与分析管线（零依赖 Node）。

## 产品定位（Product）

**dsh-plugin-insights = DSH 插件生态的质量评估数据层（quality data layer）**：全量索引 + 客观健康分 + 生态分析 + 开放数据快照。它**不是**第 N 个插件目录/市场，而是让已有目录（[awesome-dsh-plugin](https://awesome-dsh-plugin.com)）、应用内市场（[dsh-market](https://github.com/dsh-market/dsh-market)）和 agent 的卡片上有据可依的那个分数。健康分口径与体检工具见 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)。

产品文档：[Vision](./docs/VISION.md) · [Roadmap](./docs/ROADMAP.md) · [产品规划](./docs/PRODUCT-PLAN.md) · [生态调研证据库](./docs/RESEARCH.md)

---

What it does: instead of being yet another curated list, this pipeline treats the ecosystem as data —

1. **Discover** (multi-source): GitHub `topic:dsh-plugin` / `deepseek-harness` / `dsh-bundle` / `cordis-plugin` searches + curated-list data dirs (awesome-dsh-plugin `data/plugins`, imsai-sh `catalog/plugins`) + npm search.
2. **Validate → authoritative set**: cheap noise filtering first, then real checks — not fork/archived, `package.json` declares `dsh.bundle.patch`, patch file committed. Noise is bucketed (`data/invalid.jsonl`).
3. **Evaluate (metadata, full-set)**: manifest shape, `exports["./client"]`, `lib/` artifacts, npm publish state & version drift, docs / bilingual docs, repo age/activity/stars/topics, licenses. (Limited deep clone-based security scans come later, reusing `dsh-plugin-health` heuristics.)
4. **Analyze + publish**: aggregate stats (`data/analysis.json`, `data/report.md`) and a self-contained static site (`site/index.html`).

## Run

```bash
GITHUB_TOKEN="$(gh auth token)" node bin/dsh-plugin-insights.mjs run [--limit N]
# or stage by stage:
npm run discover && npm run validate && npm run analyze && npm run site
```

Resumable: `data/state/done.ids` keeps progress; re-running continues where it stopped.

## Outputs

| file | what |
|---|---|
| `data/candidates-all.jsonl` | raw candidates from every source (`topic:dsh-plugin` **full crawl** via created-window sharding + supplementary topics/curated/npm) |
| `data/plugins.jsonl` | **authoritative set** (valid plugins + evaluation fields) |
| `data/invalid.jsonl` | rejected candidates bucketed by reason |
| `data/analysis.json` / `data/report.md` | aggregates + human report |
| `site/index.html` | self-contained static dashboard |

## Status

- [x] pipeline scaffold + pilot run (discover 3125 raw → validate first 25 → report+site)
- [~] full validation of all repo candidates in progress (resumable; ~2889 repo candidates, batch 900 running; CONCURRENCY+resume ready)
- [ ] npm candidates → repo mapping
- [ ] limited deep checks (read-only-surface / sanitizers) on top/self plugins
- [ ] final snapshot commit + CI daily refresh template
- [ ] site polish (charts, gap matrix vs official)

Methodology notes: "authoritative" = passes the manifest gate above; it is a lower bound (plugins that ship only via tarball/GitHub releases without a committed manifest may be missed — flagged as `no-signal`/`no-package.json` for review). Searches cap at GitHub's 1000-result limit per query; curated dirs may be truncated by the contents API. Set `GITHUB_TOKEN` for the 5000/hr budget.
