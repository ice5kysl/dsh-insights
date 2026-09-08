# 外发与采纳 SOP（Outreach）

> 状态：v0.3 · 2026-09-08 · 对外口径、渠道节奏与采纳推进的唯一操作手册（合并原 PROMOTION.md 与 RELEASE-CHECKLIST.md 残余）
> 文档地图：[VISION](./VISION.md)（为什么）→ [PRODUCT-PLAN](./PRODUCT-PLAN.md)（做什么/怎么做）→ [PRODUCT-DESIGN](./PRODUCT-DESIGN.md)（页面与指标）→ [ROADMAP](./ROADMAP.md)（什么时候）· [RESEARCH](./RESEARCH.md)（证据）· [SCHEMA](./SCHEMA.md)（数据契约）· OUTREACH（外发）
> v0.3 变化：作者自查 CLI 从已废弃的 dsh-plugin-health 切换为 `dsh-insights-kit selfcheck`；数字刷新至 2026-09-08 快照；新增 §五「启动周作战表」（不等周五，立即启动）与 §六「量化目标与度量」。

核心打法（维持）：**先当"生态基建 + 作者钩子"用起来，再争取被权威目录/市场采纳**；不做流量站。内容全部机器生成，人只 review + 外发。

## 一、对外口径（v0.3，别跑偏）

> DSH Insights = DeepSeek Harness 的**生态与动态全景观察站**：全量插件真伪判定 + S–D 健康分（逐条证据、规则公开、非安全审计）+ 官方动态雷达（已上线）+ 生态周报。我们不做目录、不做市场、不做榜单——只提供可引用、可复核的数据与观测。

L1 子口径（面向目录/市场提案时用）：「我们不抢收录权，只提供卡片上那个分数」（详见 [M2-INTEGRATION.md](./M2-INTEGRATION.md)）。

**叙事三件套（帖子/README/演示统一用，2026-09-08 快照口径）**
1. 数据点：`dsh-plugin` topic 宇宙 13.7k、多源候选 14,239、权威集 **10,190**（manifest 门禁逐条校验）、中位 ★3、npm 发布率仅 **41.9%**
2. 证据点（health.json topDeductions，health-v5）：**76.4% 缺 client export**（Web 端装不上）、72% 无 CI、58.1% 未发 npm、51.7% 缺中文文档、48.5% 无测试
3. 反差点：14.5k★ 权威列表明说"不评判质量" → 评估层无人做、我们做且开源；S+A 仅 1,036 个（10.2%），均分 76

**dogfooding 证据（自证可信）**：自家三个插件 dsh-insights-kit / dsh-workspace-kit / dsh-file-explorer-kit 全部 100 分 S 级、徽章挂 README、自检 CLI 进 CI（fail 档退出码 1）。

## 二、三类用户 × 用法

### 1. 插件使用者（安装前决策）
- 站点：https://dsh-insights.com/dashboard/（健康分排序/筛选，点开看扣分明细）
- 插件内：装 `dsh-insights-kit` 后「体检/查验/场景」三个 tab（装前查验可搜关键词）
- CLI：`node bin/query.mjs --grade A --active30 --npm published --search "会话管理"`
- agent：指向 `https://dsh-insights.com/data/insights.json`（稳定 URL，永不变更；另有 llms.txt）
- 心智锚点：S/A/B/C/D + 证据；**信任来自可复核**

### 2. 插件作者（被看见 + 被信任）
- 插件页/信件：`https://dsh-insights.com/p/<owner>/<repo>/`（分数证据 + 扣分明细 + 相似推荐）
- 自查：`npx dsh-insights-kit selfcheck <dir>`（与线上 health-v5 同规则书，fail 档 exit 1 可挂 CI 门禁）
- 徽章：`[![DSH Insights health](https://dsh-insights.com/badge/<owner>/<repo>.svg)](https://dsh-insights.com/p/<owner>/<repo>/)`（/badge/ 页有一键复制）
- 重检：push 修复后到 Actions → recheck 手动触发（单插件分钟级生效，站点自动接力部署）
- 修复路径：发布 npm / 补 `exports["./client"]` / 中英 README / LICENSE / `dsh-plugin` topic / tests/ + CI / 声明 `engines.dsh`

### 3. 策展人与平台（采纳层）
- 提案存档：[M2-INTEGRATION.md](./M2-INTEGRATION.md)（选项 A 卡片 health 字段/sidecar · 选项 B 收录门槛 health≥B）
- 数据源：`data/insights.json`（join key = owner/name；schema 只增不改）· compat.json（兼容声明）
- 平台/desktop 壳（M4）：质量数据底座授权

