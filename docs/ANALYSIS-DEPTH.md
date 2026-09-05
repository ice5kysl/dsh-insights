# 分析深度路线（Analysis Depth Roadmap）

> 2026-09-05 · 目的：把单插件分析从"静态元数据"加深到"事实核验 + 语义理解 + 时间趋势"，并把壁垒从纯信息层移到
> **事实层 / 时间层 / 信任层 / 采纳层 / 分析层**。每项标注：信号、数据来源、壁垒类型、成本、落地阶段。

## A. 已在跑（v1–v2 静态层）
manifest 门禁 · files 存在性 · eval 形态 · npm 一致性 · 仓库卫生 · health-v2(11 规则) · compat engines(部分) · 深检启发式(少量)

## B. 计划中的加深项（含你新提的三类）

| # | 项 | 信号 | 来源/采集 | 壁垒 | 成本 | 阶段 |
|---|---|---|---|---|---|---|
| D1 | 重叠/重复族检测 | patch/能力相似聚类 | manifest+README 词汇 + (后)LLM | 分析层 | 低(先做) | **本周** |
| D2 | OSV 供应链漏洞 | 依赖→已知 CVE 计数 | npm registry deps + osv.dev | 事实层 | 低 | 本周后 |
| D3 | **LLM 语义分析** | 一句话能力摘要、宣称核验点、分类、i18n 质量 | README/描述 采样喂 LLM，**结构化 JSON 回填** | 分析层 | 中(按量计费) | M2 |
| D4 | 实装 smoke 测试 | `dsh plugin add` + boot + console error | CI 沙箱跑真实 harness | **事实层(最硬)** | 高 | M3 |
| D5 | **数据采集与积累** | 每周快照历史→分数趋势 | history.json 每日 append（已开工） | **时间层** | 低 | 进行中 |
| D6 | README 结构质量 | 安装/使用/配置小节、坏链、截图 | 仓库 README 抓取解析 | 信任层 | 低 | M2 |
| D7 | 单插件 dossier 页 | 全部证据+深检+趋势+申诉 | 站点 | 信任层 | 中 | 站点 v2 |
| D8 | **场景推荐** | 常用场景 TopN(健康/兼容过滤+理由) | D3 标签 + D1 分族 + 规则排序 | 分析层→用户价值 | 中 | M2/M3 |

## C. LLM 分析怎么用（克制、可复核、防跑偏）

原则：LLM 只做**人没法机械化、但结果可被人类抽查**的活；输出必须结构化 + 注明"LLM 生成，人工抽查"，**不进 health 分数**（分数只含纯客观信号——这是公信力底线）。

1. **能力摘要与分类**（采样策略）：对权威集分批（每批 ~50）prompt：读 README/描述 → 输出 `{category, capabilityTags[], claimedCommands[], summary_zh, summary_en, claims[]}`。回填 `data/llm.jsonl`。抽查率 ~5%（人工/种子复核）。
2. **宣称核验点**：提取 README 里可验证宣称（"46 tools"、"支持 X 协议"）→ 与 manifest/文件交叉 → 不一致进 `claims.jsonl` 待人工。**别让 LLM 下"好/坏"判断**。
3. **成本控制**：只对 valid 集 + 每轮只跑新增/变更（增量）；prompt 缓存相似 README hash；分级模型（便宜模型做标签，贵模型做摘要）。
4. **i18n/质量子项**：README 缺小节、README 语言、screenshots 有无——这些可以纯规则做（D6），LLM 只兜底。

## D. 数据采集与积累清单（时间壁垒，从今天就攒）

| 存量 | 追加（每周快照自动） | 额外源（低成本） |
|---|---|---|
| data/plugins.jsonl 逐行含 checkedAt | history.json：`{date, total, grades, avg, median, plugins:{full_name:{score,grade}}}`（已开工 D5） | npm downloads（api.npmjs.org 周下载，npm 已发布者） |
| invalid.jsonl 噪音分桶历史 | scored.jsonl / insights.json / compat.json 每次提交 | GitHub 仓库 Discussion 数/issue 响应（可选） |
| site/badge/* 静态历史（git 即有） | 每次 commit 本身 = 全量历史 | README 全文库（后续：只存 hash+解析产物，控制体积） |

规则：快照格式版本化；历史只增不改；git 提交即存档（这是"追不上"的资产，别人今天开始也攒不出 6 个月前的趋势）。

## E. 场景推荐设计（把分数变成"用户能用的答案"）

1. **场景词表 v1**（人工+LLM 反哺）：归档管理 / 文件预览编辑 / 全局搜索 / 记忆 / 多模型路由 / 终端 / 远程手机 / 皮肤主题 / 桌宠 / 语音 / 数据分析 / 网页浏览 / MCP 管理 / 子代理编排 / 用量账单……
2. **每个插件打场景标签**：D3 LLM capabilityTags ∪ D1 词汇桶 ∪ topics 映射。
3. **候选排序公式（透明、可解释，不进分数）**：`场景内按 (health 分, npm published, active30, compat 匹配, stars 仅作展示) 过滤+排序`——理由 = 每条规则证据链。
4. **出口**：站点"场景"Tab（推荐理由可展开）+ `data/scenarios.json`（agent 可读：`问 agent 哪个插件适合 X 场景 → 拿这个文件过滤）→ M2 agent 可读的杀手锏。
5. 边界：推荐 = 客观信号排序 + 理由，**不接"最佳"叙事、不做付费置顶**；每场景给 2–3 个备选而非单点。

## F. 壁垒自检（做完这些后）

- 事实层：D2/D4 —— 抄 D4 需要整套 dsh 沙箱 CI（重投入）
- 时间层：D5 —— 抄历史需要从现在开始等
- 分析层：D1/D3/D8 —— 抄语义管线需要 LLM 预算 + 校准纪律
- 信任层：D6/D7 + 已上线的公开规则/校准/申诉 —— 抄口碑需要时间
- 采纳层：M2（徽章已在两个插件 README 生效；提案 #4399 待回复）

## 执行顺序建议

1. [x] D5 历史初始化（本日首笔）→ 之后每周快照自动 append
2. [ ] D1 重叠族检测（词汇桶 v1，纯规则）
3. [ ] D2 OSV 扫描（health-v3 新增"供应链"维度）
4. [ ] D3 LLM 能力标签（采样 + 结构化回填 + 抽查）
5. [ ] D8 场景推荐（scenarios.json + 站点 Tab + query CLI --scenario）
6. [ ] D6/D7 站点 dossier v2
7. [ ] D4 沙箱 smoke（从 top50 + 自荐开始）
