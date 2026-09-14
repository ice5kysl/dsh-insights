# DSH 插件生态周报 · 2026-W37（2026/09/07～2026/09/13）

> 数据快照 2026-09-14 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **头部增量偏展示** Minglink/dsh-infinite-gen-4 以 1494 stars 进入 addedTop 却 npm=false，说明本周新增热度仍集中在展示型/入口型项目，用户要区分 star 与可安装性。
- **清理工具在回温** risers 中 YuJunZhiXue/dsh-purge 从 347 到 883、antibrow/dsh-antibrow 从 7 到 288，说明轻量清理/隔离类插件正在被重新发现，长尾仍有爆发空间。
- **市场入口成枢纽** dsh-market/dsh-market 从 3196 到 3898，且 downloadsTop 周下载 86927，dsh-market-desktop 同为 86927，说明市场与桌面入口正在承担分发中枢角色。
- **1.5 线快速收敛** dsh-v0.1.5-rc.1 与 alpha.2 标 breaking，rc.2 已取消 breaking，说明 1.5 系列在 RC 阶段快速收敛，升级节奏应围绕 RC 验证而非 alpha 抢跑。
- **满分插件被低估** gems 中 DSH-better-sidebar、dsh-dream-skin 均 score 100 但 stars 为 0，dsh-chat-import 为 98，说明发现机制仍滞后于质量评分。
本周基调：本周新增冲高与安装转化之间仍有落差，生态热度先于可用性兑现。

## 本周洞察

- dsh-v0.1.5-rc.1 与 dsh-v0.1.5-alpha.2 均标 breaking，而 rc.2 改为非 breaking，说明 1.5 线的接口波动集中在早期 RC；插件作者应优先验证 DeepSeek-V41-Flash 适配和 Sidebar 预览相关改动，避免正式版前被动跟改。
- gems 中 omdsh-dev/DSH-better-sidebar 与 RevolutionLA/dsh-dream-skin 均 score 100 但 stars 为 0，Nwflower/dsh-chat-import 为 98，说明高质量插件与 star 热度脱节；用户按功能评分筛选比只看 star 更能找到可用工具。
- crashTop 里 dsh-workspace-kit 以 module-missing 居首（count 1），@wishp3/dsh-cite 与 dsh-token-usage 仅以 count 0 被记录，说明模块缺失样本虽少却最值得优先修复；相关插件发布前应补齐依赖声明。
- newAuthors 中 Minglink/dsh-infinite-gen-4 获 1494 stars 但 npm=false，LiPu-jpg/Openwrite 获 723 stars 且 npm=true；risers 里 antibrow/dsh-antibrow 从 7 到 288、YuJunZhiXue/dsh-purge 从 347 到 883，说明新爆点同时来自新作者与长尾工具，高 star 不等于可安装。

## 行动建议

- **给插件用户**：面对 dsh-v0.1.5-rc.1/alpha.2 的 breaking，先不要直接在生产环境升级；可优先留在 dsh-v0.1.5-rc.2 或等正式版，并逐项验证 Sidebar 预览、DeepSeek-V41-Flash 相关插件。
- **给插件用户**：找替代工具时优先看 gems 高分项：omdsh-dev/DSH-better-sidebar、Han-1413141/dsh-cost-meter、Nwflower/dsh-chat-import、HsiangNianian/dsh-auto-continue，而不是只按 stars 排序。
- **给插件作者**：未发 npm 的高星项目应尽快发布或给出安装指引，Minglink/dsh-infinite-gen-4（1494 stars、npm=false）是本周最明显的安装转化缺口；同时补齐依赖/兼容声明，避免像 dsh-workspace-kit 的 module-missing 进入 crashTop。
- **给插件作者**：参考 gems 的差异化方向：侧栏/工作区的 DSH-better-sidebar、会话管理的 dsh-cost-meter/dsh-chat-import/dsh-auto-continue 均获 95+ 分，新作者可避开通用市场头部，切入这些垂直场景。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **11191** 个（通过 dsh.bundle manifest 校验；另有 4206 个被拒/噪声分桶）
- 近 7 天活跃 24.8%（30 天 100%）· 可过收录门禁（仓库≥1天）94.4%
- npm 发布率 41.8%（已发布 4675 / 版本滞后 1333）
- 中英/双语文档率 47.6% · 平均质量分 76.1（S+A 10.1%）
- curated 收录覆盖 9.2%（1033 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 1286323
- LLM 能力标注进度：1823/11191

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★223,939 · 最近 push 2026-09-11
- npm dist-tags：alpha=0.1.5-alpha.2 · next=0.1.5-rc.2 · latest=0.1.5-rc.1
- 最新 release：dsh-v0.1.5-rc.2（pre-release · 2026-09-10）
- 最近 8 个 release 中 6 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.1.5-rc.1；已探测 3867 个 npm 插件，仅 90 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,447 · v1.0.0；DeepSeek-R1 ★91,991 · v1.0.0；awesome-deepseek-integration ★39,115；DeepSeek-Coder ★24,263；DeepSeek-OCR ★23,887；Janus ★17,762；FlashMLA ★12,917；3FS ★10,198
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| zhu1090093659/dsh-web | 7564 | — | ✓ |
| yjh051108/dsh-routing-suite | 7182 | — | ✓ |
| liustack/modlens | 3960 | — | ✓ |
| dsh-market/dsh-market | 3898 | ✓ | ✓ |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 2357 | ✓ | ✓ |
| Minglink/dsh-infinite-gen-4 | 1494 | — | ✓ |
| superdesigndev/treg | 1403 | — | — |
| bowenliang123/dsh-context | 1380 | ✓ | ✓ |

