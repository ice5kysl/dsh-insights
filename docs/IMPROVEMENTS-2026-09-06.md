# 优化与改进清单（2026-09-06 · 产品/平台视角）

> **用途**：与 `AUDIT-2026-09-06.md`（bug 修复）配套的**改进与优化**清单，供开发 Agent 逐项对照执行。每项含「现状证据 / 改进方案 / 验收标准 / 成本」。
> **与审计文档的区别**：审计文档修的是「错的」，本文档做的是「更好的」——数据新鲜度架构、站点体验、评分区分度、国际化触达、平台扩展性。
> **基线（2026-09-06 下午实测）**：权威集 7,774+（持续增长中，以命令重验为准）· /p/ 页 4,681 · 站点全量 ~145MB · .git 57MB（2 天）· 增长曲线：8 月爆发贡献 ~90% 存量，当前回落至 ~700-800 新候选/周。

## 开发 Agent 使用约定

同 `AUDIT-2026-09-06.md`：勾选状态、验收必须实际执行、不顺手重构、改前确认 git 基线。执行批次见文末。

---

## 核心发现（先读）

1. **【架构级·最高优先】权威集「写一次永不刷新」**：候选进 `done.ids` 后永不重验，`stars/pushed_at/npm` 冻结在首次校验时刻 → 活跃度/版本滞后/飙升榜等核心卖点数字随时间单调失真。而刷新所需元数据 discover 每次全量爬取**已经免费拿到但被丢弃**（§A）。
2. **【时间敏感】9/11（周五）信件全量重写炸弹**：信件嵌当天日期 → diff 驱动失效 → 全量 /p/ 页 100% 重写，~148MB churn（§A6）。
3. **【产品叙事】评分区分度不足**：B 档独占 66.5%，C+D 仅 6.6%，D 全库 2 个——「收录门槛 health ≥ B」会放行 93.4%，作为门没有筛选力（§C）。
4. **【触达断层】信件只有中文**：生态 npm 发布率 ~48%、英文 README 作者比例高，中文信到国际作者手里断触达；而语言检测管线已有（§D）。
5. **【站点体验】10MB 死数据 + SEO 地基缺失 + 若干导航断头路**（§B，多为半天级 quick win）。

---

# A. 数据新鲜度架构（最高优先）

## A1 刷新回路 Tier 0：discover 元数据合并回权威集

- [x] **状态**：已完成 2026-09-06 · pipeline/collect/refresh.mjs（挂入 friday：discover → refresh → analyze），并发守卫 + 原子写；副本实测 9,101/9,141 匹配、537 行焕新、40 改名待 Tier 2

**现状证据**：`pipeline/validate/validate.mjs` 主循环只处理 `!done.has(id)` 的候选，已有插件永不重验；`pipeline/analyze/analyze.mjs:205` 的 active7/active30 用**冻结的** `pushed_at` 对当前时间比较——「近 7 天活跃」从 sweep 结束日起衰减，与生态真实活跃无关。`discover.mjs` 分窗全量爬取带回全量候选的新鲜 `stars/pushed_at/topics/archived`（写入 candidates-all.jsonl），**但没有任何步骤把它合并回 plugins.jsonl**。

**改进方案**：新增 `pipeline/collect/refresh.mjs`（进 weekly profile）：读 candidates-all.jsonl 与 plugins.jsonl，按 full_name 小写连接，把 `stars/pushed_at/topics/archived` 合并回权威集行（checkedAt 不动，另记 `metaRefreshedAt`）。零额外 API 成本（search 配额独立，discover 本来就要跑）。

**验收标准**：跑一次后抽样 10 个插件，`stars/pushed_at` 与 GitHub 当前值一致；`analysis.json` 的 active7 恢复为基于新鲜 pushed_at 的真实值。

## A2 刷新回路 Tier 1：npm 信号周期重拉

- [ ] **状态**：未开始 · **成本**：小-中