## 三、渠道 × 时机 × 动作（总表）

| 时机 | 渠道 | 动作 | 状态/成功标准 |
|---|---|---|---|
| 2026-09-05（已做） | awesome-dsh-plugin org Discussions | 发集成提案（ZH/EN） | ✅ 已发 = **#4399**，待回复；W37 帖发出后带新数字跟进 |
| 2026-09-08（已做） | 自荐 3 插件 README | 贴 health badge（新域名） | ✅ insights/workspace/file-explorer 三 kit，均 100 S |
| **本周（启动周，见 §五）** | LINUX DO + Discussions + 作者 issue | 官宣帖 + 首批 10 封信 | 帖子发出 · 信件发出 ≥10 |
| 2026-09-08（已做） | **官方 deepseek-harness Discussions「Show Your Plugins!」** | 生态官宣（作者向：徽章/selfcheck/recheck + 开放数据） | ✅ 已发 = **#5933**；官方仅监控自家 Discussions，这是最直接的官方触达通道 |
| **每周五（周报节奏）** | LINUX DO / GitHub Discussions / 中文 dsh 社区 | 发当期生态周报帖（模板见 §四）+ 站点周报页链接 | 连续外发期数（M2 ≥6，不断更） |
| 全量新快照有亮点时 | deepseek-harness Discord / HN（可选） | "全量客观评分数据集"帖 + query CLI 演示 | 帖子互动 + repo ★ |
| W37 帖发出后 | awesome org / dsh-market 跟进 | 每周数据 URL 更新 + 采纳谈判 | ≥1 家接入（M3 退出标准） |
| 徽章热链稳定后 | 作者圈层 | 推动 Top 插件 README 挂 badge | 部署数见 §六目标 |

**转载许可**：数据与报告按 **CC BY 4.0** 开放引用，署名 dsh-insights.com 即可（见根 `DATA-LICENSE` 与 /data 页声明）。

## 四、周报外发 SOP

1. **生成**：每周五 CI 跑 content/weekly → `data/weekly/YYYY-Www.md` + `LATEST.md` + 站点 `/weekly/` + feed.xml 重建（机器生成全文）。
2. **review**（人，≤15 分钟）：核对数字与 movers 无异常；口径变更必须出现在"口径公告位"。
3. **外发**（人，模板化）：LINUX DO + 本仓库 Discussions 各一帖，结构 = 本周 3 个数字 + 1 个 movers 看点 + 站点/RSS 链接；语气中立（数据说话，不拉踩）。
4. **记录**：外发链接与反馈记 RESEARCH §决策日志；断更即警报（PRODUCT-DESIGN §红线：连续断更 2 期暂停新功能先修管线）。

## 五、启动周作战表（W37 · 2026-09-08 起，不等周五）

> 原则：周一启动用「全量快照 + 四周周报存量」做官宣，周五 W37 新周报做二次触达（同一帖下更新，不另开帖）。人每天投入 ≤40 分钟。

### D0（周二 09-08，今天）
- [ ] **官宣帖发布**（人，30 分钟）：用 [OUTREACH-POSTS-W37.md](./OUTREACH-POSTS-W37.md) 帖 1（LINUX DO）与帖 2（Discussions 中英），占位符按 §四从最新 LATEST.md/health.json 填当前数字（权威集 10,190 · S+A 1,036 · npm 发布率 41.9%）。帖内必带三件套：/p/ 详情页示例（omdsh-dev/DSH-better-sidebar 100 分）、徽章接入一页（/badge/）、`dsh plugin add dsh-insights-kit` 安装指引（/kit/）。
- [ ] **首批作者信 10 封**（人，40 分钟）：按 [OUTREACH-QUEUE.md](./OUTREACH-QUEUE.md) 前 10 位（omdsh-dev、shanliuling、RevolutionLA、pengyue-polaron、SiriLee、SenmuuuuW、Ultronen、Likenttt、lee259、chendefine），到对应仓库开 issue，正文 = `data/reports/<owner>__<repo>.md` 全文（已含新 CLI 页脚），标题「你的插件在 DSH Insights 的评分与改进建议」。发完在队列表勾记。
- [ ] **提案 #4399 预热带数**：暂不回复，等 W37 帖链接出来一起跟（避免刷屏）。

