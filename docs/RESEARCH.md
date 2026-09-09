# DSH Insights · 生态调研证据库（Research）

> 状态：v0.2 · 2026-09-06 · 证据库与决策日志：VISION/PRODUCT-PLAN 的数据底稿
> 文档地图：[VISION](./VISION.md)（为什么）→ [PRODUCT-PLAN](./PRODUCT-PLAN.md)（做什么/怎么做）→ [PRODUCT-DESIGN](./PRODUCT-DESIGN.md)（页面与指标）→ [ROADMAP](./ROADMAP.md)（什么时候）· RESEARCH（证据）· [SCHEMA](./SCHEMA.md)（数据契约）· [OUTREACH](./OUTREACH.md)（外发）
> 采集于 2026-09-05。所有数字标注 [V] = 本次 GitHub API / npm registry / HTTP 抓取实测；[C] = 策展列表文案等二手但经核。来源 URL 在文末。历史决策日志条目不回写（提及已归档文档处以 git 历史为准）。

## 1. 生态规模

| 口径 | 数值 [V] | 说明 |
|---|---|---|
| GitHub `dsh-plugin` topic | **13,592 仓库** | search API 实测；官方 README 明示打此 topic 即可被发现 |
| 官方权威目录（awesome-dsh-plugin org） | **3,159 条** | plugins.json 实测；最早入库 2026-08-13，目录成立 <4 周 |
| 目录增速 | 2026-08 入库 2,870；2026-09(1–5 日) 289 | ≈58 条/天；峰值期 100–300/天 |
| deepseek1024.com 首页 | 13,399 | 与 topic 数吻合（差 1.4%：去重/归档） |
| DshMarketPlace API | 7,201（verdict 实装 2,426） | README 仍写 3,420，与线上脱节 |
| npm `keywords:dsh-plugin` | 3,805 包 | registry search 实测（fuzzy 偏大） |
| 官方包下载 | `@deepseek-ai/dsh` 月 1,268,577 | api.npmjs.org last-month |
| harness 规模 | deepseek-ai/deepseek-harness ★212,428 / fork 24,937 | push 2026-09-04；"Everything is a Plugin"；MIT；developer preview |

**目录质量分布（3159 条，实测）**：中位 star 3 · 零 star 12% · npm 已发布仅 47%（1,477）· 有截图 542 · 字段无任何质量/评分维度。头部被大仓库子路径污染：archify `integrations/`（46,625★ 无关仓库）、volcengine/OpenViking（35,408★）、Tencent/WeKnora（21,308★）各算一条"插件"。

**官方姿态 [V]**：README 只引导打 `dsh-plugin` topic + Discord；**无官方 marketplace / 目录 / 质量门槛**；docs/cookbook 只讲作者向开发。安装命令面：`dsh plugin add github:|npm:|file:`。

## 2. 现有目录/市场/评估项目全景（找+装已被解决，评估层空缺）