**现状证据**：`npm.published/version/latest` 冻结在校验时刻；`validateOne` 内 npmDoc **失败还会被永久冻结成 `published:false`**（瞬时故障变永久假数据，且 npm-unpublished 按 major 档扣分——一次网络抖动扣 10 分）。已发布插件约 42%（3,000+ 个）。

**改进方案**：对 `pkgName` 非空的插件每周重拉 npmDoc（npm 域不占 GitHub 配额，~3-5k 调用/周，真并发几分钟）；失败保留旧值不覆盖。

**验收标准**：人为断网一次 npm 重拉，`published:true` 的插件不被翻成 false；正常跑后 version-drift 榜与 npm registry 一致。

## A3 刷新回路 Tier 2：pushed_at 脏标记增量重验

- [ ] **状态**：未开始 · **成本**：中

**现状证据**：manifest/tree/patch 等结构信号只在首次校验时取过；全量重扫 30k 候选需 90-150k core 调用（Actions token 1000/hr 下彻底不可行）。

**改进方案**：用 Tier 0 合并回来的新鲜 `pushed_at` 做脏标记——只对 `pushed_at > 上次结构校验时间` 的插件重验 tree+package.json+patch（~3 调用/个）。按当前活跃度 ~300-600 个/周 ≈ 1-2k core 调用/周，CI 预算内。**不要轮询，用 search 免费携带的信号驱动**。

**验收标准**：本周有 push 的插件（抽样 10 个）结构信号 `checkedAt` 更新；无 push 的不动；周 core 调用消耗 <2,500。

## A4 history 时间序列：进 daily + 分月分文件

- [ ] **状态**：未开始 · **成本**：小

**现状证据**：`history.mjs` 只在 snapshot/full 序里，daily 不跑——「时间层护城河」（文档自述核心资产）实际采样率 = 手动 full 的频率（当前仅 2 条）。且单 JSON 全量重写，按 7.7k 插件/条外推 12 个月 ≈ **170MB 单文件**，最先坏的数据文件。

**改进方案**：history 步骤加进 daily profile；存储改为按月分文件（`data/history/2026-09.ndjson`，逐日 append），聚合在读取时做（analysis 读全部月份合并）。

**验收标准**：连续 3 天 daily 后 history 有 3 条新增；`data/history/` 目录按月滚动；旧 history.json 数据迁移不丢失。

## A5 npm 瞬时失败永久冻结（A2 的校验层修复）

- [ ] **状态**：未开始 · **成本**：小

**位置**：`pipeline/validate/validate.mjs`（validateOne 内 npmDoc 失败路径）

**改进方案**：npmDoc 拉取失败（网络/5xx/429）时该插件标记 `npm:unknown`（不扣分、下轮重试），仅 registry 明确 404 才落 `published:false`。

**验收标准**：模拟 npm 超时的单测/手工用例：结果为 unknown 且不进 done 的 npm 字段终态。

## A6 【9/11 前完成】信件「内容不变则页面不变」

- [x] **状态**：已完成 2026-09-06 · letters.mjs 日期改用 analysis.generatedAt 快照日；两次运行 md5 一致（确定性验证通过），diff 仅随数据变化

**现状证据**：`pipeline/content/letters.mjs:24,114` 信件 FOOTER 与标题嵌**当天日期** → 每周五全量信件内容必变 → `pages.mjs` diff 驱动去重失效 → 全量 /p/ 页 100% 重写。9/11 是信件全量（7,774 封）后的第一次 CI 周跑：预计 ~148MB 工作区写入、~7.7k 文件 commit、.git 单日 +15-40MB、pages artifact ~200MB。

**改进方案**：信件模板中的日期改为「数据快照日期」（enrich 的 generatedAt，数据不变则日期不变）；同理检查 /p/ 页模板中所有 `new Date()` 引用。日期语义从「生成日」改为「数据口径日」，对读者更诚实。

**验收标准**：连续两次不改数据跑 letters+pages，git status 无 /p/ 页变更；只有分数/等级真实变化的插件页面被重写。

---

