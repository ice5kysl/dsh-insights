# dsh-insights · 路线图（Roadmap）

> 状态：**v0.2 · 2026-09-06** · 取代 v0.1 · 当前处于 **M1 收口期**。
> 文档地图：[VISION](./VISION.md)（为什么）→ [PRODUCT-PLAN](./PRODUCT-PLAN.md)（做什么/怎么做）→ [PRODUCT-DESIGN](./PRODUCT-DESIGN.md)（页面与指标）→ ROADMAP（什么时候）· [RESEARCH](./RESEARCH.md)（证据）· [SCHEMA](./SCHEMA.md)（数据契约）· [OUTREACH](./OUTREACH.md)（外发）
> 结构：先"对外可见与内容产品"（M1），再"官方动态与兼容雷达"（M2），再"生态采纳/月报"（M3），最后"底座化与托管决策"（M4）。v0.1 的 M0 基座已完成（见文末完成清单）。

## 里程碑速览

```
M1 对外可见（本周-2026-09 W4）  → dsh-insights.com 上线、信件/周报对外、站点品牌化
M2 官方动态与兼容雷达（10月）   → collect/dynamics 官方快照、rc 雷达 v0、双栏周报
M3 生态采纳与月报（10-11月）    → 徽章/渠道采纳、月度《dsh 演进报告》、深检规模化
M4 底座化与托管决策（11月+）    → 独立站/DB 触发点评估、数据底座授权、go/pivot/kill
```

## M1 · 对外可见与内容产品（2026-09 W3–W4）

**目标**：把"基座 + 原型报告"变成**一个能展示、能订阅、能外发的产品**。

- [x] 品牌与域名：对外 `dsh-insights.com`（已购）；引擎仓库 `dsh-insights`；文档 VISION/ROADMAP v0.2 定稿（本次）。
- [x] **域名接入**：Pages 自定义域 + CNAME（dsh-insights.com / www）+ HTTPS 强制；旧 github.io 由项目页自动跳转到自定义域。（2026-09-06）
- [ ] **站点品牌化**：标题/副标/页脚统一 dsh-insights；hero 文案覆盖"插件 + 官方 + 生态"；补 favicon/OG 元信息（社交分享）。
- [ ] **「致作者的信」产品化**（content/letters 已跑通）：默认全量生成（2113）；报告站路由 `/p/<owner>/<repo>`；后续接入"变化对比"（对上一期快照报分数/名次变化）。
- [ ] **生态周报对外**（content/weekly 已跑通）：固定节奏（每周五）+ 站点周报页 + `data/weekly/LATEST.md`。
- [ ] **校准与口径**：健康分规则版本化 + changelog；seeds 回归接入 snapshot（沿用 v0.1 M1 口径）。
- [ ] **多语言 i18n 检测器**：README 语言足迹从"中/英检出"扩展到 ja/ko/es 等多语言（文件名普查 + 内容脚本检测），输出每插件语言清单并入数据与站点（i18n 维度）。
- [ ] **发布渠道 SOP**：LINUX DO / GitHub Discussions / awesome 社区 / （可选的 dsh 官方）发帖模板与节奏；转载许可文案。

**退出标准**：dsh-insights.com 可访问且品牌一致；≥2 期周报对外；"致作者的信"可全量生成并至少覆盖自荐 2 插件公开发布样例。

## M2 · 官方动态与兼容雷达（2026-10）

**目标**：让"洞察"名副其实——覆盖 **dsh 本身**的演进，并在官方升级时帮插件作者提前避险。

- [ ] **官方动态快照器**（`pipeline/collect/dynamics.mjs`，原 collect/dynamics）：抓 `deepseek-ai/DeepSeek-Harness` releases/tags、最新 rc、官方仓库 star/pushed、docs 变更数、`@deepseek-ai/*` 关键包 dist-tags 时间线 **+ DeepSeek 平台官方信号**（模型/API 发布，可观测公开信号源）→ `data/dynamics/dsh-YYYY-WW.json` 时间序列。
- [ ] **周报升级为"官方 × 生态"双栏**：加入官方动态小节（release/rc、docs 信号、兼容提示）。
- [ ] **rc 兼容雷达 v0**：对比"插件声明目标版本/最近验证"与官方最新 rc；发布"升级预警清单"（受影响 + 需验证）。
- [ ] 官方仓库订阅与低流量抓取：纳入 CI refresh，成本极低。
- [ ] 站点新增"核心 dsh"页：官方动态时间线与兼容状态表。

**退出标准**：官方动态时间序列 ≥4 周连续；rc 雷达产出可读预警；向 dsh 官方/社区至少发一次"官方动态 + 生态"合刊示例。

## M3 · 生态采纳与月度报告（2026-10 – 2026-11）

**目标**：分数与观测进入主目录/市场/官方的消费流（**被吸收，不竞争**），并升级为月度深度内容。

- [ ] **作者侧徽章**：SVG 健康徽章（`![health A](…)`）+"怎么修"链接（沿用 dsh-plugin-health 口径）。
- [ ] **策展侧 pitch（两案并进）**：A 案 plugins.json `health` sidecar；B 案收录门槛（health ≥ B）。
- [ ] **市场/agent 可读**：稳定 JSON URL、`llms.txt`/`robots.txt`、无登录墙。
- [ ] **月度《dsh 演进报告》**：官方演进 + 生态规模/质量/缺口/兼容的月度汇编（面向官方与社区）。
- [ ] **人工点评层**（已有 reviews.jsonl 种子）扩充到 Top 20–50，并标注 `reviewed` 与 `manual-draft` 分开。
- [ ] 记录每家目录/官方响应与替代路径（RESEARCH 决策日志）。

