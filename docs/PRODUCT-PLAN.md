# DSH Insights · 产品规划（Product Plan）

> 状态：**v0.2 · 2026-09-06** · 取代 v0.1 草案 · 定位已从"插件质量数据层"升级为 **DSH 生态与动态全景观察站**（L1 插件 / L2 官方动态 / L3 生态报告）。本文件把 v0.2 定位落成可执行的产品与技术方案。
> 文档地图：[VISION](./VISION.md)（为什么）→ PRODUCT-PLAN（做什么/怎么做）→ [PRODUCT-DESIGN](./PRODUCT-DESIGN.md)（页面与指标）→ [ROADMAP](./ROADMAP.md)（什么时候）· [RESEARCH](./RESEARCH.md)（证据）· [SCHEMA](./SCHEMA.md)（数据契约）· [OUTREACH](./OUTREACH.md)（外发）

## 0. v0.2 定位的实质（我们到底在做什么变化）

v0.1 → v0.2 不是加功能，是**换了产品形态**：

| | v0.1 | v0.2 |
|---|---|---|
| 形态 | 数据层（分数被引用） | **观测站**（数据 + 内容 + 预警） |
| 对象 | 插件（L1） | 插件 + 官方演进（L2）+ 生态趋势（L3） |
| 交付 | 快照 + 站点 | 快照 + 站点 + **信件** + **周报** + **rc 雷达** |
| 增长引擎 | 被目录/市场吸收 | 被吸收 **+ 内容产品自传播**（周报订阅、信件触达作者） |

**关键推论**：v0.1 的瓶颈是"别人愿不愿意引用"；v0.2 多了一条自己掌控的增长腿——内容。因此**周报与信件的稳定性、订阅机制、触达效率**是和数据质量同级的产品问题，不是运营附属品。

## 1. 用户与 JTBD（在 v0.1 基础上修订）

| Persona | 主任务 | v0.2 新增交付 |
|---|---|---|
| 安装者/企业 | 装前 10 秒判质量与风险 | rc 升级时知道"我装的哪些会遭殃"（雷达） |
| 插件作者 | 被信任、被收录、被安装 | 「致作者的信」定期上门：分数变化 + 3 件最值得做的事 |
| 策展人（awesome / dsh-market） | 收录/排序有据可依 | 可订阅的质量 feed，而非一次性数据集 |
| dsh 官方 | 看见生态全貌 | 中立、可复核的生态度量 + 兼容预警合刊 |
| AI / agent | 稳定 JSON 直读 | llms.txt 扩展 + 稳定 URL 契约（见 §5） |

## 2. 产品地图：三层 × 四个交付物

```
                    站点（dsh-insights.com）   信件        周报        开放数据/徽章
L1 插件洞察           / 全量表+详情            /p/<o>/<r>    movers 小节   insights.json · badge.svg
L2 官方动态 (M2)      /dynamics 时间线          —           官方小节      dynamics.json 时间序列
L3 生态趋势           / 趋势图                 分数变化对比   主体          history/weekly 存档
```

四个交付物的优先级逻辑：**站点是门面，周报是引擎，信件是触达，数据是被吸收的接口**。
月报（ROADMAP M3）降级为"周报季度精选汇编"——先证明周报能稳定跑 4 期再谈月度深度内容。

## 3. 现状盘点与差距（2026-09-06 实测）

已完成（M0 + M1 部分）不再赘述，以下是要补的**结构性差距**：

1. **站点架构到头了**：单个 `index.html`（451 KB 内联）承载不了 L2/L3——2113 封信件页、周报存档、官方时间线都需要多页路由。现在改比上线后再改便宜。
2. **没有订阅机制**：周报的"固定节奏"目前=手动发帖。静态站最便宜的订阅是 **RSS/Atom feed**（`/feed.xml`），一次生成、永久有效。
3. **rc 雷达缺数据契约（实测）**：当前 `plugins.jsonl` 只有 `dshPlatform`（web 1371 / null 731），**没有任何插件声明的目标 dsh 版本**。雷达 v0 要求的"声明目标版本 vs 最新 rc"对比，必须先扩 02-validate 采集契约字段（见 §4.4），否则雷达只能产出空预警。
4. **内容生产的单人风险**：周报/信件若依赖人写，必然断更。原则：**机器生成全文，人只做 review + 外发**。content/letters、content/weekly 已是这个形态，要保持。
5. **域名/品牌切换的成本项**：Pages CNAME、github.io 301、favicon/OG、`llms.txt` 里的 URL 更新——小但零碎，集中在 M1 一次做完。

