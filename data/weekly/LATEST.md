# DSH 插件生态周报 · 2026-W37（2026/09/07～2026/09/13）

> 数据快照 2026-09-14 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

**新作者带来高星冲击**：Minglink/dsh-infinite-gen-4 首周 1419 星、LiPu-jpg/Openwrite 718 星，说明新面孔用单点创意就能冲上新增榜前列。
**头部未发布项目仍是入口**：zhu1090093659/dsh-web 从 6887 涨到 7512，但 published=false，流量可能沉淀在仓库而非可安装分发。
**市场型插件统治下载**：dsh-market/dsh-market 周下载 86927，且 dsh-market-desktop 同为 86927，用户更依赖市场入口来发现和安装插件。
**崩溃集中在模块缺失**：crashTop 中 dsh-workspace-kit 因 module-missing 记 1 次，@wishp3/dsh-cite、dsh-token-usage 也在列，依赖声明与打包仍是短板。
**模型适配变更拉高风险**：dsh-v0.1.5-rc.1 已标 breaking，并新增 DeepSeek-V41-Flash（deepseek-flash）支持，依赖旧适配逻辑的插件需先兼容再跟进。
本周基调：新增热度压过存量维护，但分发、崩溃与版本适配是下一周必须补的三块短板。

## 本周洞察

- breaking 集中在 dsh-v0.1.5-rc.1、alpha.2、alpha.1：rc.1 新增 DeepSeek-V41-Flash（deepseek-flash）适配，alpha.1 要求模型显式声明支持动态系统提示词；对生态意味着模型适配和 KV Cache 行为正成为插件兼容性的硬门槛。
- gems 中 omdsh-dev/DSH-better-sidebar 与 RevolutionLA/dsh-dream-skin 都是 100 分，且前者周下载 73829；这说明侧栏/工作区与用量监控类插件即使 stars 为 0，也能靠质量分和下载证明真实需求。
- crashTop 三项全是 module-missing，dsh-workspace-kit 记 1 次，@wishp3/dsh-cite、dsh-token-usage 也在列；插件崩溃更多来自依赖未随包发布或环境缺模块，而不是复杂逻辑本身。
- risers 里 antibrow/dsh-antibrow 从 7 到 225、YuJunZhiXue/dsh-purge 从 347 到 773，相对增速远高于 zhu1090093659/dsh-web 的 6887→7512；小众工具一旦命中清理/去重刚需，单周爆发力可超过头部存量项目。

## 行动建议

- **给插件用户**：升级 dsh-v0.1.5-rc.1（breaking）前先隔离或备份依赖旧 DeepSeek 适配器的插件，确认 DeepSeek-V41-Flash（deepseek-flash）和动态系统提示词声明后再推进。
- **给插件用户**：需要市场入口或侧栏增强时，优先试用 dsh-market/dsh-market（周下载 86927）和 omdsh-dev/DSH-better-sidebar（周下载 73829、gem 100 分），并留意 dsh-auto-continue、dsh-chat-import 等会话管理高分替代。
- **给插件作者**：未发 npm 的高星项目应尽快补充分发：Minglink/dsh-infinite-gen-4 已有 1419 星但 npm=false，398894496-arch/DSH-KRouter 39 星也未发布，否则热度难转化为可安装用户。
- **给插件作者**：发布前重点排查 module-missing：dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 都在 crashTop，建议声明 engines.dsh 并补齐依赖；差异化可参考 gems 中 dsh-cost-meter、dsh-chat-import、dsh-auto-continue 的会话管理方向。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **11023** 个（通过 dsh.bundle manifest 校验；另有 4152 个被拒/噪声分桶）
- 近 7 天活跃 24.6%（30 天 100%）· 可过收录门禁（仓库≥1天）95.3%
- npm 发布率 41.9%（已发布 4624 / 版本滞后 1313）
- 中英/双语文档率 47.7% · 平均质量分 76.1（S+A 10.2%）
- curated 收录覆盖 9.3%（1025 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 1278991
- LLM 能力标注进度：1823/11023

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★222,627 · 最近 push 2026-09-11
- npm dist-tags：alpha=0.1.5-alpha.2 · next=0.1.5-rc.2 · latest=0.1.5-rc.1
- 最新 release：dsh-v0.1.5-rc.2（pre-release · 2026-09-10）
- 最近 8 个 release 中 6 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.1.5-rc.1；已探测 3839 个 npm 插件，仅 88 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,438 · v1.0.0；DeepSeek-R1 ★91,989 · v1.0.0；awesome-deepseek-integration ★39,097；DeepSeek-Coder ★24,258；DeepSeek-OCR ★23,881；Janus ★17,764；FlashMLA ★12,915；3FS ★10,196
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| zhu1090093659/dsh-web | 7512 | — | ✓ |
| yjh051108/dsh-routing-suite | 7177 | — | ✓ |
| liustack/modlens | 3963 | — | ✓ |
| dsh-market/dsh-market | 3821 | ✓ | ✓ |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 2297 | ✓ | ✓ |
| Minglink/dsh-infinite-gen-4 | 1419 | — | ✓ |
| superdesigndev/treg | 1394 | — | — |
| bowenliang123/dsh-context | 1369 | ✓ | ✓ |

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

- 质量两级分化仍在：A 级 852 个 vs D 级 1268 个（C 级是主体 3329），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（4097 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 29 个插件没有 README、6399 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1025/11023），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 834 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- TsFreddie/dsh-compaction-instant（A，★14，周下载 217）
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

- 当前权威插件：**11023**（基线 10189 · 2026-09-07）
- 新增 834 · 消失 0

### 新增（Top 15，按 ★）
- Minglink/dsh-infinite-gen-4 ★1419
- LiPu-jpg/Openwrite ★718 (npm ✓)
- a1exsun/dsh-council ★72 (npm ✓)
- 398894496-arch/DSH-KRouter ★39
- FylarOpen/dsh-fylar-office-editor ★34 (npm ✓)
- robiteame/dsh-session-tree-extension ★21
- sz1698/dsh-bg-new ★20
- Kr-ATG/dsh-webui ★17
- a86582751/dsh-nexttavern ★17
- cv-superding/dsh-deepseek-web-login ★14
- Zoria-Lind/dsh-token-optimizer ★12 (npm ✓)
- Coco-king/dsh-x-opencode-session ★8
- youqu68/dsh-delete-chat ★8 (npm ✓)
- yunuo110/dsh-gitbash ★8
- 133563825as-ai/dsh-api-dashboard ★8 (npm ✓)

### star 涨幅榜（同基线）
- zhu1090093659/dsh-web：6887 → 7512（+625）
- dsh-market/dsh-market：3196 → 3821（+625）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：1727 → 2297（+570）
- YuJunZhiXue/dsh-purge：347 → 773（+426）
- antibrow/dsh-antibrow：7 → 225（+218）
- superdesigndev/treg：1190 → 1394（+204）
- d-dev0101/open-sea-skin：196 → 374（+178）
- xmanrui/dsh-im：1110 → 1287（+177）
- SeaOf0/dsh-redteam-model：250 → 427（+177）
- shaobeichen/dsh-pocket：952 → 1108（+156）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
