# DSH Insights · 产品设计（站点结构与指标体系）

> 状态：v0.2 · 2026-09-06 · 本文回答三个问题：产品由哪些页面/模块组成、各呈现什么、如何更新；以及用什么样的指标体系衡量业务。
> 文档地图：[VISION](./VISION.md)（为什么）→ [PRODUCT-PLAN](./PRODUCT-PLAN.md)（做什么/怎么做）→ PRODUCT-DESIGN（页面与指标）→ [ROADMAP](./ROADMAP.md)（什么时候）· [RESEARCH](./RESEARCH.md)（证据）· [SCHEMA](./SCHEMA.md)（数据契约）· [OUTREACH](./OUTREACH.md)（外发）
> 架构约束（已定）：零依赖 Node + 静态多页 + GitHub Pages/Actions，无后端无 DB（见 PRODUCT-PLAN §4.1）。

## 一、产品形态总览

```
dsh-insights.com
│
├── /                仪表盘（门面）—— 生态全景一眼看完
├── /p/<o>/<r>/      插件页（触达）—— 每插件一页：健康分 + 致作者的信
├── /weekly/         周报（引擎）—— 存档 + 最新一期 + RSS
├── /dynamics/       官方动态（M2）—— dsh 官方演进时间线 + rc 兼容雷达
├── /data/           开放数据（被吸收接口）—— 稳定 JSON + 口径 + 许可
├── /about/          方法论（公信力来源）—— 规则版本 + 校准 + 边界声明
└── /feed.xml        RSS —— 订阅通道
└── /badge/<o>/<r>.svg  健康徽章 —— 作者侧传播物料
```

四个交付物各司其职：**仪表盘是门面，周报是增长引擎，插件页/信件是作者触达，/data 与徽章是被吸收的接口。**

## 二、页面与模块设计

### 2.1 `/` 仪表盘（现状演进，已基本就绪）

| 模块 | 呈现内容 | 数据源 | 更新 |
|---|---|---|---|
| Hero | 权威插件总数（count-up）、快照日期、最近一周新增 | analysis.json | 每日 CI |
| 统计条 | npm 发布率 / i18n / 活跃 30 天 / 平均质量分 / 收录率 / 无 README | analysis.json | 每日 CI |
| 01 生态趋势 | 按周新增面积图（hover 准线）、发布分布、文档覆盖、Top topics | analysis.json | 每日 CI |
| 02 质量分布 | A–D 分级条形、功能分类、各场景首选 | enrich.json | 每日 CI |
| 03 榜单 | Star 榜 / npm 版本滞后榜 / 优质未收录建议榜 | analysis+enrich | 每日 CI |
| 04 插件库 | 全量表：搜索/筛选/排序/列显隐/URL hash 分享；点击行开详情抽屉 | 内联 rows + plugins-detail.json | 每日 CI |

已有基础：2026-09-06 完成 UI 重构（极简精确方向）。后续增量：i18n 维度列、雷达预警标记（M2）。

### 2.2 `/p/<owner>/<repo>/` 插件页（M1 新增，页面数最大的资产）

每插件一页，从 `data/reports/<o>__<r>.md` 渲染，承担"致作者的信"的 Web 形态：

| 模块 | 内容 |
|---|---|
| 头部 | 插件名 + 等级大字 + 分数条 + 徽章代码（一键复制 `![health](…)`） |
| 分数证据 | 打分明细（每项 +N 与依据）、缺失数据明说 |
| 信件正文 | 同类定位 / 最值得做的 3 件事 / 收录文案建议 |
| 同类对比 | 同分类 Top5 分位表 |
| 版本历史 | npm/GitHub releases 时间线 |
| OG meta | 标题含插件名+等级——作者分享自己的页即传播 |

更新机制：**diff 驱动**——enrich 中该插件分数/等级变化才重新生成，避免权威集全量页面每日空转。

### 2.3 `/weekly/` 周报（M1 收口上线）

- `/weekly/index.html`：存档列表（倒序）+ 订阅引导（RSS / 仓库 watch）
- `/weekly/2026-W36.html`：单期页，双栏结构（M2 起）：官方动态 | 生态动态
- 内容模块：本周新增/消失、movers（star 跳涨/新晋 A 级）、收录动态、优质未收录观察名单、口径变更公告位
- 生成：content/weekly（已就绪），每周五 CI 自动跑 + commit + 重建 feed.xml
- **人只做 review 和外发**（LINUX DO / Discussions 发帖模板见外发 SOP）

### 2.4 `/dynamics/` 官方动态 + rc 雷达（M2）