# B. 站点体验（quick win 为主）

## B1 删除 10.3MB 死数据与死代码

- [x] **状态**：已完成 2026-09-06 · B1 孤儿产物停发+删除、B2 insights 守卫、B4 robots/sitemap(4,695 URL)/twitter:card/canonical、B6 导航+场景链回 /p/ 一并落地

**证据**：`site/plugins-detail.json`（10.08MB）与 `site/plugins-cats.json`（217KB）全站 **0 处引用**——抽屉被 /p/ 页替代后，`site.mjs:703-758` 仍每日生成；dashboard/plugins 页里 drawer/scrim 只剩 CSS 定义无 DOM 使用（`site.mjs:352-387`）。

**方案**：删生成段与死 CSS。部署体积立减 ~10.3MB。（`plugins-cats.json` 若 B9 需要，改为按需重造含分类索引的轻量版。）

## B2 insights.json 纳入混代守卫

- [ ] **证据**：同站实测宣传 7,513/7,824 个插件，insights.json 还是上一代 4,160——新插件徽章 404，「稳定契约」信任风险。`site.mjs:28-36` 已有 plugins vs analysis 守卫但漏了它。

**方案**：`meta.total` 加进守卫；编排上确保 export-json 在 analyze 后必然重跑。

## B3 无信件插件的瘦版 /p/ 页（修 ~3,143 个 404 链接）

- [ ] **证据**：插件表对所有行生成 `/p/<full_name>/` 链接，但 /p/ 页只覆盖有信件的 4,681 个——表尾新插件点了 404。

**方案**：`pages.mjs` 对无信件插件生成瘦版页（复用模板，信件节替换为「信件排队生成中」+ 基础数据卡）；这是全量页数与 SEO 的正向投资。

## B4 SEO 地基：robots.txt + sitemap.xml + twitter:card + canonical

- [ ] **证据**：全站无 robots/sitemap/JSON-LD/twitter:card/canonical；4,681 个长尾详情页（标题模式 `<repo> · 插件详情`，对应真实搜索需求）全靠爬虫自然发现。

**方案**：`pages.mjs` 末尾生成 robots.txt（含 Sitemap 行）与 sitemap.xml（用现成 written 列表 + 快照日期做 lastmod，5 万上限内一文件放得下）；`lib/page.mjs` 的 page() 模板补 twitter:card 与 canonical；/p/ 页加 SoftwareApplication JSON-LD。

## B5 dashboard 去掉重复内嵌的全量表

- [ ] **证据**：`/plugins/`（1.63MB）与 `/dashboard/`（1.66MB）各内嵌同一份 ~1.6MB ROWS——dashboard 由后者字符串切片拼出前者。另 ROWS 的 `r[1]`（html_url）从未被 `draw()` 使用（~350KB 冗余）。

**方案**：dashboard 的 `#browse` 区改为指向 `/plugins/` 的入口卡；ROWS 只内嵌一处并去掉未用字段。dashboard 1.66MB → ~60KB。

## B6 导航断头路：NAV 缺仪表盘 + 场景页外跳

- [ ] **证据**：`lib/page.mjs:85-95` NAV 无 `dashboard/`——4,690+ 个页面顶部到不了仪表盘；场景页每行推荐 `pages.mjs:323` 直跳 GitHub（scenarios.json 的 url 是外链），**所有场景流量送出站**。

**方案**：NAV 插入「仪表盘」；场景行改链 `/p/<full_name>/`（B3 完成后全覆盖），GitHub 作为次链接。场景页从「出口页」变「中转页」。

## B7 无 JS 降级

- [ ] **证据**：`/plugins/`、`/dashboard/` 禁 JS 后表格区空白、hero 计数为 0；`/weekly/index.html` 的列表区是空 div——而每期静态 html 明明存在却无静态链接。

**方案**：weekly index 加 `<noscript>` 期次静态列表；plugins 页加 `<noscript>` 提示 + `/data/plugins.csv` 降级路径。

