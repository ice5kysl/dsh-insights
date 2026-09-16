# DSH 插件生态周报 · 2026-W37（2026/09/07～2026/09/13）

> 数据快照 2026-09-15 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

> ⚠ **口径更正（2026-09-17）**：本期「近 30 天活跃」原报 **100%**，系活跃度指标在首次校验后被冻结、refresh 未重算派生值所致。更正后为 **78.2%**（`activity.dormant` 扣分 2 → 2,206 个）。规则版本升为 health-v6，详见[更新日志](https://dsh-insights.com/changelog/)与 SCHEMA §health changelog。


## 编者按

- **新增量高星未发 npm**：Minglink/dsh-infinite-gen-4 首周 1494 星但 npm=false，说明高热度新插件仍停在仓库分发，会抬高安装与复现门槛。
- **已发 npm 的新作者更稳**：LiPu-jpg/Openwrite 以 724 星、npm=true 进入 addedTop，a1exsun/dsh-council 88 星、FylarOpen/dsh-fylar-office-editor 47 星也均 npm=true，发布到 npm 的新作者更容易形成可复用供给。
- **市场与 Web 双核拉动**：dsh-market/dsh-market 升至 3899 且周下载 86927，zhu1090093659/dsh-web 升至 7564，流量继续向发现与工作台入口集中，插件曝光更依赖这两个入口。
- **会话管理现高分空位**：gems 中 Han-1413141/dsh-cost-meter 95 分、Nwflower/dsh-chat-import 98 分、HsiangNianian/dsh-auto-continue 95 分，均 stars=0，说明低星高质插件正在会话管理细分里补空白。
- **崩溃根因是模块缺失**：crashTop 的 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 均归为 module-missing，说明依赖声明与打包完整性仍是插件可用性短板。
本周基调：增量凶猛，但 npm 分发、依赖完整与入口集中是本周生态的三道关卡。

## 本周洞察

- dsh-v0.1.5-rc.1 新增 DeepSeek-V41-Flash（deepseek-flash）模型适配器，同周 alpha.1 又要求模型显式声明支持动态系统提示词；两条 breaking 叠加说明模型适配与提示词层进入版本敏感期，插件作者需按 rc.1/alpha.2 验证兼容，用户不宜无脑升级。
- gems 中 omdsh-dev/DSH-better-sidebar 与 RevolutionLA/dsh-dream-skin 均拿到 100 分但 stars 为 0，Nwflower/dsh-chat-import 98 分、Han-1413141/dsh-cost-meter 与 HsiangNianian/dsh-auto-continue 各 95 分，且后三者扎堆会话管理；这意味着高分供给尚未转化为可见度，用户可优先用它们补会话与侧栏体验。
- crashTop 三条全部是 module-missing：dsh-workspace-kit 出现 count=1，@wishp3/dsh-cite 与 dsh-token-usage 同因；说明当前崩溃不是复杂运行时，而是依赖/打包声明缺口，作者补齐模块即可显著降低安装失败。
- 新作者 Minglink 的 dsh-infinite-gen-4 首周 1494 星却 npm=false，而 antibrow/dsh-antibrow 从 7 升到 291、YuJunZhiXue/dsh-purge 从 347 升到 883；高星未发 npm 会卡住复现与留存，已发 npm 的新作者更容易把热度转成安装。

## 行动建议

- **给插件用户**：升级 dsh-v0.1.5-rc.1 或 alpha.2 前，先确认现有模型是否支持 deepseek-flash 与动态系统提示词；若未显式声明支持，暂缓升级并保留旧版回退。
- **给插件用户**：优先试装 gems 中 0 星高分的 omdsh-dev/DSH-better-sidebar（100）、Nwflower/dsh-chat-import（98）、Han-1413141/dsh-cost-meter（95）、HsiangNianian/dsh-auto-continue（95）；安装 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 前先检查 module-missing 依赖。
- **给插件作者**：Minglink/dsh-infinite-gen-4 等高星未发 npm 插件应尽快发布，参考 LiPu-jpg/Openwrite（724 星、npm=true）和 a1exsun/dsh-council（88 星、npm=true）的分发路径。
- **给插件作者**：优先补齐 crashTop 暴露的 module-missing 依赖，并参考 gems 的差异化方向：侧栏/工作区、会话管理、状态/监控/用量已有 95–100 分空位，可围绕 DSH-better-sidebar、dsh-cost-meter、dsh-dream-skin、dsh-chat-import、dsh-auto-continue 做同类能力。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **11191** 个（通过 dsh.bundle manifest 校验；另有 4206 个被拒/噪声分桶）
- 近 7 天活跃 24.8%（30 天 100%）· 可过收录门禁（仓库≥1天）94.4%
- npm 发布率 41.8%（已发布 4675 / 版本滞后 1333）
- 中英/双语文档率 47.6% · 平均质量分 76.1（S+A 10.1%）
- curated 收录覆盖 9.2%（1033 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 1286852
- LLM 能力标注进度：1823/11191

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★223,959 · 最近 push 2026-09-11
- npm dist-tags：alpha=0.1.5-alpha.2 · next=0.1.5-rc.2 · latest=0.1.5-rc.1
- 最新 release：dsh-v0.1.5-rc.2（pre-release · 2026-09-10）
- 最近 8 个 release 中 6 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.1.5-rc.1；已探测 3902 个 npm 插件，仅 98 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,448 · v1.0.0；DeepSeek-R1 ★91,991 · v1.0.0；awesome-deepseek-integration ★39,117；DeepSeek-Coder ★24,263；DeepSeek-OCR ★23,887；Janus ★17,762；FlashMLA ★12,918；3FS ★10,198
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| zhu1090093659/dsh-web | 7564 | — | ✓ |
| yjh051108/dsh-routing-suite | 7183 | — | ✓ |
| liustack/modlens | 3960 | — | ✓ |
| dsh-market/dsh-market | 3899 | ✓ | ✓ |
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

- 质量两级分化仍在：A 级 859 个 vs D 级 1274 个（C 级是主体 3408），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（4145 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 29 个插件没有 README、6516 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1033/11191），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 1001 / 消失 0，见文末「本周快照 Diff」。

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

## 本周快照 Diff（基线 2026-09-08）

- 当前权威插件：**11191**（基线 10190 · 2026-09-08）
- 新增 1001 · 消失 0

### 新增（Top 15，按 ★）
- Minglink/dsh-infinite-gen-4 ★1494
- LiPu-jpg/Openwrite ★724 (npm ✓)
- a1exsun/dsh-council ★88 (npm ✓)
- FylarOpen/dsh-fylar-office-editor ★47 (npm ✓)
- 398894496-arch/DSH-KRouter ★39
- axelfreeman/marketing-mindset ★32
- a86582751/dsh-nexttavern ★25
- cv-superding/dsh-deepseek-web-login ★23
- youqu68/dsh-delete-chat ★20 (npm ✓)
- robiteame/dsh-session-tree-extension ★20
- sz1698/dsh-bg-new ★20
- Kr-ATG/dsh-webui ★17
- startnewlabs/dsh-history ★15 (npm ✓)
- rootkiller6788/dsh-flow ★14 (npm ✓)
- Zoria-Lind/dsh-token-optimizer ★12 (npm ✓)

### star 涨幅榜（同基线）
- dsh-market/dsh-market：3196 → 3899（+703）
- zhu1090093659/dsh-web：6887 → 7564（+677）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：1727 → 2357（+630）
- YuJunZhiXue/dsh-purge：347 → 883（+536）
- antibrow/dsh-antibrow：7 → 291（+284）
- superdesigndev/treg：1190 → 1403（+213）
- xmanrui/dsh-im：1110 → 1310（+200）
- SeaOf0/dsh-redteam-model：250 → 444（+194）
- d-dev0101/open-sea-skin：196 → 377（+181）
- shaobeichen/dsh-pocket：952 → 1126（+174）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
