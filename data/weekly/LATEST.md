# DSH 插件生态周报 · 2026-W36（2026/08/31～2026/09/06）

> 数据快照 2026-09-07 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按（DeepSeek 生成）

- **头部高星仍是未发布**：`yjh051108/dsh-routing-suite`（7080★）与`zhu1090093659/dsh-web`（6887★）均未发布，说明高关注仍押在期待而非可用性上。
- **新增插件星标普遍偏低**：`plolpl789/dsh-raw-html-v2`仅16★便居新增榜首，新入场者需靠更细分的功能切入。
- **市场工具包揽下载前二**：`dsh-market/dsh-market`与`KokuYu-sysu/dsh-market-desktop`同以128104周下载并列，生态基础设施正成为最大流量入口。
- **核心版本连续破坏性更新**：`dsh-v0.1.3-alpha.1`（09-04）与`dsh-v0.1.2-rc.1`（09-03）均标breaking，官方在快速重塑协议但尚不稳定。

本周基调：高关注与正式发布之间存在断层，官方正用破坏性更新试图弥合。

## 本期速览

- 权威插件 **10189** 个（通过 dsh.bundle manifest 校验；另有 3916 个被拒/噪声分桶）
- 近 7 天活跃 24.6%（30 天 100%）· 可过收录门禁（仓库≥1天）99.4%
- npm 发布率 41.9%（已发布 4273 / 版本滞后 1214）
- 中英/双语文档率 48% · 平均质量分 76（S+A 10.2%）
- curated 收录覆盖 9.8%（1000 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 449292
- LLM 能力标注进度：1823/10189

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★213,472 · 最近 push 2026-09-04
- npm dist-tags：latest=0.1.2-rc.1 · alpha=0.1.2-alpha.5 · next=0.1.2-rc.1
- 最新 release：dsh-v0.1.3-alpha.1（pre-release · 2026-09-04 · 含 breaking 说明）
- 最近 8 个 release 中 5 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.1.2-rc.1；已探测 184 个 npm 插件，仅 2 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,436 · v1.0.0；DeepSeek-R1 ★92,019 · v1.0.0；awesome-deepseek-integration ★39,037；DeepSeek-Coder ★24,235；DeepSeek-OCR ★23,870；Janus ★17,764；FlashMLA ★12,901；3FS ★10,185
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| yjh051108/dsh-routing-suite | 7080 | — | ✓ |
| zhu1090093659/dsh-web | 6887 | — | ✓ |
| liustack/modlens | 3868 | — | ✓ |
| omdsh-dev/DSH-better-sidebar | 3339 | ✓ | ✓ |
| dsh-market/dsh-market | 3196 | ✓ | ✓ |
| ccch1mneyyy/dsh-TUI | 2837 | — | ✓ |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 1727 | ✓ | ✓ |
| NanmiCoder/dsh-agent-teams | 1372 | — | ✓ |

### 周下载 Top 10（已发布样本）

- dsh-market/dsh-market：**128104**/周
- KokuYu-sysu/dsh-market-desktop：**128104**/周
- omdsh-dev/DSH-better-sidebar：**97317**/周
- dream-num/dsh-univer-office：**34192**/周
- bowenliang123/dsh-context：**31332**/周
- Han-1413141/dsh-cost-meter：**18196**/周
- Creakono/dsh-cost-meter：**18196**/周
- AnakinCao/dsh-cost-meter：**18196**/周
- ysr666/dsh-vision-router：**13687**/周
- shaobeichen/dsh-pocket：**13036**/周

### npm 版本滞后（仓库领先于发布）Top 5

- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3
- Han-1413141/dsh-cost-meter：仓库 1.7.12 → npm 1.7.10

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 787 个 vs D 级 1249 个（C 级是主体 3030），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（3869 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 27 个插件没有 README、5916 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1000/10189），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 8250 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- TsFreddie/dsh-compaction-instant（A，★14）
- Simon314620/dsh-turn-index（A，★3）
- DGPisces/dsh-openai-oauth（A，★5）
- hrhgit/dsh-model-manager（A，★0）
- spoon-man569/dsh-token-price（A，★3，周下载 174）
- PaRr0tBoY/dsh-toc-and-rewind（A，★1）
- belowthetree/dsh-mcp-setting（A，★0）
- spacexun2/dsh-worktime-board（A，★6）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-09-05）

- 当前权威插件：**10189**（基线 1939 · 2026-09-05）
- 新增 8250 · 消失 0

### 新增（Top 15，按 ★）
- plolpl789/dsh-raw-html-v2 ★16
- abiddotdev/dsh-visualizer ★12 (npm ✓)
- xmanrui/dsh-feishu ★10
- better-er/dsh-tool-autoexpand ★10 (npm ✓)
- shaoshi20/dshscan ★10 (npm ✓)
- Kytolly/dsh-evolve-in-git ★10
- mafeis/dsh-net-proxy ★9
- Victor-770/dsh-commandcode-provider ★9 (npm ✓)
- SherUnlocked-4869/dsh-plugin-msg-nav ★9
- le-soleil-se-couche/dsh-token-cost ★9
- buhuikongpan/dsh-pluginmanager ★9
- warmwine/dsh-ui-font ★9
- huermi/dsh-deepseek-web-adapter ★9
- litestartup-com/dsh-api-gateway ★9 (npm ✓)
- dawnliming/dsh-chinese-mode ★9

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