**退出标准**：≥1 家主目录/市场/官方采纳或明确拒绝且有记录；badge 部署 ≥5 仓库；月报 ≥1 期。

## M4 · 底座化与托管决策（2026-11+）

**目标**：验证"质量+动态数据底座"终局形态，做 go/no-go；同时回答"要不要独立站/数据库"。

- [ ] **托管决策触发器**（当前判定：**暂不上 DB/独立后端**）：出现 ① 用户生成内容（人工评价/收藏/注册）② 每日/实时 diff 需求 ③ 数据量到需搜索引擎级 → 才评估 SQLite/Postgres + 轻量后端；届时再迁移。
- [ ] 数据底座授权探索：desktop 壳 / IDE / 厂商 / 官方（卖数据与分发底座而非网站）。
- [ ] 上游收编预案：若官方/awesome org 下场，贡献数据与方法论的通道与协议。
- [ ] KPI 复盘（PRODUCT-PLAN §KPI）→ go / pivot / kill。

**退出标准**：一页纸 M4 结论（go/pivot/kill + 托管决策记录），无论方向。

## 非目标（全阶段，维持 v0.1）

安装/交易/托管 · 社区评分 · 独立目录站竞争 · 承诺安全审计 · 登录型产品 · 论坛舆情抓取。

## 完成清单（v0.1 M0 + 2026-09 会话增量）

- [x] 多源发现/分片全量抓取与真伪校验：权威集 **2113**（canonical 2875 全量验证、invalid 分桶 1274、0 重复、断点续跑/限速）。
- [x] 数据快照 JSONL/CSV/schema + 报告 + 站点（KPI/按周新增/质量分级/功能分类/收录矩阵/优质未收录榜/详情抽屉/打分明细/LLM 解读）+ 查询 CLI。
- [x] npm 周下载（CI 已取数入库）；快照 diff 基线；收录渠道清单；人工点评种子。
- [x] 「致作者的信」（content/letters）与「生态周报」（content/weekly）生成器 + 首批样例。
- [x] CI：`refresh.yml`（默认轻量 / 手动 full，push 前 rebase）已启用并跑通一次。

## 快照与版本约定（沿用）

- 快照版本 = `v{YYYY.MM}.{n}`；`data/state/done.ids` 断点续跑不回退。
- 每次快照：跑批 → analyze/site/export → 校准回归 → commit；CI 每日轻量 refresh + 可手动 full。
- 健康分/雷达口径变更必须 bump 规则版本 + changelog。

## 附录 A · 分析深度 backlog（原 ANALYSIS-DEPTH.md，2026-09-06 并入并标注真实状态）

目的：把单插件分析从"静态元数据"加深到"事实核验 + 语义理解 + 时间趋势"，壁垒分布在**事实层 / 时间层 / 信任层 / 采纳层 / 分析层**。

| # | 项 | 壁垒 | 成本 | 状态（2026-09-06 核实） |
|---|---|---|---|---|
| D1 | 重叠/重复族检测（词汇桶→LLM 精修） | 分析层 | 低 | ✅ v1 已跑：`pipeline/analyze/overlap.mjs` 词汇启发式 → `data/overlap.json` |
| D2 | OSV 供应链漏洞计数（health-v3 新维度） | 事实层 | 低 | ⬜ 未做 |
| D3 | LLM 语义标注（能力摘要/分类/i18n，结构化回填） | 分析层 | 中 | ✅ 首跑：`pipeline/analyze/llm-tags.mjs` → `data/llm.jsonl`（增量续跑中） |
| D4 | 实装 smoke 测试（CI 沙箱跑真实 harness） | 事实层(最硬) | 高 | ⬜ 未做（M3，从 top50 + 自荐开始） |
| D5 | 快照历史积累（分数趋势） | 时间层 | 低 | ✅ 在跑：`pipeline/analyze/history.mjs` 每日 append |
| D6 | README 结构质量（小节/坏链/截图） | 信任层 | 低 | ⬜ 未做（M2） |
| D7 | 单插件 dossier 页 | 信任层 | 中 | 🟡 部分：`/p/<o>/<r>/` 插件页（publish/pages）已上线，深检/趋势并入待做 |
| D8 | 场景推荐（场景词表 + 透明排序 + scenarios.json） | 分析层 | 中 | ✅ v1 已跑：`pipeline/analyze/scenarios.mjs` + 站点场景首选 |

**LLM 使用纪律（公信力底线，维持）**：LLM 只做"人没法机械化、但结果可被人类抽查"的活；输出必须结构化 + 注明"LLM 生成，人工抽查"，**不进 health 分数**（分数只含纯客观信号）。成本控制：只对权威集 + 增量（新增/变更）；分级模型（便宜模型做标签）。别让 LLM 下"好/坏"判断。

**壁垒自检**：事实层（D2/D4，抄 D4 需整套 dsh 沙箱 CI）· 时间层（D5，历史只能从当下开始攒）· 分析层（D1/D3/D8，需 LLM 预算 + 校准纪律）· 信任层（D6/D7 + 公开规则/校准/申诉）· 采纳层（M3 集成提案，徽章已上 2 个自荐插件 README，提案 #4399 待回复）。