### D1（周三 09-09）
- [ ] 检查官宣帖回复，逐条回应（数据问题引 /about/ 口径，误判引导 issue 申诉 + recheck 自助）。
- [ ] 作者信第 2 批 10 封（队列 11–20）。回复积极的 → 引导挂徽章（/badge/ 一键复制段）。
- [ ] 记录 D0 数据基线：帖子阅读/回复、repo ★、kit npm 日下载（`npm view dsh-insights-kit` + downloads.json 下轮刷新）。

### D2（周四 09-10）
- [ ] 复盘前两批信件回复率；有作者修分上线的，在官宣帖下追一条「作者修复案例」（最有说服力的活广告）。
- [ ] 检查周五 friday profile 的 CI 预检（downloads 降级告警已修，确认周报步骤无隐患）。

### D3（周五 09-11 · 周报日）
- [ ] W37 周报 CI 生成 → review（≤15 分钟）→ 按 §四外发周报帖；**同时在官宣帖下更新 W37 3 个数字**（二次曝光）。
- [ ] 带 W37 数字与官宣帖链接，跟进提案 #4399。
- [ ] 填 §六 度量表第一周实际值。

### D4–D7（周末–下周一）
- [ ] 作者信第 3 批（队列 21–30，若无则按口径再生成 10 位）。
- [ ] 整理「作者修复榜」素材（谁在收到信后修分成功），下周帖用。
- [ ] 下周一（09-14）晚复盘会（人，30 分钟）：对照 §六 目标，填 RESEARCH §决策日志，决定下周渠道增减。

## 六、量化目标与度量

**北极星指标：徽章部署仓库数**（第三方 README 热链 `dsh-insights.com/badge/`）。度量：GitHub 代码搜索 `dsh-insights.com/badge` 的仓库计数，每周五记录。

| 指标 | 基线 09-08 | W37 周末 | +2 周 | +4 周（M2 末） | 度量方式 |
|---|---|---|---|---|---|
| 徽章部署仓库数 | 3（全自家） | ≥5 | ≥10 | ≥25 | GitHub 代码搜索计数 |
| 作者信回复率 | —（未发） | ≥10%（10/20 封有回复） | ≥20% 累计 | ≥30% 累计 | 队列表人工勾记 |
| 官宣+周报帖 | 0 帖 | 2 帖（官宣+W37） | 4 帖 | 6 帖（不断更） | 链接存档 RESEARCH |
| LINUX DO 单帖阅读 | — | ≥300 | ≥500/帖 | ≥800/帖 | 帖子页计数 |
| dsh-insights repo ★ | 0 | ≥10 | ≥30 | ≥60 | gh api |
| dsh-insights-kit npm 周下载 | 未统计 | ≥10 | ≥30 | ≥80 | downloads.json |
| 目录/市场采纳 | #4399 待回复 | 跟进 1 次 | 有实质回复 | ≥1 家接入谈判中 | M2-INTEGRATION 状态 |

**未达处理**：任一指标连续 2 周未达下限 → 当周复盘会砍掉对应渠道动作，投入转到回复率最高的渠道（预计为作者信→徽章链路）；徽章部署 4 周 <10 则回到 ROADMAP 重议 M3 打法。

## 七、使用速查（放 README/帖子附录）

```bash
node bin/query.mjs --search omdsh                                        # 查某个插件
node bin/query.mjs --grade A --npm published --active30 --search file    # 组合筛选
curl https://dsh-insights.com/data/insights.json                         # 全量数据（agent/脚本）
npx dsh-insights-kit selfcheck ./my-plugin                               # 作者自查（health-v5 同规则书）
```

## 八、红线（外发时绝不越界）

- 不宣称"安全审计"（任何文案都带"客观启发式信号"）
- 不排名/不拉踩（给分不给榜，作者可申诉）
- 不贬低其他目录/市场（我们是互补层）
- 数据开放、规则版本化、可回滚（公开透明才有公信力）

## 九、风险与回滚

- CI 刷新踩 search 限额 → BUDGET_FLOOR 已内置（250 余量即停），失败自动下轮补。
- npm downloads API 对共享 CI 出口断供 → 有旧数据兜底时降级为告警不阻塞管线（2026-09-08 已修）。
- Pages 数据文件大（insights/enrich MB 级）→ Pages 只发瘦身数据，完整数据留仓库（pages.yml 已按此配置）。
- 采纳被拒 → 走 RESEARCH 决策日志"替代路径"：独立数据层 + badge 热链 + dsh-market `DSHM_REGISTRY_URL` 镜像。