| 项目 | 类型 | 收录量 | 更新 | 质量信号 | 缺口 |
|---|---|---|---|---|---|
| [awesome-dsh-plugin org](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（★14,500） | **策展注册表**+站点+评论 | 3,159（plugins.json 每日 CI） | 日更 [V] | 人工策展、星、截图、统一评论区 | **无任何质量字段/评分**；收录无客观门槛 |
| [dsh-market](https://github.com/dsh-market/dsh-market)（★3,196） | dsh 应用内市场 | 消费 awesome plugins.json | 日更 | 一键安装/更新/诊断/加载顺序/冲突提示；安装源白名单锁 awesome 注册表 | 卡片无质量信号；诊断=装完后的运行时冲突；非预装评分 |
| [DshMarketPlace](https://github.com/DshMarketPlace/dshmarketplace)（★2） | 双语目录+公共 API，宣称实装核验 | API 7,201；verdict 2,426（passed 2,158 / needs-approval 194 / not-a-layer 43 / failed 28 / timeout 1）[V] | 09-01 | **最强验证层**：装得上/装不上裁决 + 风险标记 + 作者溯源 | 判"能否安装"非健康分；覆盖部分；含误报（大仓库子路径）；2★ 冷启动；README 数字脱节 |
| [deepseek1024.com / imsai-sh](https://github.com/imsai-sh/awesome-deepseek-harness-plugins)（★218） | 自动目录+市场站+Store 插件+免费 API | 站 13,399；repo catalog/ 564 条结构化 | 日更 | 安装量榜（匿名上报） | 纯收录+热度；catalog 字段无评分 |
| [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)（★81） | 4h 自动同步目录 | plugins.json 2,119 + 快照 2,000（封顶于 1000/查询） | 日更 | 人工 curated 仅 19 条注记 | 自动层无过滤；人工层过薄；**证明 1000/查询封顶存在** |
| [Anil-matcha/awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin)（★998） | 纯 README 精选 | ~266 条 | 08-25 | 人工入选 | 无数据/分级；创建时间（2023-05）早于官方发布，历史存疑 |
| [Dominic789654/awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)（★221） | 插件+skills+MCP+patch 精选 | 44 整包镜像+多类条目 | 日更 | 人工策展 | 无量化信号 |
| [chnjames/dsh-plugin-market](https://github.com/chnjames/dsh-plugin-market)（★4） | dsh 内市场 Tab+公开站 | registry.json 由 CI 抓 topic+npm keyword | 日更 | 风险标签；**默认"未评估"、自述非审计** | 无评分、无版本更新检测 |
| beancookie 系（★133 + registry ★4）/ oslook（★2，停更且描述拼错）/ zr-promise（★1，纯客户端）/ hackerFish（疑似早期镜像） | 长尾 | — | 部分停更 | — | — |

**桌面壳生态**（市场分发渠道，M4 潜在客户）：[dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop)（预装 dsh-market）、[hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop)（Tauri）、[anywhere-labs](https://github.com/anywhere-labs/deepseek-harness-desktop)（Electron）、RyensX/dsh-app（Tauri 2）。

## 3. 缺口结论

六七个现有项目全部在做：卡片墙自动聚合 / 格式级校验 / 人工"收不收"。**全生态无任何一方提供面向全量插件的客观健康评分**（维护活跃度、可安装性、权限/脚本风险、文档完整度、兼容性的综合量化+分层），也无规则版本、评分历史快照、权威榜单。最接近的 DshMarketPlace 证明了"逐条实装核验"可行，但只判可安装性、覆盖小、含误报。

## 4. 跨生态成败案例要点（同类产品/平台/社区）

| 平台 | 生态 | 结局/现状 | 一句话教训 |
|---|---|---|---|
| OpenAI GPT Store | GPTs | 无审核无策展→上线即垃圾；分成 $0.03/会话、作者月入 $100–500，实质失败 | 无质量信号的开放商店=垃圾场 |
| MCP 生态 | MCP server | 1.2 万+ server、≥33 注册表重叠；自分层：官方注册局（Ed25519、**不做排名**）→ 社区目录 → awesome 精选（punkpeye **94,176★** 实测）→ 商业化平台 | 与 dsh 最像的类比：每层各有生态位；评分层活法=一体化或被消费 |
| Glama.ai / TDQS | MCP | 索引 2.15 万+；**开源可解释质量分** TDQS | 评分须开源、可解释、可复核 |
| Smithery | MCP | **2026-08 被 Arcade 收购**（目录→运行时链路） | 目录是钩子，价值在运行时/交易链路；终局=被平台收编 |
| agent-skills-hub（zhuyansen，★355 [V]） | Agent skills/MCP | "quality scoring + trending + GitHub 自动同步"，2026-09-04 仍推 | **与我们的构想同构**——验证架构可行；跨生态通用层已有人做，**DSH 专属仍空白=窗口** |
| Openbase | npm/开源库 | YC S20、融资 $3.6M，2023-04-24 直接关停（[HN 复盘](https://news.ycombinator.com/item?id=35514261)，非被收购） | "选哪个库"是一次性决策：答完就走，无复访无付费——纯信息层无独立生意 |
| npms.io | npm | 首创 quality/popularity/maintenance 分；索引约 2022/23 停更（实测搜 react 仍 18.2.0），僵尸化 | 方法论被官方借鉴后，独立站无续命理由 |
| Snyk Advisor | npm 等 | snyk.io/advisor 现 301→security.snyk.io（实测） | 健康分是安全平台的功能模块，难独立成站 |
| libraries.io | 跨语言包 | 活着，靠 Tidelift；2025 释出 2500 万 repo 数据集 | 纯数据公益目录靠企业赞助续命 |
| VS Code Marketplace | IDE 扩展 | 官方无评分弱审核→Glassworm 恶意扩展、安装量可刷 | 头部生态也不自动安全；官方不做质量分层→毒瘤自长 |
| Obsidian | 社区插件 | 人工 PR 审核 → 2026-05 起**逐版自动扫描+安全评分卡** | 人工审核到顶后必须自动化分级——官方下场是趋势 |
| WordPress / Firefox AMO / Raycast | 各生态 | WP：审核队+评分运行 15 年；AMO：自动化+抽样+Recommended 徽章；Raycast：强策展质量最高 | 分层策展光谱：纯人工必堵死，纯开放必垃圾化；强策展前提=平台握分发 |
| 商业模式 | 通用 | 公益(sponsor) < SEO-广告(脆弱) < 工具订阅/gateway < **被平台收购/入股**；2026 分水岭=**是否对 AI/agent 爬虫开放** | 给我们的启示：卖"数据+分发底座"给药厂/IDE/平台方比 C 端订阅现实 |

**可复用模式提炼**（做/别做）：别做纯聚合（无质量信号=垃圾场）；健康分必须自动化+可解释+证据可复核；排序要真实采纳数据、**宁缺毋假**（Skillselion 模式：无安装数据就明说按 star 排）；给作者回报（徽章/SEO/反链）并对 agent 开放；绑"运行/管理"场景而非"选型"场景；分层策展；别急着做交易抽成（95% MCP 作者零收入）；商业预期现实（数据底座授权>订阅>广告）。

## 5. 口径与坑（跑批必读）

1. GitHub search 每查询 ≤1000 条 → 全量 13,592 需 **多 qualifier 分片**（Oh-My-DSH 卡在 2,000 即为反例）。
2. 目录 star 失真：monorepo 子路径 / 大项目 integrations 目录被计为插件星。
3. npm 名可被抢注（joejojoking 抢注 dsh-file-explorer 案例）→ npm 一致性检查必要。
4. 官方版本：`@deepseek-ai/dsh` 0.1.2-rc.1，RC 期兼容性断裂是常态（README 明示 developer preview）。
5. DshMarketPlace README 数字（3,420）与线上 API（7,201）脱节 → 引用时以 API/快照为准。
6. 主题皮肤/整活插件是真实存在的合法类别（dsh-ads "是兄弟就来蹬我"、F1 皮肤）→ 噪音分桶要区分"低质"与"非工具类"。

## 6. 决策日志（持续追加）

- 2026-09-05：产品形态定为"质量评估数据层"，沿用 dsh-insights 仓库与命名（用户决策）。
- 2026-09-05：差异化=全量客观健康分+透明规则+快照历史+agent 可读+诚实非审计边界。
- 2026-09-05：O1 数据许可暂定 MIT 同款（→ 2026-09-06 定稿 **CC BY 4.0**，见根 `DATA-LICENSE`）；O3 与 DshMarketPlace 关系待定（记录其 verdict 口径可借鉴）。
- 2026-09-05 [V]：**官方姿态坐实**——deepseek-harness README 无任何市场/目录推荐；根目录无 ROADMAP；docs 树无 marketplace 相关页；CONTRIBUTING 明言"仍早期、暂不接受外部 PR（团队小，仅监控 Discussions）"；插件分发完全外包社区。官方抓手仅：`dsh-plugin` topic 打标 + 作者向文档 + Discussions/Discord。
- 2026-09-05 [V]：**权威列表主动让位**——awesome-dsh-plugin org（★14,501）README 原话 *"This list doesn't rank plugins or judge their quality, and we don't want to."*；其内部最强信号仅是周级 decay 扫描（gone/archived/dormant/unbundled flag）。→ "质量评估层"空缺进一步坐实，且头部玩家不会来抢。
- 2026-09-05 [V]：**全量抓取分片方案验证**——`topic:dsh-plugin` 实时 13,596；按 created 分窗：≤2026-07-31 373 / 2026-08 12,699 / ≥09-01 524；**单日峰值 2026-08-15 = 1,581 > 1000 上限**，需日内时间分片（实测 `created:2026-08-15T00:00:00..2026-08-15T12:00:00` = 868，子日精度可用）。实现：`lib/api.mjs` `ghSearchAll()` 递归 created 窗拆分，叶窗 ≤1000 全取。
- 2026-09-05：**校准集上线**——data/seeds.json 15 条（正例 9：ice5kysl×2 / joejojoking（抢注克隆亦过门禁）/ omdsh / MichengAI / 0xsline / dsh-market / routing-suite / dsh-find-plugin；反例 6：deepseek-harness / open-design / ruflo（no-dsh-bundle）、dsh-find-plugins（no-package.json）、已归档×2）；`npm run regress` 15/15 通过（live validateOne 复验）。
- 2026-09-05：**健康分 health-v1 上线**——11 条纯客观规则、warn−5/fail−20、逐条证据、缺失不扣分、星数不进分；`data/scored.jsonl` + `data/health.json` + `data/insights.json`（agent 契约）+ 站点徽章列 + analyze/report 健康区块 + query CLI 过滤器 + `bin/badge.mjs` 徽章渲染。首个采样：valid 1,244 → A645/B594/C5，平均 87.5。
- 2026-09-05：**采样洞察（生态质量证据）**——70.4% 插件缺 `exports["./client"]`、58.2% 无中文文档、48.6% 未发布 npm（analyze 实测）。
- 2026-09-05：**M2 提案文档 v1 就绪**（docs/M2-INTEGRATION.md）：给 awesome-dsh-plugin org / dsh-market 的集成提案——选项 A 卡片 health 字段/sidecar、选项 B 收录门槛 health≥B；join key=owner/name；边界声明（不排名/非审计/全开源）。待发出与回复记录。
- 2026-09-05 [BUG+修复]：npmDoc 对 scoped 包名双重编码（`encodeURIComponent('%40scope/name')` → 404）——**所有 `@scope/...` 插件被系统性误判 npm.unpublished**（当时 358 行 published 全 false；健康分 npm.unpublished 误扣、compat engines 漏采、官方 @deepseek-ai/dsh 发行轴为空）。修复：`NPM/${name.replace(/^@/,'%40')}`（lib/api.mjs + 11-enrich-compat）。已修行的修正交给 `bin/backfill-npm.mjs`（原子重写 + done.ids 并发守卫，快照时执行）。
- 2026-09-05：**发布全链路就绪**——docs/RELEASE-CHECKLIST.md（Phase 0–5）+ `.github/workflows/pages.yml`（Pages 部署 site+瘦身数据+llms.txt）+ 仓库根 `llms.txt`（agent 落地页）。
- 2026-09-05：**M3 地基**——stages/11-enrich-compat.mjs → `data/compat.json`（npm 已发布插件的 engines.dsh/dsh peers + 官方 dsh 发行轴；启发式兼容信号，非运行测试；repo-only 插件无此信号）。首跑（修复前）646 探测、432 声明 engines/peers。

- 2026-09-05：**M2 提案已发出**——awesome-dsh-plugin org Discussions **#4399**（Ideas 分类，ZH+EN）：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/discussions/4399 · 待回复记录。
- 2026-09-05：**LLM 语义分析上线（D3 首跑）**——llm-tags stage，deepseek-v4-flash（用户 key，经 `export DEEPSEEK_API_KEY` 注入；代码不读 .env，`.env.example` 仅列变量名）。经验：10 行/批 >90s 超时 → 调 4 行/批 + 300s 超时 + 3 分片并行（LLM_SHARDS）；个别行模型漏输出（batch 4 got 3）待补。输出 data/llm.jsonl，不进 health 分数。
- 2026-09-06：**全量审计与修复闭环**——4 路并行审计（数据一致性/管线代码/站点产物/CI 工程）产出 48 项清单（docs/AUDIT-2026-09-06.md），当日全部关闭：去重键统一 full_name 小写 + compaction + 0 重复硬门禁、CI 单 cron + workflow_run 部署接力、首页 XSS 修复、check-docs 文档数字对账脚本。
- 2026-09-06：**健康分 v3→v4 连续升版**——v3 区分度重构（四档扣分 fail−20/major−10/warn−5/minor−2 + 7 条新规则）；v4 新增 S 级（≥95）。分布 @4,160 快照：S 9.2% / A 17.7% / B 66.5% / C 6.6% / D 0.05%。
- 2026-09-06：**内容与站点放量**——信件全量 4,681 封 + /p/ 全量详情页（diff 驱动）；站点改版：汇总门户、仪表盘/插件库分页、周报双栏阅读器（MD/PDF/PNG 导出）、作者协作图 v2、Umami 访问统计。
- 2026-09-06：**改进清单立项**（docs/IMPROVEMENTS-2026-09-06.md）——最高优先：权威集元数据刷新回路（discover 每次全量已拿到新鲜 stars/pushed_at 但被丢弃，活跃度口径随冻结数据衰减）+ history 逐日累积（时间层资产不可回填）；另立评分区分度叙事、信件双语、GraphQL 批量校验等。
- 2026-09-08：**官宣启动（不等周五）**——本仓库 Discussions 开启并发存档帖（[Announcements #1](https://github.com/ice5kysl/dsh-insights/discussions/1)）；**主触达走官方渠道**：deepseek-ai/deepseek-harness Discussions「Show Your Plugins!」[#5933](https://github.com/deepseek-ai/deepseek-harness/discussions/5933)（官方明言仅监控自家 Discussions）；LINUX DO 帖待本人账号发。OUTREACH 升 v0.3：作者自查 CLI 由已废弃的 dsh-plugin-health 全量切换为 `dsh-insights-kit selfcheck`（模板/文档/README/4,681 封信件页脚）；新增启动周作战表（D0–D7）与量化目标（北极星 = 徽章部署仓库数，4 周 ≥25）。三个自家 kit 全部 100 S 并挂新域名徽章；dsh-insights-kit 收入权威集（10,190）。
- 2026-09-08：**版本纪律（用户两次提出「版本涨太快」后钉死）**——kit 系仓库（dsh-insights-kit 等）发版规则：① 先验证后发布，真实 profile 端到端验证必须在 `npm publish` 之前（0.6.0/0.6.1 同日连发即为反例：验证后发现 bundles 形态问题又补一发）；② 每个迭代只发一个版本，修复并入当次迭代不单独发；③ 长期停留 0.x：修复用 patch、成组新能力才用 minor，不追整数关口；④ 站点 changelog 同理按用户口径取低版本号。npm 不允许同版本重发，已发版本不撤销不掩饰，只约束以后。
- 2026-09-09：**版本纪律收紧（同日 0.5.0→0.8.0 五连发，用户再次批评）**——原规则②被「同日连开多个迭代」钻了空子，补死：**同一仓库一天最多发一个版本**，当天的改动合并到一次发布里；增强/打磨已有能力的一律 patch（热挂载之于一键装卸就该是 0.7.1 而非 0.8.0）；minor 仅用于成组新能力且仍需遵守日频次上限；1.0.0 的时机由用户拍板。已发的中间版本（0.6.0/0.7.0）保留不撤销——启动日的试错痕迹也是历史。
- 2026-09-09：**0.1.2-rc.1 事故与「实测兼容」立项**——dsh 升级移除 `@deepseek-ai/dsh-client-runtime`（包整体消失），workspace-kit 陈旧构建仍 require 之 → loader 启动即崩（与安装/卸载操作无关，profile 清单全程完好）。教训沉淀为 kit 两道护栏（b7db50c，随下个 patch 发布）：① `/dsh-insights/compat` 升级预检——比对每个已装插件 client bundle 的外部 require 与磁盘上 shell 的可解析集合（seed 词提取自 shell 资产 `staticModules:fn()` 对象字面量，**14 个已发布 dsh-web-frontend 版本全部验证可提取**；图行 = 有 dsh.client 面的包），体检页红标「无法加载」+ 待重启黄条；② 卸载反向依赖护栏（409 has-dependents）。selfcheck 新增 `compat.missing-seed`（major）供作者构建期自查。**后续立项**：把 seed 表提取 + require 扫描规模化进 pipeline（版本×插件实测兼容矩阵 compat-observed.json），把首页「BREAKING 预警」从变更日志解读升级为机器实测 diff——声明式 engines（184 插件）之外的独家数据资产。
- 2026-09-09：**实测兼容矩阵落地（立项当日闭环）**——`collect/shell-seeds.mjs`（daily）：15 个已发布 dsh-web-frontend 版本 seed 表全部提取成功（0.1.2-rc.1=8 词，0.1.5-alpha.1 多 dockkit=9 词；0.0.1-rc.5 时代还有 ui-attachment/web-react/schema-form 共 10 词，后三个在 0.1.0 周期被移出 seed 表）。`analyze/compat-observed.mjs`（snapshot）：3,567 个已发布包扫描（pkg@version 缓存于 data/state/，并发 8、30s 超时），**2,343 个有 client bundle 进入矩阵，1,222 个无 bundle，2 个失败（均已被作者从 npm 撤包）**。判定轴 = shell distTags latest/next/alpha 去重（0.0.1-rc.5 / 0.1.2-rc.1 / 0.1.5-alpha.1）。结果：**208 个插件在 0.1.2-rc.1 与 0.1.5-alpha.1 下无法加载**——`dsh-client-runtime/client` 独占 159（事故同款，陈旧构建），`util` 等 Node 内置模块 14 个插件（浏览器 shell 本无），10 个插件是多分块构建（相对路径 require，loader 不可解析）；高星 broken：dsh-vision-router（★1,070，ui-attachment）、dsh-dream-skin（★142）、dsh-ego-browser（★98）均为 runtime/ui-attachment。图行近似口径实测影响极小：仅 4 个包名经语料库图行豁免（全部已发布）。详情页 /p/ 新增「实测兼容」区块（逐版本 ✓/✗ + missing 小字 + 口径说明），/data/ 开放两个新数据集。已知边界：0.0.1-rc.5 的 broken 含历史图行误报面（runtime 当时仍在 composition，近似口径不建模内置包——note 已声明）。

## 来源

GitHub：[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) · [topic:dsh-plugin](https://github.com/topics/dsh-plugin) · [awesome-dsh-plugin org](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（[plugins.json](https://awesome-dsh-plugin.com/plugins.json)）· [dsh-market](https://github.com/dsh-market/dsh-market) · [DshMarketPlace](https://github.com/DshMarketPlace/dshmarketplace) · [deepseek1024.com](https://deepseek1024.com/) · [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH) · [agent-skills-hub](https://github.com/zhuyansen/agent-skills-hub) · [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) · [Glama TDQS](https://github.com/glama-ai/tool-definition-quality-score)

网页：[TechCrunch GPT Store](https://techcrunch.com/2024/03/20/openais-chatbot-store-is-filling-up-with-spam/) · [agentmarketcap 2026-04](https://agentmarketcap.ai/blog/2026/04/07/agent-distribution-wars-openai-gpt-store-anthropic-plugins-github-marketplace) · [33 平台田野报告](https://dev.to/studiomeyer_io/mcp-marketplaces-in-april-2026-a-field-report-from-33-platforms-33pn) · [注册表对比](https://dev.to/skillselion/mcp-registries-in-2026-compared-one-is-canonical-one-is-huge-and-almost-none-can-tell-you-what-147l) · [Forbes/Smithery](https://www.forbes.com/sites/janakirammsv/2026/08/10/arcade-acquires-smithery-to-own-the-agent-tool-supply-chain/) · [HN Openbase](https://news.ycombinator.com/item?id=35514261) · [Obsidian 新审核](https://gigazine.net/gsc_news/en/20260513-obsidian-plugin-future) · [ack3 安装量造假](https://ack3.ai/research/do-not-trust-vscode-extension-install-counts/) · [npm downloads](https://api.npmjs.org/downloads/point/last-month/@deepseek-ai/dsh)
- 2026-09-10：**立项方法论——平台吸收风险筛查**：立项评估 @file 提及插件时差点踩坑——官方 8-27 已原生实现 web composer @ 提及（文件搜索/会话引用/目录下钻/面包屑，feature note 状态 implemented、9-04 归档），better-sidebar 也带悬浮 @文件。dsh-at-file 的 1,423/周下载是「原生功能上线前的流量惯性」而非活需求。**教训：npm 下载量是滞后指标，选品必须叠加「官方 repo 的 .agents/notes 特性笔记 + 原生功能覆盖」审查**。风险分层：composer 增强（极高，刚被吃掉）> 侧栏底座（高）> 会话管理（中高）> 外部服务集成（低）> 领域应用（极低）。