| 模块 | 内容 | 数据源 |
|---|---|---|
| 官方时间线 | release/rc 发布时间轴、docs 变更节奏 | data/dynamics/*.json（collect/dynamics） |
| 版本状态表 | latest / rc dist-tags、距上次发布天数 | npm registry |
| **rc 兼容雷达** | 升级预警清单：受影响插件 + 需验证插件 + 依据 | 契约字段普查（M1 末）→ v0 声明对比 / v1 API 符号交集 |

雷达路线由 M1 末的普查结果决定：声明率 ≥10% 走 v0，否则直接 v1（深检 API 符号 × rc changelog）。

### 2.5 `/data/` 开放数据页

- 稳定 URL 清单与 schema 说明：`/data/insights.json`（全量）、`/data/plugins.jsonl`、`/data/enrich.json`、dynamics 序列
- **路径一旦公布永不变更**（agent 不跟 redirect）
- 许可声明：代码 MIT / 数据 CC BY 4.0（O1 定稿落地处）
- 构建时把对外数据文件拷入 `site/data/`（ Pages 直接服务，不再依赖 `../data` 相对路径）
- llms.txt 扩展为完整 agent 导航

### 2.6 `/about/` 方法论页

评分规则与阈值、规则版本 + CHANGELOG、校准集回归结果（每次 snapshot 的通过记录）、边界声明（启发式≠安全审计）、非目标清单。**这一页是公信力的实体化**——策展人决定要不要引用我们时看的就是它。

## 三、更新编排（CI 矩阵）

| 频率 | workflow | 跑什么 | 产物 |
|---|---|---|---|
| 每日 03:07 UTC | refresh.yml（单 cron + concurrency 组） | `pipeline daily`：lists → downloads → dynamics → analyze → site → export-csv → diff → pages | 快照 commit → pages.yml `workflow_run` 接力部署 |
| 每周五（同 cron，job 内按 UTC 周五切换） | refresh.yml | `pipeline friday`：daily 全套 + author-graph + metrics + letters + weekly + feed.xml | 周报 commit → 部署 |
| 手动 workflow_dispatch | refresh.yml | mode=full → `pipeline full`（discover → npm-map → validate → snapshot） | 全量 |
| 快照时（snapshot profile） | 本地/手动 | analyze → score → history → regress（门禁） → exports → overlap/scenarios → badges → site → pages | 全链 |
| 分数变化时 | diff 驱动 | 对应插件的信件 + 徽章 + 插件页重生成 | 单页 commit |

原则：**机器生成全文，人只 review + 外发**；任何一环失败降级为"本期沿用上次"，不阻塞管线。

## 四、产品业务指标体系

北极星（沿用 VISION）：**数据/报告被生态采纳**——目录、市场或 dsh 官方引用我们的分数/观测/预警。

### 指标树

```
北极星：生态采纳
├── A. 覆盖（做得全不全）
│   ├── A1 权威集数量（滚动，以 analysis.json 为准）
│   ├── A2 topic 全量覆盖率（权威集+分桶 / topic 总量）
│   └── A3 候选池新鲜度（新增候选入库滞后天数）
├── B. 新鲜度（更新得勤不勤）
│   ├── B1 快照滞后（目标 ≤7 天，CI 每日则 ≤1 天）
│   └── B2 CI 成功率（refresh 月度成功次数/应跑次数）
├── C. 公信力（分数可不可信）
│   ├── C1 校准集回归通过率（目标 100%，接入 snapshot 硬门禁）
│   ├── C2 争议工单数与解决时长（issue 计数）
│   └── C3 缺数据标注率（no-signal 明说的比例，宁缺毋假）
├── D. 内容运转（增长引擎转不转）
│   ├── D1 周报连续外发期数（断更即警报）
│   ├── D2 信件覆盖率（已生成页数 / 权威集）
│   └── D3 信件作者反馈数（回复/issue/star 回流）
├── E. 触达（有没有被看见）
│   ├── E1 徽章部署仓库数（M3 目标 ≥5）
│   ├── E2 仓库 ★ / 周报转载次数
│   └── E3 站点访问（Pages 无日志 → 用 GitHub traffic API + 外链 referral 近似）
└── F. 采纳（北极星的计数）
    ├── F1 引用/集成我们数据的目录·市场·工具数（M3 目标 ≥1）
    ├── F2 rc 雷达预警被作者 PR 采用次数（M2 起）
    └── F3 官方触点记录（回复/合作/引用，定性日志）
```

### 指标的工程化（自测量）

- 新增 `data/metrics.jsonl`：每周五 CI 顺带把 A/B/C/D 的可自动计算项 append 一行（E/F 手动维护在 RESEARCH 决策日志）
- 口径变更同样走规则版本 + changelog（指标定义本身也版本化）
- 每月第一周的周报固定带一个"我们的指标"小节——**对自己也用数据说话**，这是中立叙事的一部分

### 红线（与 kill criteria 联动）

- D1 连续断更 2 期 → 内容产品线暂停新功能，先修管线
- C1 回归非 100% → 当周快照不发布
- F1 到 M3 末仍为 0 且无明确在谈 → 触发 M4 go/pivot/kill 复盘

## 五、落地顺序（M1 内的执行序）

1.  多页生成骨架（page() 模板 + /weekly /about /data）
2. 域名接入（CNAME + HTTPS + github.io 301 + OG/favicon）
3. 插件页全量生成（content/letters 输出 → /p/ 路由）
4. 周报第 1 期 + feed.xml
5. 02-validate 契约字段普查（决定雷达路线）
6. metrics.jsonl 自测量接入 CI