## B8 authors 页 3.27MB + 移动端溢出

- [ ] **证据**：11 列 × 4,411 行全量表无 `.tbl-wrap` 溢出容器（plugins 页有），`white-space:nowrap` 窄屏撑爆；无搜索。

**方案**：套 overflow 容器（几行 CSS）；加作者搜索框；全量表考虑只渲染 Top 500 + 数据下载入口。

## B9 搜索扩到分类/标签维度

- [ ] **证据**：`filtered()` 只匹配仓库名+描述（`site.mjs:636`）；enrich 有 category、llm.jsonl 有 capabilityTags——「记笔记」这类意图词搜不到。

**方案**：ROWS 增加 category+tags 字段（~40B/行）；toolbar 加分类下拉；搜索范围扩到 tags；场景页加 22 场景锚点 TOC（现在无目录只能滚动找）。

## B10 周报体验补齐

- [ ] **证据**：单期页无 prev/next/存档导航；feed.xml description 只有标题；weekly index 把每期 html+md 双份内嵌（42KB，~15KB/周线性涨，一年 ~800KB）；周报内仓库名是纯文本无链接。

**方案**：期页 footer 加 prev/next/存档；RSS description 取速览前 3 条；index 改按需 fetch 静态 html；md 渲染层把 `owner/repo` 模式自动链接到 /p/。

## B11 订阅与分享路径

- [ ] **证据**：订阅只有 RSS + watch 仓库（`weekly/index.html:98`），插件作者群体大多不用 RSS。

**方案**：周报页加「复制本期链接」按钮；/p/ 页加「本插件评分变化将在周报 Diff 出现」说明 + GitHub watch 深链；邮件订阅（静态 form + 免费服务）视外发策略再定。

## B12 零散体验

- [ ] 分页器加页码跳转/首末页快捷键（66 页只有上下页很痛苦，纯 JS 十几行）
- [ ] /p/ 页加 `npm i <pkg>` 一键复制
- [ ] /data/ 卡片加「更新于 <generatedAt>」+ SCHEMA.md 锚点 + 把 `insights.schema.json` 列为第 12 张卡 + 一行 jq join 示例
- [ ] README Status 段数字改为生成式或去硬编码
- [ ] 删除仓库里的陈旧 `site/llms.txt` 副本（部署时被根版覆盖，留着混淆）
- [ ] /p/ 页 npm 最近发布日期空值兜底（`pages.mjs:221`）

---

# C. 评分区分度（产品叙事问题）

## C1 分布现状（实测）

`score.mjs:177` 绝对阈值 S≥95 / A≥90 / B≥75 / C≥60 → 当前分布：**S 9.2% · A 17.7% · B 66.5% · C 6.6% · D 0.05%（全库 2 个）**。B 档一个 15 分区间吞掉三分之二；「health ≥ B 收录门槛」（ROADMAP M3 pitch）会放行 **93.4%**——门没有筛选力。深层原因：manifest 门禁已在 invalid 分桶那层做掉了重活，权威集是预筛后的集合，天然高分聚集。

## C2 改进项

- [x] **C2-1 对外叙事先改（成本：零）**（已完成 2026-09-06：analyze 新增 gradePctSA，首页/周报/report 全部改 S+A 口径）：首页/周报不再宣传「A+B 84.2%」（读作放水），改宣传「S+A 26.9% 值得优先看」或直接用分位数（「超过同类 88%」——信件里已有这个更诚实的表达，站内推广它）。
- [ ] **C2-2 校准 KPI 化**：把「B 档占比 ≤50%」之类区分度目标写进规则版本的校准标准（与 seeds 回归并列），下次调规则时作为硬约束；或直接抬 B 下限至 80 重划档位（注意 bump ruleVersion + changelog + 历史可比性说明）。
- [ ] **C2-3 D 档处置**：全库 2 个 D 说明底部规则基本不触发（差的都进 invalid 了）。要么合并 C/D 展示，要么把 D 重定义为「危险信号」（写面/消毒红旗），让五档各有语义。

