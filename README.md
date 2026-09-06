# DSH Insights — DeepSeek Harness 全景观察站

> **对外站点：https://dsh-insights.com** · 本仓库 = 管线 + 站点 + 开放数据（ice5kysl/dsh-insights）
> **插件健康 · 官方动态 · 生态趋势**：全量索引 → 真伪校验 → 健康评分 → 收录矩阵 → 「致作者的信」→ 生态周报 →（M2）官方动态快照 + rc 兼容雷达 · 零依赖 Node · 开放可复核
>
> 文档：[Vision](./docs/VISION.md) · [Roadmap](./docs/ROADMAP.md) · [产品规划](./docs/PRODUCT-PLAN.md) · [产品设计](./docs/PRODUCT-DESIGN.md) · [调研证据库](./docs/RESEARCH.md) · [数据 Schema](./docs/SCHEMA.md) · [外发 SOP](./docs/OUTREACH.md) · 每插件体检工具 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)

## 是什么

DSH Insights 是 DeepSeek Harness 的**生态与动态全景观察站**（三层）：

- **L1 插件洞察**：对全量候选做真伪判定 → 权威集（manifest 门禁）→ 健康分（A–D/0–100，带证据）→ 收录渠道矩阵与「优质未收录」榜 → 打分明细/同类分位。
- **L2 官方动态（v0 已上线）**：dsh 官方 releases/rc 节奏、docs 与内置能力演进、**rc 兼容雷达**（升级预警）+ DeepSeek 平台官方信号（模型/API 发布，同属可观测公开信号）。
- **L3 生态报告**：「致作者的信」（每插件，content/letters）与「生态周报」（周更，content/weekly），面向社区与 dsh 官方。

它不是第 N 个插件目录/市场，而是让已有目录、市场、agent 与 dsh 官方**有据可依**的数据与观测源。健康分口径与体检工具见 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)。

## 站点与样例

- 站点：https://dsh-insights.com（仪表盘 · [周报](https://dsh-insights.com/weekly/) · [插件报告](https://dsh-insights.com/p/ice5kysl/dsh-workspace-kit/) · [开放数据](https://dsh-insights.com/data/) · [RSS](https://dsh-insights.com/feed.xml)）
- 「致作者的信」样例：`data/reports/ice5kysl__dsh-workspace-kit.md`
- 生态周报样例：`data/weekly/LATEST.md`

## 数据产出（开放）

| file | 说明 |
|---|---|
| `data/plugins.jsonl` · `invalid.jsonl` | **权威集 4,507** + 分桶 2,603（0 重复 · 硬门禁 · 2026-09-06 快照，校验滚动扩大中） |
| `data/plugins.csv` · `analysis.json` · `enrich.json` | 表格 / 聚合 / 每插件评分+分类+渠道 |
| `data/downloads.json` | npm 周下载（CI 更新） |
| `data/listed.json` | 收录渠道清单（awesome / imsai） |
| `data/llm.jsonl` · `reviews.jsonl` | LLM 能力标注 · 人工点评种子 |
| `data/reports/*.md` | 每插件「致作者的信」 |
| `data/weekly/*.md` · `last-diff.md` | 生态周报 · 快照 diff |
| `site/` | 多页静态站（仪表盘 + 周报存档 + /p/ 插件页 + /data + /about + feed.xml，零依赖） |

## 管线（分层 · pipeline/<层>/）

```
collect 采集     discover 多源发现 · npm-map npm→repo · lists 收录渠道 · downloads npm 周下载
                 └─ dynamics（M2：dsh 官方 + DeepSeek 平台信号快照）
validate 校验    validate 真伪→权威集/分桶(断点续跑) · regress 校准回归(硬门禁) · deep 限量深检(写面/消毒)
analyze 分析     analyze 聚合+评分/分类/渠道(→enrich) · score 健康分 · compat 兼容信号
                 history 快照历史 · overlap 重叠族 · llm-tags LLM标注 · scenarios 场景推荐
publish 发布     site 仪表盘 · pages 多页站(weekly/p/data/about/feed) · export-csv · export-json(agent契约)
                 badges 徽章 · diff 快照diff
content 内容     letters 「致作者的信」 · weekly 生态周报
```

