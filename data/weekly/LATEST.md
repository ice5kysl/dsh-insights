# DSH 插件生态周报 · 2026-W36（2026/08/31～2026/09/06）

> 数据快照 2026-09-06 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 本期速览

- 权威插件 **4160** 个（通过 dsh.bundle manifest 校验；另有 2358 个被拒/噪声分桶）
- 近 7 天活跃 27.4%（30 天 100%）· 可过收录门禁（仓库≥1天）99.9%
- npm 发布率 48.8%（已发布 2031 / 版本滞后 562）
- 中英/双语文档率 38.3% · 平均质量分 84.4（A+B 83.8%）
- curated 收录覆盖 23.8%（988 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 417107
- LLM 能力标注进度：1823/4160

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★213,198 · 最近 push 2026-09-04
- npm dist-tags：latest=0.1.2-rc.1 · alpha=0.1.2-alpha.5 · next=0.1.2-rc.1
- 最新 release：dsh-v0.1.3-alpha.1（pre-release · 2026-09-04 · ⚠️ 含 breaking 说明）
- 最近 8 个 release 中 5 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.1.2-rc.1；已探测 184 个 npm 插件，仅 2 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,437 · v1.0.0；DeepSeek-R1 ★92,022 · v1.0.0
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| yjh051108/dsh-routing-suite | 7080 | — | ✅ |
| zhu1090093659/dsh-web | 6887 | — | ✅ |
| liustack/modlens | 3868 | — | ✅ |
| omdsh-dev/DSH-better-sidebar | 3339 | ✅ | ✅ |
| dsh-market/dsh-market | 3196 | ✅ | ✅ |
| ccch1mneyyy/dsh-TUI | 2837 | — | ✅ |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 1727 | ✅ | ✅ |
| NanmiCoder/dsh-agent-teams | 1372 | — | ✅ |

### 周下载 Top 10（已发布样本）

- dsh-market/dsh-market：**128104**/周
- omdsh-dev/DSH-better-sidebar：**97317**/周
- dream-num/dsh-univer-office：**34192**/周
- bowenliang123/dsh-context：**31332**/周
- Han-1413141/dsh-cost-meter：**18196**/周
- Creakono/dsh-cost-meter：**18196**/周
- ysr666/dsh-vision-router：**13687**/周
- shaobeichen/dsh-pocket：**13036**/周
- RevolutionLA/dsh-dream-skin：**9994**/周
- omdsh-dev/dsh-mnemon：**9682**/周

### npm 版本滞后（仓库领先于发布）Top 5

- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3
- Han-1413141/dsh-cost-meter：仓库 1.7.12 → npm 1.7.10

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 730 个 vs D 级 2 个（C 级是主体 293），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（1166 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 17 个插件没有 README、2129 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（988/4160），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 2221 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- spacexun2/dsh-worktime-board（A，★6）
- Ultronen/dsh-liquid-glass（A，★4）
- sfyyy/dsh-vision-bridge（A，★6）
- THEWOLFWALKER/dsh-notifier（A，★87）
- LX2000WASD/dsh-web-plugin-manager（A，★67）
- fandc520/dsh-comfyui（A，★51）
- huaweicloud/huaweicloud-devkit（A，★44）
- WSL043/dsh-codex-subscription（A，★42）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-09-05）

- 当前权威插件：**4160**（基线 1939 · 2026-09-05）
- 新增 2221 · 消失 0

### 新增（Top 15，按 ★）
- xmanrui/dsh-feishu ★10
- better-er/dsh-tool-autoexpand ★10 (npm ✓)
- mafeis/dsh-net-proxy ★9
- Victor-770/dsh-commandcode-provider ★9 (npm ✓)
- SherUnlocked-4869/dsh-plugin-msg-nav ★9
- le-soleil-se-couche/dsh-token-cost ★9
- buhuikongpan/dsh-pluginmanager ★9
- warmwine/dsh-ui-font ★9
- huermi/dsh-deepseek-web-adapter ★9
- litestartup-com/dsh-api-gateway ★9 (npm ✓)
- dawnliming/dsh-chinese-mode ★9
- Yuer6327/NoLetMe ★9 (npm ✓)
- tokentopo-ai/dsh-octo ★8
- v587d/dsh-opencode-go-usage ★8 (npm ✓)
- Yuuz12/dsh-webui-auth ★8 (npm ✓)

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