**验收标准**：C2-2 后新分布 B ≤50% 且 S+A ≥25%；周报/首页文案不再出现「A+B」聚合口径。

---

# D. 国际化触达

- [ ] **D1 信件语言自适应（成本：中，杠杆最高）**：信件目前纯中文（样例质量很好：分位数/Top3/收录文案），但英文 README 作者收中文信=断触达。i18n 检测（README 语言足迹）管线已有——按插件主语言选中文/英文模板（英文模板一次性写好，内容同样数据驱动）。ROADMAP M1 的「ja/ko/es 检测扩展」顺带完成。
- [ ] **D2 站点英文骨架（成本：中）**：至少 `/en/` 首页 + about（方法论是公信力实体，策展人/官方可能不懂中文）+ /data/ 三页；/p/ 页 description 本来就是英文原文，模板加英文小节成本低。
- [ ] **D3 周报英文摘要（成本：小）**：每期周报头部加英文 TL;DR（速览数字 + top movers），供外发国际渠道。

**验收标准**：英文 README 的插件收到英文信；/en/about 可访问；周报含英文摘要段。

---

# E. 平台扩展性与观测

## E1 规模算术结论（供规划参考，非立即行动）

- **daily 发布层永远健康**：lists+dynamics+downloads <50 core 调用，10k 权威时依然如此。
- **validate 全量是唯一线性痛点**：30k 候选 ≈ 90-150k core 调用 = Actions token 下 90-150 个 run-day / PAT 18-30 小时。**第二波爆发（8 月证明两周 4x 可能）才是真约束**，不是线性外推。
- **Pages 1GB 发布上限**在 25-35k 页量级成为硬墙；每日 ~300MB artifact 也吃存储配额（90 天 × 300MB ≈ 27GB 滚动）。

## E2 改进项（按杠杆排序）

- [ ] **E2-1 GraphQL 批量校验（成本：中，根治解）**：`lib/api.mjs` 加 `ghGraphql`——一次 query 批量取 100 repo 的 meta+tree+package.json，validate 成本压缩 30-100 倍，「全量重扫」从 20 小时级降回分钟级。A3 落地前这是最好的保险。
- [ ] **E2-2 llm-tags 进 friday（成本：小）**：LLM 覆盖率停在 23%（1,823/7,774）因为不在任何 profile 且无 CI secret。补 repo secret + LLM_MAX=250/周，$1 级成本两周追平存量（模型分级：便宜模型做标签，符合既定纪律）。
- [ ] **E2-3 观测闭环（成本：小）**：①CI 失败自动开 issue（gh api，零依赖）——单人项目「变红才想起来看」是现状；②跨日数据质量门禁：`|Δ权威集|>10%` 报警、连续 3 天 0 新候选报警（discover 腐烂现在不可见）；③**staleness 指标**：checkedAt/metaRefreshedAt 的 p50/p95 进 metrics.jsonl——数据腐烂速度是本项目最该自监测的数字；④配额遥测：各 step 的 API 消耗入日志。
- [ ] **E2-4 CI 卫生（成本：小）**：refresh/pages 的 checkout 加 `fetch-depth: 1`（现在每天为 churn 全额 clone）；full 与 daily 拆两个 workflow（不同 token 节奏，daily 永不被 full 饿死）。
- [ ] **E2-5 数据再分发声明（成本：一句话）**：/data/ 页加「含上游仓库元数据（description 等原创文本），原始内容版权归各自作者」——CC BY 署名对象收敛，防未来纠纷。
- [ ] **E2-6 node:sqlite 触发条件备案（暂不做）**：换 SQLite 的触发条件不是行数，是三件事：①A1-A3 落地后「为改 300 行重写 13MB」成为日常；②月度趋势成为产品功能；③resume 与 CI 出现真实并发写。届时用 `node:sqlite`（Node 22.5+ 内置，**不破坏零依赖叙事**），JSONL 降级为导出契约。按 owner 分片**不建议**（不解决任何痛点，破坏全表扫描简单性）。

