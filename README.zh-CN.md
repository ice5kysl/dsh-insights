# DSH Insights — DeepSeek Harness 全景观察站

> **[English (default)](./README.md)** · 简体中文
> **对外站点：https://dsh-insights.com** · 本仓库 = 管线 + 站点 + 开放数据（ice5kysl/dsh-insights）
> **插件健康 · 官方动态 · 生态趋势**：全量索引 → 真伪校验 → 健康评分 → 收录矩阵 → 「致作者的信」→ 生态周报 → 官方动态快照（v0 已上线）+（M2）rc 兼容雷达 · 零依赖 Node · 开放可复核
>
> 文档：[Vision](./docs/VISION.md) · [Roadmap](./docs/ROADMAP.md) · [产品规划](./docs/PRODUCT-PLAN.md) · [产品设计](./docs/PRODUCT-DESIGN.md) · [调研证据库](./docs/RESEARCH.md) · [数据 Schema](./docs/SCHEMA.md) · [外发 SOP](./docs/OUTREACH.md) · 每插件体检工具 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)

## 为什么做

`dsh-plugin` topic 一个月冲到 **13,700+ 仓库**。「找得到」已被解决（awesome / 市场），**「信得过」无人解决**：重复、弃维护、装不上、兼容风险才是用户真实成本，而官方明言不做评判。DSH Insights 补上评估层：**每个插件一个诚实、可复现的数字。**

## 三层结构

| 层 | 内容 | 交付 |
|---|---|---|
| **L1 插件洞察** | 真伪判定（manifest 门禁）→ 权威集 → 健康分 **S–D/0–100**（health-v4，逐条证据）→ 收录矩阵 → 「优质未收录」榜 | 数据快照 + 站点 + /p/ 详情页 + 信件 |
| **L2 官方动态**（v0 已上线） | dsh releases/rc 节奏、dist-tags、DeepSeek 平台信号；rc 兼容雷达（M2） | /dynamics + 周报官方小节 |
| **L3 生态报告** | 生态周报（每周五 CI 生成）+ 每插件「致作者的信」（外发物料） | /weekly + RSS + data/reports/ |

不是第 N 个目录/市场——让目录、市场、agent 与 dsh 官方**有据可依**的数据与观测源。

## 站点

首页（搜索 + KPI + 最新入库 + 场景速配）· [仪表盘](https://dsh-insights.com/dashboard/)（趋势/质量/榜单 + 插件库 #browse）· 插件详情页 [`/p/<owner>/<repo>/`](https://dsh-insights.com/p/ice5kysl/dsh-workspace-kit/)（全量权威集，客观数据）· [场景推荐](https://dsh-insights.com/scenarios/) · [作者榜](https://dsh-insights.com/authors/) · [生态周报](https://dsh-insights.com/weekly/)（双栏阅读器，可导出 MD/PDF/PNG）· [官方动态](https://dsh-insights.com/dynamics/) · [健康徽章](https://dsh-insights.com/badge/) · [开放数据](https://dsh-insights.com/data/) · [关于/方法论](https://dsh-insights.com/about/) · [RSS](https://dsh-insights.com/feed.xml)。深浅色主题切换、无 JS 可读、`llms.txt` 面向 agent。

## 数据产出（开放）

| file | 说明 |
|---|---|
| `data/plugins.jsonl` · `invalid.jsonl` | **权威集 9,141** + 分桶 3,642（0 重复 · 硬门禁 · 2026-09-06 快照，校验滚动扩大中） |
| `data/insights.json` + `insights.schema.json` | agent 契约（稳定 URL，schema 只增不改） |
| `data/analysis.json` · `enrich.json` · `plugins.csv` | 聚合 / 每插件评分+渠道 / 表格 |
| `data/dynamics.json` · `metrics.jsonl` | 官方动态快照 · 产品自测量指标 |
| `data/llm.jsonl` · `data/reports/*.md` · `data/weekly/*.md` | LLM 能力标注 · 致作者的信（外发物料）· 周报 |

许可：**代码 MIT · 数据 CC BY 4.0**（署名 dsh-insights.com）；仓库元数据（描述等）版权归原始作者。

## 管线

```
collect    discover 分片全量爬取 · npm-map · lists 收录渠道 · downloads 周下载 · dynamics 官方动态 · refresh 元数据合并
validate   validate 真伪→权威集/分桶(断点续跑) · regress 校准回归(硬门禁) · deep 限量深检(写面/消毒)
analyze    analyze(→enrich) · score 健康分 · history 快照历史 · compat · overlap · llm-tags · scenarios
publish    site 仪表盘 · pages 多页站(首页/p/weekly/dynamics/scenarios/authors/badge/data/about) · 导出 · badges · diff
content    letters 致作者的信 · weekly 生态周报
```

统一编排器 `bin/pipeline.mjs`：

```bash
node bin/pipeline.mjs daily      # CI 每日轻量
node bin/pipeline.mjs friday     # daily + discover/refresh + author-graph + metrics + 信件/周报（CI 每周五）
node bin/pipeline.mjs snapshot   # 分析 + 发布全链
node bin/pipeline.mjs full       # 发现 → 校验 → snapshot
node bin/pipeline.mjs --only score,badges / --from analyze / --dry
```

快速开始：

```bash
GITHUB_TOKEN="$(gh auth token)" node bin/pipeline.mjs full   # 首次全量
node bin/query.mjs --sort stars --top 10                     # 查询
node bin/recheck.mjs owner/repo                              # 强制重验单插件
node bin/check-docs.mjs                                      # README ↔ 数据对账
```

CI（`.github/workflows/refresh.yml`）：单 cron 03:07 UTC，周五在 job 内切 profile，concurrency 组排队；`workflow_run` 接力部署。`recheck.yml` 供作者在 Actions 手动触发本插件重检。

## 评分口径（一段话）

100 起扣（fail −20 / major −10 / warn −5 / minor −2），每条扣分带证据；缺失数据不虚构不扣分；星数不进分；LLM 输出只展示不进分。等级 **S≥95 · A≥90 · B≥75 · C≥60 · D<60**。启发式评估，**非安全审计**——深检（写面/消毒）为单独标注的增量信号。争议走 [issue 模板](.github/ISSUE_TEMPLATE/)（中英皆可）。

## Status（2026-09-06）

- [x] 全量爬取+校验：候选 14,331 → **权威集 9,141**（0 重复硬门禁；断点续跑滚动扩大）
- [x] 站点上线（自定义域/深浅色/搜索/SEO 地基/统计）；/p/ 详情页覆盖全量；周报双栏阅读器（MD/PDF/PNG 导出）
- [x] 健康分 v4（新增 S 级）+ 校准回归进 snapshot 门禁；审计 48 项闭环（`docs/AUDIT-2026-09-06.md`）
- [x] 元数据刷新回路（Tier 0）挂入周五；信件日期冻结（diff 驱动页面）
- [ ] M1 剩余：契约字段普查 · i18n 检测器（ja/ko/es）· 周报外发（≥2 期对外，W37 起算）
- [ ] M2 剩余：rc 兼容雷达（v1 API 符号路线）· 官方时间序列 ≥4 周

## 参与贡献

- **插件作者**：看 `/p/<owner>/<repo>/` 页、挂徽章、[申请重检](https://github.com/ice5kysl/dsh-insights/actions/workflows/recheck.yml)、提 issue 申诉/纠错（中英皆可）。
- **策展人/agent**：消费 `/data/insights.json`（join key `owner/repo`，schema 只增不改，CC BY 4.0）。
- 一切由开源管线生成——clone 即可复现任意数字。
