# dsh-plugin-insights · 路线图（Roadmap）

> 状态：v0.1 草案 · 2026-09-05 · 版本节奏见文末"快照与版本约定"。当前处于 **M0**。

## M0 · 基座收口（本周，2026-09 W2）

**目标**：把原型收口成可复现、可发布的基座，为全量评估打底。

范围与交付：

- [ ] **分片全量抓取**：发现层改为多 qualifier 分片，覆盖 `dsh-plugin` topic 全量 **13,592**（规避 GitHub 1000/查询封顶；当前原型仅 3,125，口径修正，见 RESEARCH.md §口径）。
- [ ] **校准集**：把已知真/假插件编入 `seeds`（ice5kysl 两个插件、joejojoking 抢注、DshMarketPlace 已裁 failed/not-a-layer 样本等），每轮跑批回归。
- [ ] **数据契约 v0**：定稿 `data/plugins.jsonl` 行结构（现字段 + `updatedAt`/`evidence` 雏形）；对齐 awesome 目录 plugins.json 的 join key（`owner/name`）。
- [ ] **开放快照**：首个全量权威集快照入库并提交；README 写清复现命令（含 GITHUB_TOKEN 用法）。
- [ ] **LICENSE 定稿**（MIT，代码与数据同款；O1 决策）；CI 每日刷新模板激活条件写明（需要 token + 远端）。
- [ ] 文档收口：VISION/ROADMAP/PRODUCT-PLAN/RESEARCH 已入库（本次）。

**退出标准**：一条命令从零跑出全量权威集快照；seeds 回归通过；README 可在陌生机器复现。

## M1 · 全量健康分 v1（2026-09 W3–W4）

**目标**：对权威集输出全量健康分，成为"全生态唯一客观评分"。

范围与交付：

- [ ] 健康分引擎接 dsh-plugin-health 口径：A–D + 0–100，维度（manifest / npm 一致性 / 仓库卫生 / 文档 i18n / 只读面启发式）+ **证据 URL** + **缺失标注**。
- [ ] `data/analysis.json` 升级为 schema v1（含 score 字段、维度分解、updatedAt、规则版本）。
- [ ] 站点 v2：可搜索列表 + 分数徽章 + 月度新增柱状 + npm 滞后 Top + 缺口矩阵（vs 官方内置），零依赖图表。
- [ ] 稳定查询：`by owner/repo`（本地 query CLI 已有 → 加 JSON 出口与站点页）。
- [ ] 周快照节奏 + 校准回归接入 `npm run snapshot`。

**退出标准**：权威集 ≥80% 有可核验分数；口径文档 + 校准回归 100%；站点可公开访问。

## M2 · 生态采纳（2026-10 W1–W4）

**目标**：分数进入主目录/市场的消费流——**被吸收，不竞争**。

范围与交付：

- [ ] **作者侧**：SVG 健康徽章（`![health A](…)` 可贴 README）+ health CLI 报告给可执行修复建议（现 -5/-20 扣分项 → "怎么修"链接）。
- [ ] **策展侧 pitch**：向 awesome-dsh-plugin org 提交集成提案（两案并进）：
  - A 案：plugins.json 增加可选 `health` sidecar（分数+规则版本+更新时间），市场卡片自动显示；
  - B 案：贡献门槛——新人插件需 health ≥ B 才收录（我们提供数据支撑与免费核验）。
- [ ] **市场侧**：给 dsh-market 提供质量 feed（同 plugins.json 形状或 DSHM_REGISTRY_URL 镜像可挂载）。
- [ ] **agent 可读**：数据对 AI 爬虫开放（站点 `robots.txt`/`llms.txt` 允许；JSON URL 稳定不藏登录墙）。
- [ ] 记录每家的响应：采纳 / 拒绝理由 / 替代路径（写 RESEARCH.md 决策日志）。

**退出标准**：≥1 家主目录/市场采纳（或明确拒绝并有记录的替代路径）；badge 在 ≥5 个作者仓库部署。

## M3 · 兼容矩阵与深检（2026-10 W5 – 2026-11）

**目标**：把"不兼容"这个第二大痛点变成可查数据。

范围与交付：

- [ ] **兼容矩阵 v1**：`engines.dsh` / lockstep `@deepseek-ai/dsh-*` peer 声明 vs 各 dsh 发行版本的实测口径（参考 dsh-market 的 host-aware 经验）。
- [ ] **冲突/互斥检测**：基于 manifest 的 priority 覆盖、同名插件、重复 loader 条目——产出"插件冲突报告"。
- [ ] **深检规模化**：只读面/消毒启发式（dsh-plugin-health `--dir` + 06-deep.mjs）覆盖 自荐 + star Top N + 标榜只读 的插件；结果并入 eval.deep，明确"非安全审计"。
- [ ] **月度生态报告**：新增/发布率/滞后/缺口/拥挤赛道趋势（第 1 期）。

**退出标准**：兼容矩阵 v1 上线；月度报告发布 ≥1 期；深检覆盖 ≥100 插件。

## M4 · 底座化与商业化探索（2026-11+）

**目标**：验证"质量数据底座"的终局形态，做 go/no-go。

- [ ] 数据底座授权探索：desktop 壳（dataelement/dsh-desktop、hairyf、anywhere-labs）、IDE/厂商、未来官方——卖数据/分发底座而非网站（Smithery→Arcade 同款终局）。
- [ ] 上游收编预案：若官方/awesome org 下场，数据与方法论贡献 upstream 的通道与协议。
- [ ] KPI 复盘（见 PRODUCT-PLAN §KPI）→ go / pivot / kill。

**退出标准**：写清 M4 复盘结论（一页纸），无论 go/no-go。

## 非目标（全阶段）

安装/交易/托管 · 社区评分 · 独立目录站竞争 · 承诺安全审计 · 登录型产品。

## 快照与版本约定

- 数据快照版本 = `v{YYYY.MM}` + 序号；`data/state/done.ids` 断点续跑不回退。
- 每次快照需：`GITHUB_TOKEN="$(gh auth token)" npm run snapshot` + seeds 回归通过 + commit。
- CI 每日刷新模板（已提交 .github 目录）在设置 token 与远端后激活。
- 规则版本：健康分口径变化必须 bump 规则版本并附 changelog（公信力依赖此条）。

## 每周执行节奏

1. 跑批（断点续跑）→ 2. analyze + site + export → 3. seeds 回归 → 4. commit 快照 → 5. 更新站点与数据 URL → 6. 记决策日志。