### 周下载 Top 10（已发布样本）

- dsh-market/dsh-market：**86927**/周
- KokuYu-sysu/dsh-market-desktop：**86927**/周
- omdsh-dev/DSH-better-sidebar：**73829**/周
- Nicercz007-cloud/schedule：**36595**/周
- biyuhao/dsh-model-proxy：**27145**/周
- bowenliang123/dsh-context：**25269**/周
- jkStars/dsh-token-usage-stats：**23578**/周
- meyaomiao/dsh-server-deck：**19711**/周
- dream-num/dsh-univer-office：**18211**/周
- Han-1413141/dsh-cost-meter：**17298**/周

### npm 版本滞后（仓库领先于发布）Top 5

- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3
- zh667/TokenLedger：仓库 0.1.1-blue.0 → npm 0.1.0

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 859 个 vs D 级 1273 个（C 级是主体 3409），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（4145 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 29 个插件没有 README、6516 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1033/11191），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 1002 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- TsFreddie/dsh-compaction-instant（A，★13，周下载 217）
- Simon314620/dsh-turn-index（A，★2，周下载 74）
- DGPisces/dsh-openai-oauth（A，★5，周下载 141）
- hrhgit/dsh-model-manager（A，★0，周下载 182）
- spoon-man569/dsh-token-price（A，★3，周下载 108）
- PaRr0tBoY/dsh-toc-and-rewind（A，★1，周下载 10）
- belowthetree/dsh-mcp-setting（A，★0，周下载 117）
- spacexun2/dsh-worktime-board（A，★6，周下载 197）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-09-07）

- 当前权威插件：**11191**（基线 10189 · 2026-09-07）
- 新增 1002 · 消失 0

### 新增（Top 15，按 ★）
- Minglink/dsh-infinite-gen-4 ★1494
- LiPu-jpg/Openwrite ★723 (npm ✓)
- a1exsun/dsh-council ★88 (npm ✓)
- FylarOpen/dsh-fylar-office-editor ★47 (npm ✓)
- 398894496-arch/DSH-KRouter ★39
- axelfreeman/marketing-mindset ★32
- a86582751/dsh-nexttavern ★25
- cv-superding/dsh-deepseek-web-login ★22
- youqu68/dsh-delete-chat ★20 (npm ✓)
- robiteame/dsh-session-tree-extension ★20
- sz1698/dsh-bg-new ★20
- Kr-ATG/dsh-webui ★17
- startnewlabs/dsh-history ★15 (npm ✓)
- rootkiller6788/dsh-flow ★14 (npm ✓)
- Zoria-Lind/dsh-token-optimizer ★12 (npm ✓)

### star 涨幅榜（同基线）
- dsh-market/dsh-market：3196 → 3898（+702）
- zhu1090093659/dsh-web：6887 → 7564（+677）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：1727 → 2357（+630）
- YuJunZhiXue/dsh-purge：347 → 883（+536）
- antibrow/dsh-antibrow：7 → 288（+281）
- superdesigndev/treg：1190 → 1403（+213）
- xmanrui/dsh-im：1110 → 1309（+199）
- SeaOf0/dsh-redteam-model：250 → 443（+193）
- d-dev0101/open-sea-skin：196 → 377（+181）
- shaobeichen/dsh-pocket：952 → 1125（+173）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
