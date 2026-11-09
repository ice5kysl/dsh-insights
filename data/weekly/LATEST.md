# DSH 插件生态周报 · 2026-W45（2026/11/02～2026/11/08）

> 数据快照 2026-11-09 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **破坏性窗口先修移动端**：dsh-v0.2.2-rc.1（11/04）与 alpha.3（11/03）连续标记 breaking，前者改手机/平板软键盘与窄屏布局，后者改统一右键/键盘菜单；依赖这些交互的插件要先回归，否则升级后窄屏入口和菜单扩展最先失效。
- **新作者靠单点爆款起量**：QingYunA 的 answer-me-with-html 以 6063 stars 进入新增榜且未发 npm，kingcharleslzy-ai 的 dsh-purge 5488 stars 也未发 npm；高星未发布说明首周声量已起来，但安装转化和可复现性还没补齐。
- **发行渠道成为增长杠杆**：c1overzz/dsh-bili-scroll 1333 stars、Alice-Marx/dsh-model-router 930 stars 均已发 npm，而 6shenhonghong9/dsh-startup-screen 798 stars 未发 npm；同批新项目里，能直接安装的版本更容易承接后续迭代。
- **高星流量向入口集中**：Ebony-Vinyl/dsh-our-free-model 从 8876 涨到 66195，dsh-market 从 6169 涨到 11502，T-Auto/dsh-ops 从 371 涨到 5591；增长集中在模型入口、市场入口和运维工具，长尾插件需要更清晰的场景标签才能被看见。
- **零星高分插件值得试用**：SenmuuuuW/dsh-whale-report 以 0 stars 拿到 100 分，DSH-better-sidebar、dsh-agent-teams、dsh-cost-meter、dsh-dream-skin 均为 0 stars/95 分；评分和曝光明显脱节，用户可按侧栏、代理、用量等类别先试用。
本周基调：破坏性版本与高星新项目同时加速，生态进入先修兼容、再抢入口的窗口期。

## 本周洞察

- dsh-v0.2.2-rc.1 与 alpha.3 连续带 breaking，rc.1 专攻手机/平板软键盘与窄屏布局；本周升级风险集中在移动端交互，依赖右键/键盘菜单的插件应优先回归。
- gems 中 SenmuuuuW/dsh-whale-report 以 0 stars 获 100 分，dsh-cost-meter、dsh-agent-teams、DSH-better-sidebar 等 0 stars 项目拿 95 分；评分把低曝光工具提前筛出来，用户不必只盯 stars 榜。
- crashTop 中 dsh-workspace-kit 出现 module-missing（count 1），@wishp3/dsh-cite 与 dsh-token-usage 也有同类别记录；模块缺失集中暴露安装/加载链路的兼容问题，相关插件应检查依赖声明与发布完整性。
- risers 里 Ebony-Vinyl/dsh-our-free-model 从 8876 到 66195、T-Auto/dsh-ops 从 371 到 5591；高增长同时落在模型入口和运维工具上，说明入口型与效率型插件都有单周破圈机会。

## 行动建议

