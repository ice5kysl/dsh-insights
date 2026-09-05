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
| `data/candidates-full/all.jsonl` | raw candidates (topics/curated/npm + npm→repo mapping) |
| `data/plugins.jsonl` · `data/invalid.jsonl` | **authoritative set** (2113) + bucketed rejects (1274) |
| `data/analysis.json` / `data/report.md` | aggregates + human report |
| `data/enrich.json` | per-plugin quality score/grade + functional category + curated-channel flags |
| `data/listed.json` | curated-channel membership (awesome / imsai) |
| `data/downloads.json` | npm last-week downloads (CI) |
| `data/llm.jsonl` | LLM capability tagging (category/tags/summary/claims) |
| `data/prev-plugin-ids.json` / `last-diff.md` | snapshot diff baseline / latest diff |
| `data/reports/*.md` | per-plugin 体检/改进报告（Stage 17） |
| `site/index.html` + `plugins-detail.json` + `plugins-cats.json` | dashboard + per-plugin detail drawer data |

## Stage 地图

```
00-lists      收录渠道清单(awesome/imsai)            07-downloads  npm 周下载     08-diff       快照 diff/基线
01-discover   多源发现(4×topic+curated+npm)          07-regress   dsh rc 回归评估  09-export-json 导出 JSON
01b-npm-map   npm 包→仓库映射                        08-score     评分              11-enrich-compat 兼容富化
02-validate   真伪校验→权威集/分桶(断点续跑)          12-badges    徽章              13-history  历史趋势
03-analyze    聚合+质量/分类/渠道(→enrich/analysis)   14-overlap   同质/重叠         15-llm-tags LLM 能力标注
17-report    每插件体检/改进报告
04-site       静态仪表盘+抽屉                         16-scenarios 场景分析
05-export     CSV
06-deep       限量深检(克隆/写面/消毒)
bin: dsh-plugin-insights(run) · query · refresh-extra · resume-validate · backfill-npm · badge · llm-catchup …
```

## Status

- [x] 发现+校验：canonical 2875 全量验证 → **权威集 2113**（分桶 1274，0 重复，COMPLETE marker）
- [x] 快照数据集 JSONL/CSV/schema 入库并推送（GitHub Pages 仪表盘在线）
- [x] 质量评分/功能分类/同类推荐/收录渠道矩阵/优质未收录建议榜/按周新增/LLM 解读抽屉
- [x] CI：`refresh.yml`（默认轻量 refresh，可手动 full；push 前 rebase）**已启用**
- [ ] npm 下载量数据待首次 CI 成功后入库（stage07 已就绪）
- [ ] 人工评价层 Top20（`data/reviews.jsonl` 种子已建，见下）
- [ ] 站点缺口对照（vs 官方内置）可视化

### 人工评价层（manual reviews）

`data/reviews.jsonl`：`{ full_name, kind:'manual-draft', reviewer, date, strengths[], risks[], bestFor }`。
种子覆盖自荐插件与建议榜头部；标注 `manual-draft` 需人工校对后再升为 `reviewed`。

Methodology notes: "authoritative" = passes the manifest gate above; it is a lower bound (plugins that ship only via tarball/GitHub releases without a committed manifest may be missed — flagged as `no-signal`/`no-package.json` for review). Searches cap at GitHub's 1000-result limit per query; curated dirs may be truncated by the contents API. Set `GITHUB_TOKEN` for the 5000/hr budget.