## 4. 技术实现方案

### 4.1 架构决策（维持静态 + CI，不上后端）

ROADMAP M4 的触发器（UGC / 实时 diff / 搜索级数据量）一个都没出现，**继续零依赖 Node + git 内数据 + GitHub Pages**。所有"产品感"用预生成解决，不用运行时解决。

### 4.2 站点 v2：单页 → 多页静态生成（M1，优先级最高）

新增 （或在 04 基础上演进），零依赖 Markdown→HTML（信件/周报是 md，写一个 100 行的渲染器即可，不引依赖）：

```
site/
  index.html            仪表盘（现有，保留重设计后的单页叙事）
  p/<owner>/<repo>/index.html   每封信件一页（2113 页，从 data/reports/*.md 渲染）
  weekly/index.html + weekly/2026-W36.html   周报存档
  feed.xml              RSS（周报 + 重大口径变更）
  llms.txt              扩展为完整 agent 导航（数据 URL、口径、更新频率）
  badge/<o>/<r>.svg     健康徽章（已有 12-badges，移到 site 下直接可引）
```

- 路由 = 目录 + index.html，Pages 原生支持，无 SPA、无 JS 路由。
- 信件页是**最大的页面数来源**，也是 SEO/分享入口：每页带 OG meta（标题含插件名+等级），作者愿意转发自己的信。
- 现有仪表盘保持自包含单文件；多页部分共享一个 20 行的 `page()` 模板函数（同款 header/footer/nav），不抽框架。

### 4.3 内容管线节奏（CI 编排）

```
refresh.yml   每日 03:00   light refresh（现状）
              每周五       + content/weekly 周报生成 + feed.xml 重建 + commit
              手动 full     全量
信件          不每信每天重生：仅当 enrich 分数/等级变化才重写对应 md（diff 驱动），
              避免 2113 个文件无意义 churn。
```

### 4.4 collect/dynamics 官方动态快照器（M2）

数据源全部低成本（每次运行 <10 个 API 调用）：

| 信号 | 来源 | 字段 |
|---|---|---|
| 官方 release/rc | GitHub `repos/deepseek-ai/DeepSeek-Harness/releases` | tag、prerelease 标记、发布时间、body 里的 breaking 关键词 |
| 官方包 | npm `@deepseek-ai/*` dist-tags | latest/rc 版本与时间 |
| 官方活跃度 | repo pushed_at、docs 目录最近 commit 数 | 节奏信号 |

产出 `data/dynamics/dsh-YYYY-Www.json` 时间序列（append-only，周粒度），供站点 `/dynamics` 与周报官方小节消费。

### 4.5 rc 兼容雷达（M2，分两阶段）

- **前置（M1 末）**：扩 `02-validate` 采集契约字段——`package.json` 的 `engines.dsh` / `peerDependencies` / `dsh.bundle.target`（存在什么收什么，先入 `eval.contract`）。**先普查才知道有多少插件声明版本**——若声明率 <10%，雷达 v0 的"声明对比"路线不成立，直接进入 v1。
- **雷达 v0**：声明版本 vs 最新 rc → 预警清单（受影响/需验证）。前提：声明率足够。
- **雷达 v1（更可能的主线）**：不从声明入手，从**代码面**入手——06-deep 克隆时记录插件 import 的 dsh API 符号；官方 rc changelog 提取变更符号；交集即预警。这是真正的差异化能力，但成本在深检覆盖率。

### 4.6 数据契约与口径治理

