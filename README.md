# dsh-insights — DSH 插件与生态洞察

> **对外站点：https://dsh-insights.com** · 本仓库 = 管线 + 站点 + 开放数据（ice5kysl/dsh-insights）
> 全量索引 → 真伪校验 → 健康评分 → 收录矩阵 → 「致作者的信」→ 生态周报 · 零依赖 Node · 开放可复核
>
> 文档：[Vision](./docs/VISION.md) · [Roadmap](./docs/ROADMAP.md) · [产品规划](./docs/PRODUCT-PLAN.md) · [产品设计](./docs/PRODUCT-DESIGN.md) · [调研证据库](./docs/RESEARCH.md) · [数据 Schema](./docs/SCHEMA.md) · [外发 SOP](./docs/OUTREACH.md) · 每插件体检工具 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)

## 是什么

dsh-insights 是 DeepSeek Harness 的**生态与动态全景观察站**（三层）：

- **L1 插件洞察**：对全量候选做真伪判定 → 权威集（manifest 门禁）→ 健康分（A–D/0–100，带证据）→ 收录渠道矩阵与「优质未收录」榜 → 打分明细/同类分位。
- **L2 官方动态（规划中）**：官方 releases/rc 节奏、docs 与内置能力演进、**rc 兼容雷达**（升级预警）。
- **L3 生态报告**：「致作者的信」（每插件，Stage 17）与「生态周报」（周更，Stage 18），面向社区与 dsh 官方。

它不是第 N 个插件目录/市场，而是让已有目录、市场、agent 与 dsh 官方**有据可依**的数据与观测源。健康分口径与体检工具见 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)。

## 站点与样例

- 站点：https://dsh-insights.com（仪表盘 · [周报](https://dsh-insights.com/weekly/) · [插件报告](https://dsh-insights.com/p/ice5kysl/dsh-workspace-kit/) · [开放数据](https://dsh-insights.com/data/) · [RSS](https://dsh-insights.com/feed.xml)）
- 「致作者的信」样例：`data/reports/ice5kysl__dsh-workspace-kit.md`
- 生态周报样例：`data/weekly/LATEST.md`

## 数据产出（开放）

| file | 说明 |
|---|---|
| `data/plugins.jsonl` · `invalid.jsonl` | **权威集 2113** + 分桶 1274（0 重复） |
| `data/plugins.csv` · `analysis.json` · `enrich.json` | 表格 / 聚合 / 每插件评分+分类+渠道 |
| `data/downloads.json` | npm 周下载（CI 更新） |
| `data/listed.json` | 收录渠道清单（awesome / imsai） |
| `data/llm.jsonl` · `reviews.jsonl` | LLM 能力标注 · 人工点评种子 |
| `data/reports/*.md` | 每插件「致作者的信」 |
| `data/weekly/*.md` · `last-diff.md` | 生态周报 · 快照 diff |
| `site/` | 多页静态站（仪表盘 + 周报存档 + /p/ 插件页 + /data + /about + feed.xml，零依赖） |

## 管线（Stage 地图）

```
00-lists 收录渠道   01-discover 多源发现  01b-npm-map npm→repo  02-validate 真伪→权威集/分桶(断点续跑)
03-analyze 聚合+评分/分类/渠道(→enrich)  04-site 仪表盘+抽屉  05-export CSV
06-deep 限量深检(写面/消毒)  07-downloads npm 周下载  07-regress rc 回归  08-score/diff 评分/快照diff
09-export-json  11-enrich-compat  12-badges  13-history  14-overlap  15-llm-tags  16-scenarios
17-report 「致作者的信」  18-weekly 生态周报  20-pages 多页站点(weekly/p/data/about/feed)   （Stage 19 官方动态快照 · M2）
bin: dsh-insights(run) · query · report · weekly · export-suggested · refresh-extra · resume-validate …
```

## 快速开始

```bash
GITHUB_TOKEN="$(gh auth token)" node bin/dsh-insights.mjs run   # 全量：发现→校验→analyze→site
npm run lists && npm run downloads && npm run analyze && npm run site && npm run export && npm run diff  # 轻量 refresh
npm run report                      # 生成默认「致作者的信」（自荐 2 插件）
node stages/17-report.mjs owner/repo  # 指定插件写信
npm run weekly                      # 生成生态周报（data/weekly/）
node bin/query.mjs --sort stars --top 10   # 查询
```

断点续跑：`data/state/done.ids`；限速自动退避；CI：`.github/workflows/refresh.yml`（默认轻量 / 手动 full）已启用。

## Status（2026-09-06）

- [x] 发现+校验：canonical 2875 全量验证 → **权威集 2113**（0 重复）
- [x] 仪表盘（KPI/按周新增/质量分级/功能分类/收录覆盖/优质未收录榜/全表+详情抽屉/打分明细/LLM 解读）
- [x] 健康评分与致作者的信（Stage 17）、生态周报（Stage 18）生成器 + 样例
- [x] npm 周下载入库（CI 已跑通）；快照 diff 基线；人工点评种子 5 条
- [x] **dsh-insights.com 已上线**（Pages 自定义域 + HTTPS 强制 + www 301）；站点多页化（Stage 20：周报/插件页/开放数据/方法论/RSS）
- [ ] M1 剩余：信件全量生成（2113 页）+ 契约字段普查 + 周报外发 SOP
- [ ] M2：Stage 19 官方动态快照器 + rc 兼容雷达（见 ROADMAP）

## 方法论与边界

"权威集" = 非 fork/归档 + `package.json` 声明 `dsh.bundle.patch` 且 patch 已提交（下限口径；纯 tarball 分发会进分桶复核）。健康分为**启发式、非安全审计**；深检（写面/消毒）为增量信号；人工点评与自动评估分开标注。数据许可与口径变更见 docs 与 LICENSE。

## 贡献 / 联系我们

- 想上榜/被收录/纠错/校准：提 issue 或 PR（数据与方法论全开源可复核）
- 想让你的插件进「优质未收录」榜或被写信：告诉我们 repo；人工点评在校对中
- 给 dsh 官方/社区：引用自由，注明出处即可；欢迎合作校核