---

# F. 与既有规划的关系（避免重复立项）

| 本文档条目 | ROADMAP/TODO 已有规划 | 关系 |
|---|---|---|
| A1-A3 刷新回路 | 无（ROADMAP 未覆盖，**新发现**） | 新立项，建议进 M1 收口后、M2 前 |
| A4 history 进 daily | 无 | 新立项 |
| A6 信件日期冻结 | TODO「diff 驱动更新」隐含 | 落实 TODO 既有意图 |
| B4 SEO | 无（TODO 只到 favicon/OG，已完成） | 新立项 |
| B9 搜索/标签 | PRODUCT-DESIGN §2.1 有「i18n 维度列」 | 扩展 |
| C 评分区分度 | ROADMAP「健康分规则版本化」框架内 | 校准标准的补充 |
| D1/D3 信件双语 | TODO「i18n 检测器」只覆盖检测 | 检测之上的应用，新立项 |
| D2 英文骨架 | 无 | 新立项（建议 M2） |
| E2-1 GraphQL | 无 | 新立项（建议 3 个月盒） |
| E2-2 llm 进 friday | 无 | 新立项 |
| M2 rc 雷达/契约字段普查 | ROADMAP M2 已规划 | 不在本文档范围，维持原计划 |

---

# 建议执行批次

| 批次 | 内容 | 时限/依赖 |
|---|---|---|
| **0 紧急** | A6（信件日期冻结） | **9/11 周五 CI 前必须** |
| **1 止腐** | A1（Tier 0 元数据合并）→ A2 → A3 → A4 | A1 是其余的前置；本周内 |
| **2 站点 quick win** | B1-B7（半天级打包）+ B2 守卫 | 可与批次 1 并行 |
| **3 站点进阶** | B3 瘦版页 + B4 SEO + B8-B12 | 批次 2 后 |
| **4 叙事与触达** | C2-1（零成本改文案）立即；C2-2/C2-3 随下次规则版本；D1 信件双语；D3 周报英文摘要 | C2-2 需 bump ruleVersion |
| **5 平台** | E2-2 + E2-3 + E2-4 | 随时可做 |
| **6 深水区** | E2-1 GraphQL 批量、D2 英文骨架、B9 搜索维度 | 3 个月盒内排期 |

**全局验收**：批次 1 完成后连续观察 2 周——active7 稳定不衰减、周报 movers 榜非恒零、history 逐日增长；批次 2 后 Lighthouse 移动端性能分、部署体积下降 ~12MB；批次 4 后英文插件抽样收到英文信。

---

# 修复日志（开发 Agent 逐条登记）

| 日期 | 条目 | Commit | 验证结果 | 备注 |
|---|---|---|---|---|
| 2026-09-06 | A6 | 待提交 | letters --self 两次 md5 一致；git diff 仅同类分位数据变化 | 9/11 前完成 ✓ |
| 2026-09-06 | A1(Tier0) | 待提交 | 副本实测：匹配 9,101/9,141、更新 537、未匹配 40（改名）；friday --dry 顺序正确 | 首次线上刷新在 9/11 friday CI |
| 2026-09-06 | C2-1 | 待提交 | gradePctSA 入 analysis；grep A+B 显示层清零 | additive，schema 未破坏 |
| 2026-09-06 | B1/B2/B4/B6 | 待提交 | robots.txt+sitemap.xml(4,695 URL) 生成；孤儿文件删除；insights 守卫就位；/p/ 页 canonical+twitter 抽查通过 | |
| 2026-09-06 | 通道 | 待提交 | bin/recheck.mjs 副本实测两插件校验通过；recheck.yml + 2 个 issue 模板 + /p/ 页入口链接 | 零后端平台感三件套 |
| 2026-09-06 | 连带修复 | 待提交 | friday profile pages 顺序纠正（Set 去重导致 pages 在 letters/weekly 之前，内容次日才上线） | 根因是 P1-5 修复不彻底 |