- **给插件用户**：升级 dsh-v0.2.2-rc.1/alpha.3 前，先逐个禁用依赖右键/键盘菜单和移动端窄屏布局的插件做兼容回归，确认没有 module-missing 再恢复组合。
- **给插件用户**：优先试用 gems 中 0 stars 但 95/100 分的 dsh-cost-meter、dsh-agent-teams、dsh-whale-report，按会话成本、代理协作、用量报告场景替代高曝光但未发 npm 的项目。
- **给插件作者**：未发 npm 的 QingYunA/answer-me-with-html、kingcharleslzy-ai/dsh-purge、6shenhonghong9/dsh-startup-screen 应尽快发布并声明 engines.dsh，避免高星只停留在仓库层。
- **给插件作者**：参考 gems 的差异化方向补齐场景标签：dsh-whale-report 做用量报告、dsh-cost-meter 做会话成本、dsh-agent-teams 做代理协作，并针对 dsh-workspace-kit 的 module-missing 检查依赖声明。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **21986** 个（通过 dsh.bundle manifest 校验；另有 6470 个被拒/噪声分桶）
- 近 7 天活跃 16.3%（30 天 48.6%）· 可过收录门禁（仓库≥1天）98%
- npm 发布率 44.1%（已发布 9690 / 版本滞后 5165）
- 中英/双语文档率 48.5% · 平均质量分 74.3（S+A 5.4%）
- curated 收录覆盖 5.2%（1146 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 7764957
- LLM 能力标注进度：1823/21986

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★276,599 · 最近 push 2026-11-04
- npm dist-tags：latest=0.2.2-rc.1 · alpha=0.2.2-alpha.3 · next=0.2.2-rc.1
- 最新 release：dsh-v0.2.2-rc.1（pre-release · 2026-11-04 · 含 breaking 说明）
- 最近 8 个 release 中 4 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.1-rc.5；已探测 6948 个 npm 插件，仅 1262 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,771 · v1.0.0；DeepSeek-R1 ★92,003 · v1.0.0；awesome-deepseek-integration ★39,760；DeepInfer ★25,680；DeepSeek-Coder ★24,360；DeepSeek-OCR ★24,141；dsh-superagent-prototype ★21,256；Janus ★17,763
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| Ebony-Vinyl/dsh-our-free-model | 66195 | ✓ | ✓ |
| YuJunZhiXue/dsh-purge | 15339 | ✓ | ✓ |
| dsh-market/dsh-market | 11502 | ✓ | ✓ |
| zhu1090093659/dsh-web | 10241 | ✓ | ✓ |
| superdesigndev/treg | 7657 | — | — |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 7040 | ✓ | ✓ |
| yjh051108/dsh-routing-suite | 7011 | — | ✓ |
| QingYunA/answer-me-with-html | 6063 | — | ✓ |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**848207**/周
- helloHub1212/dsh-windows-mcp：**714813**/周
- sunyuhuirong/deepseek-account：**559082**/周
- dsh-market/dsh-market：**321443**/周
- yhm0619/dsh-pet-read：**150638**/周
- bowenliang123/dsh-context：**146733**/周
- JHboy203/dsh-plugin-catalog：**105488**/周
- MYCF711/dsh-session-superagent：**95782**/周
- MeteorNOX/DeepSeek-Balance-Whale-Widget：**95521**/周
- omdsh-dev/DSH-better-sidebar：**83586**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- YuJunZhiXue/dsh-purge：仓库 1.3.3 → npm 0.0.0-stage
- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.73.16
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- elysia395/dsh-wallpaper-engine：仓库 0.7.0 → npm 1.4.2
- ranxianglei/billion-context：仓库 0.1.131 → npm 0.1.184
- liustack/modlens：仓库 3.25.4 → npm 3.27.3

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 957 个 vs D 级 2589 个（C 级是主体 7880），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（7444 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 56 个插件没有 README、12296 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1146/21986），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 6469 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- belowthetree/dsh-mcp-setting（A，★0，周下载 239）
- runcat-tommy/dsh-unitverse（A，★0，周下载 296）
- skyyyyyk/dsh-szg-hint（A，★0，周下载 103）
- ai-tool-labs/dsh-squares（A，★1，周下载 78）
- zhz8888/dsh-android-emulator-helper（A，★3，周下载 625）
- zhz8888/dsh-ios-simulator-helper（A，★3，周下载 336）
- GallenShao/dsh-faster-compress（A，★1，周下载 384）
- HildebrandYu/dsh-open-with（A，★0，周下载 173）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-15）

- 当前权威插件：**21986**（基线 15517 · 2026-10-15）
- 新增 6469 · 消失 0

### 新增（Top 15，按 ★）
- QingYunA/answer-me-with-html ★6063
- kingcharleslzy-ai/dsh-purge ★5488
- c1overzz/dsh-bili-scroll ★1333 (npm ✓)
- Ebony-Vinyl/EAC-design-world ★1029 (npm ✓)
- Alice-Marx/dsh-model-router ★930 (npm ✓)
- 6shenhonghong9/dsh-startup-screen ★798
- op7418/dsh-guizang-design ★647 (npm ✓)
- uumit-ai/dsh-uumit-remote ★510 (npm ✓)
- aureth-labs/dsh-aurabot-qq ★501
- woniuniuniu/dsh-media-desk ★500
- SAOS-3624/dsh-see-now ★494 (npm ✓)
- SAOS-3624/dsh-video-storyboard ★476 (npm ✓)
- XDTrees/dsh-xdpool ★468 (npm ✓)
- JeffKeeping/dsh-purge-plus ★466 (npm ✓)
- Yuuyuko-uu/dsh-feiyu-mood ★257

### star 涨幅榜（同基线）
- Ebony-Vinyl/dsh-our-free-model：8876 → 66195（+57319）
- YuJunZhiXue/dsh-purge：4584 → 15339（+10755）
- dsh-market/dsh-market：6169 → 11502（+5333）
- T-Auto/dsh-ops：371 → 5591（+5220）
- elysia395/dsh-wallpaper-engine：1020 → 5992（+4972）
- ranxianglei/billion-context：901 → 5170（+4269）
- mmparko/dsh-purge：0 → 3593（+3593）
- superdesigndev/treg：4986 → 7657（+2671）
- bowenliang123/dsh-context：1995 → 4657（+2662）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：4495 → 7040（+2545）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