统一编排器 `bin/pipeline.mjs`（管线单一事实来源）：

```
node bin/pipeline.mjs daily      # CI 每日轻量（collect 增量 + 发布层）
node bin/pipeline.mjs friday     # daily + 内容层（信件 + 周报）—— CI 每周五
node bin/pipeline.mjs snapshot   # 分析 + 发布全链
node bin/pipeline.mjs full       # 全量：发现 → 校验 → snapshot
node bin/pipeline.mjs --only score,badges / --from analyze / --dry
```

层与产品三层的关系：collect/validate/analyze = L1 数据底座；content = L3；L2 官方动态（M2）落在 collect/dynamics → publish /dynamics 页 → 周报双栏。
bin: pipeline(编排) · dsh-insights(run，别名) · query · export-suggested · badge · resume-validate · llm-catchup · progress · compact(数据去重) · backfill-tree(树信号回填) · check-docs(文档数字对账)

## 快速开始

```bash
GITHUB_TOKEN="$(gh auth token)" node bin/pipeline.mjs full      # 全量：发现→校验→snapshot
node bin/pipeline.mjs daily                                     # 轻量 refresh（= CI 每日）
npm run report                      # 生成默认「致作者的信」（自荐 2 插件）
node pipeline/content/letters.mjs owner/repo  # 指定插件写信
npm run weekly                      # 生成生态周报（data/weekly/）
node bin/query.mjs --sort stars --top 10   # 查询
```

断点续跑：`data/state/done.ids`；限速自动退避；CI：`.github/workflows/refresh.yml`（每日 daily / 周五 friday 含周报 / 手动 full）已启用。

## Status（2026-09-06）

- [x] 发现+校验：候选池 14,331 全量分片抓取 → 断点续跑校验中（已完成 ~6.5k/14k）→ **权威集 4,507**（0 重复 · @2026-09-06）
- [x] 仪表盘（KPI/按周新增/质量分级/功能分类/收录覆盖/优质未收录榜/全表+详情抽屉/打分明细/LLM 解读）
- [x] 健康评分与致作者的信（content/letters）、生态周报（content/weekly）生成器 + 样例
- [x] npm 周下载入库（CI 已跑通）；快照 diff 基线；人工点评种子 5 条
- [x] **dsh-insights.com 已上线**（Pages 自定义域 + HTTPS 强制 + www 301）；站点多页化（publish/pages：周报/插件页/开放数据/方法论/RSS）
- [x] 信件全量生成（4,681 封 + `/p/` 插件页全量，diff 驱动重写 · 2026-09-06）
- [ ] M1 剩余：契约字段普查 + 周报外发 SOP
- [x] M2（v0 已上线）：collect/dynamics 快照器 + /dynamics 页 + 周报官方小节（2026-09-06）
- [ ] M2 剩余：rc 兼容雷达（v1 API 符号路线；声明率实测 ~1% 否决 v0）+ 官方时间序列 ≥4 周

## 方法论与边界

"权威集" = 非 fork/归档 + `package.json` 声明 `dsh.bundle.patch` 且 patch 已提交（下限口径；纯 tarball 分发会进分桶复核）。健康分为**启发式、非安全审计**；深检（写面/消毒）为增量信号；人工点评与自动评估分开标注。数据许可与口径变更见 docs 与 LICENSE。

## 贡献 / 联系我们

- 想上榜/被收录/纠错/校准：提 issue 或 PR（数据与方法论全开源可复核）
- 想让你的插件进「优质未收录」榜或被写信：告诉我们 repo；人工点评在校对中
- 给 dsh 官方/社区：引用自由，注明出处即可；欢迎合作校核