- `insights.json` 等对外 JSON 增加 `schemaVersion` 与 `rulesVersion` 字段；口径变更 bump + 写 `docs/CHANGELOG-rules.md`（ROADMAP 已要求，落到文件）。
- 稳定 URL 契约：一旦公布，`/data/*.json` 与 `/feed.xml` 路径永不变更（redirect 也不优雅——agent 不会跟）。
- i18n 检测器（M1 项）：并入 03-analyze，输出 `langs[]` 进 enrich，站点加 i18n 维度展示。

### 4.7 域名接入清单（M1 收口）

Pages 自定义域 + CNAME（apex + www）→ 强制 HTTPS → 旧 github.io 仓库首页替换为 301/meta refresh → 站点 OG/favicon → `llms.txt` 与 README 内 URL 全部切到 dsh-insights.com。

## 5. 修订后的执行顺序（与 ROADMAP 的差异）

ROADMAP 的 M1–M4 框架不动，调整的是**M1 内部排序**与 M2/M3 的两个取舍：

```
M1 收口（9月）   ① 站点 v2 多页化（含 feed.xml）   ← 新增，最先做，地基
                ② 域名接入清单
                ③ 信件全量生成 + /p/ 路由（依赖①）
                ④ 周报第 1 期 + RSS 订阅上线
                ⑤ 契约字段采集扩展（为雷达铺路） ← 从 M2 提前
                ⑥ 外发 SOP（LINUX DO / Discussions）
M2（10月）      collect/dynamics + 双栏周报 + 雷达 v0/v1（视声明率定路线）+ /dynamics 页
M3（10-11月）   采纳推进（sidecar/门槛 pitch）+ 徽章 ≥5 + 人工点评 Top20-50
                —— 月报降级为季度汇编，等周报跑稳 4 期再做
M4（11月+）     go/pivot/kill + 托管决策（维持现触发器）
```

调整理由：
- **站点多页化是 M1 一切内容产品的前提**（信件路由、周报存档、feed 都挂在上面），ROADMAP 里它是隐含项，这里显式提到最前。
- **契约字段采集提前到 M1 末**：它只是 validate 加几行，但决定 M2 雷达走哪条路线——这是 M2 最大的不确定性，越早消除越好。
- **月报降级**：单人项目，内容产品宁稳勿滥；周报稳定外发 4 期的价值 > 1 期精美月报。

## 6. 风险更新（在 v0.1 §7 基础上）

| 新增风险 | 等级 | 缓解 |
|---|---|---|
| 内容断更（单人运维） | 高 | 机器生成全文 + 人只 review；周报模板化已完成（content/weekly），断更即产品死亡 |
| rc 雷达声明率不足（实测：当前 0 插件有版本契约字段） | 高 | 先普查再定路线；v1 代码面方案兜底 |
| 站点多页化后 CI 构建变慢/产物膨胀 | 中 | 信件 diff 驱动生成；产物大小入 CI 日志监控 |
| 官方动态数据源变动（repo 改名/私有） | 低 | collect/dynamics 失败降级为"本周无数据"，不阻塞管线 |

（v0.1 原有风险——官方下场、评分游戏化、口径质疑等——全部维持，见 git 历史 v0.1。）

## 7. KPI 修订

北极星不变（被生态采纳）。v0.2 增加内容侧指标：

| 指标 | 口径 | M1 目标 | M2 目标 |
|---|---|---|---|
| 周报稳定性 | 连续外发期数 | ≥2 期 | ≥6 期不断更 |
| 信件触达 | 作者回复/issue 反馈数 | ≥1 | ≥5 |
| RSS 订阅 | feed 请求量（Pages 日志不可得，用代理或接受不可测） | 上线即可 | — |
| 站点 | dsh-insights.com 可访问 + 品牌一致 | ✓ | /dynamics 上线 |
| （维持）权威集覆盖、快照滞后 ≤7 天、采纳 ≥1（M3）、徽章 ≥5（M3） | | | |

## 8. 不变的东西

非目标（安装/交易/社区评分/登录产品/舆情抓取）、kill criteria、零依赖约束、中立语气原则——全部维持 v0.1/v0.2 文档口径，不在本次修订范围内。
