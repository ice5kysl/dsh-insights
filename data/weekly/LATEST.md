# DSH 插件生态周报 · 2026-W41（2026/10/05～2026/10/11）

> 数据快照 2026-10-12 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **安全与运维插件领跑新增** kenryu42/cc-safety-net 以 1591 stars 和 npm 可用进入新增头部，T-Auto/dsh-ops 也有 371 stars，说明新作者用安全/运维切口更容易被看见。
- **头部增长由市场与清理驱动** dsh-market 从 4699 涨到 6169、dsh-purge 从 2448 涨到 4584、treg 从 3585 涨到 4986，非模型型核心工具正在承接生态流量。
- **桌面端与兼容层是版本主线** dsh-v0.2.0-rc.2 把命令安装与插件管理搬到菜单栏，dsh-v0.2.1-alpha.1 试水 Claude Code Mods 兼容层，dsh-v0.2.1-alpha.2 又加思考翻译，平台边界继续外扩。
- **高评分新插件仍缺曝光** SenmuuuuW/dsh-whale-report 与 NanmiCoder/dsh-agent-teams 等 gems 拿到 95–100 分却仍是 0 stars，质量信号与社区发现明显脱节。
本周基调：新增供给与头部增长同时活跃，但 breaking 版本、npm 缺位与模块缺失正把兼容和依赖完整性推成隐性门槛。

## 本周洞察

- 新作者榜里 npm 就绪的项目更容易放大早期势能：kenryu42/cc-safety-net（1591 stars、npm true）和 T-Auto/dsh-ops（371 stars、npm true）都进入新增头部，而 sixtysevenlf/dsh-blender-plugin（212 stars）与 luobosibing2/dsh-jev-plugin（204 stars）尚未发 npm，后者会卡在安装体验上。
- 本周上升榜集中在基础设施而非单点功能：dsh-market 增加 1470 stars、dsh-purge 增加 2136 stars、treg 增加 1401 stars，说明市场、清理与路由类工具正在成为插件生态的入口层。
- breaking 信号指向平台兼容与桌面入口：dsh-v0.2.1-alpha.2 引入思考翻译插件，dsh-v0.2.1-alpha.1 加 Claude Code Mods 兼容层，dsh-v0.2.0-rc.2 支持菜单栏管理命令和插件，生态开始从功能扩张转向宿主能力建设，但 alpha/rc 阶段升级风险同步上升。
- 高分 gems 与崩溃榜形成质量对照：SenmuuuuW/dsh-whale-report（score 100）、Han-1413141/dsh-cost-meter（score 95）等仍是 0 stars，而 crashTop 的 module-missing 命中 dsh-workspace-kit（count 1）及 @wishp3/dsh-cite、dsh-token-usage，说明低曝光高质量插件有机会，但依赖完整性会直接拖累体验。

## 行动建议

- **给插件用户**：升级 dsh-v0.2.1-alpha.2 前，先检查当前插件是否涉及 crashTop 的 module-missing：dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 的依赖完整性会决定升级后能否正常加载。
- **给插件用户**：想补监控、成本与侧栏能力时，优先试用本周 gems：SenmuuuuW/dsh-whale-report（score 100）、Han-1413141/dsh-cost-meter（score 95）、omdsh-dev/DSH-better-sidebar（score 95），它们分数高但仍 0 stars，替代空间大。
- **给插件作者**：新作者应把 npm 发布作为冷启动优先级：kenryu42/cc-safety-net、T-Auto/dsh-ops 已 npm true 并获新增头部，而 sixtysevenlf/dsh-blender-plugin（212 stars）、luobosibing2/dsh-jev-plugin（204 stars）仍 npm false，安装门槛会压制转化。
- **给插件作者**：可对标 gems 做差异化补位：SenmuuuuW/dsh-whale-report（状态/监控/用量，score 100）、NanmiCoder/dsh-agent-teams（模型/代理，score 95）、Han-1413141/dsh-cost-meter（会话管理，score 95）；同时优先排查 dsh-workspace-kit 的 module-missing 崩溃。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **14866** 个（通过 dsh.bundle manifest 校验；另有 5056 个被拒/噪声分桶）
- 近 7 天活跃 18%（30 天 45.9%）· 可过收录门禁（仓库≥1天）97.3%
- npm 发布率 44.3%（已发布 6582 / 版本滞后 3969）
- 中英/双语文档率 47.8% · 平均质量分 73.7（S+A 4%）
- curated 收录覆盖 7.3%（1088 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 3251566
- LLM 能力标注进度：1823/14866

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★247,518 · 最近 push 2026-10-09
- npm dist-tags：latest=0.2.0-rc.2 · next=0.2.0-rc.2 · alpha=0.2.1-alpha.2
- 最新 release：dsh-v0.2.1-alpha.2（pre-release · 2026-10-09 · 含 breaking 说明）
- 最近 8 个 release 中 6 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.0-rc.2；已探测 5357 个 npm 插件，仅 385 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,499 · v1.0.0；DeepSeek-R1 ★91,905 · v1.0.0；awesome-deepseek-integration ★39,348；DeepSeek-Coder ★24,295；DeepSeek-OCR ★23,962；Janus ★17,755；FlashMLA ★13,063；3FS ★10,277
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| zhu1090093659/dsh-web | 8635 | ✓ | ✓ |
| yjh051108/dsh-routing-suite | 7020 | — | ✓ |
| dsh-market/dsh-market | 6169 | ✓ | ✓ |
| superdesigndev/treg | 4986 | — | — |
| YuJunZhiXue/dsh-purge | 4584 | — | ✓ |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 4495 | ✓ | ✓ |
| liustack/modlens | 4209 | ✓ | ✓ |
| Minglink/dsh-infinite-gen-4 | 2303 | — | ✓ |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**547791**/周
- sunyuhuirong/deepseek-account：**257231**/周
- dsh-market/dsh-market：**124710**/周
- MichengAI/dsh-skills-manager：**63575**/周
- MichengAI/dsh-pua：**56640**/周
- MeteorNOX/DeepSeek-Balance-Whale-Widget：**47879**/周
- omdsh-dev/DSH-better-sidebar：**45990**/周
- Nicercz007-cloud/schedule：**45453**/周
- bowenliang123/dsh-context：**38580**/周
- MichengAI/dsh-codex-ui：**34298**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.66.17
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- liustack/modlens：仓库 3.25.4 → npm 3.26.6
- bowenliang123/dsh-context：仓库 0.42.0 → npm 0.69.0
- xmanrui/dsh-im：仓库 4.11.0 → npm 4.38.1

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 497 个 vs D 级 2094 个（C 级是主体 5053），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（5242 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 39 个插件没有 README、8284 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1088/14866），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 1265 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- belowthetree/dsh-mcp-setting（A，★0，周下载 362）
- MayBeTheWorld/dsh-inherit（A，★1，周下载 23）
- runcat-tommy/dsh-unitverse（A，★0，周下载 260）
- zjuatri/dsh-terminal-plugin（A，★1，周下载 7）
- d0ublecl1ck/dsh-session-watch（A，★0，周下载 109）
- ai-tool-labs/dsh-plugin-square（A，★0，周下载 394）
- BangBang-03/dsh-memory（A，★1，周下载 483）
- BillCx330/dsh-plugin-notify-sounds（A，★2，周下载 304）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-04）

- 当前权威插件：**14866**（基线 13601 · 2026-10-04）
- 新增 1265 · 消失 0

### 新增（Top 15，按 ★）
- kenryu42/cc-safety-net ★1591 (npm ✓)
- T-Auto/dsh-ops ★371 (npm ✓)
- sixtysevenlf/dsh-blender-plugin ★212
- luobosibing2/dsh-jev-plugin ★204
- xcisxc29/dsh-wechat ★111
- Microqian2th/dsh-codex-effort-slider ★84
- dsh-wsl-workspace-maintainers/dsh-wsl-workspace ★80 (npm ✓)
- aa2246740/dsh-model-fusion ★60 (npm ✓)
- yi-yezhiqiu/dsh-prompt-market ★39
- jingyi0605/Codingns4DSH ★31 (npm ✓)
- huaizhuanghub/dsh-persona-dafeiyu ★25 (npm ✓)
- Lzcdebear/better-dsh-session-deletetool ★23
- DSH-EAC/EAC-skin-loader ★18
- zhu1090093659/dsh-skins ★16 (npm ✓)
- Yoshino-JF/dsh-deepseek-pet ★14

### star 涨幅榜（同基线）
- YuJunZhiXue/dsh-purge：2448 → 4584（+2136）
- dsh-market/dsh-market：4699 → 6169（+1470）
- superdesigndev/treg：3585 → 4986（+1401）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：3268 → 4495（+1227）
- zouyuxuan122/dsh-our-free-model：300 → 1166（+866）
- elysia395/dsh-wallpaper-engine：374 → 1020（+646）
- ranxianglei/billion-context：329 → 901（+572）
- zhu1090093659/dsh-web：8070 → 8635（+565）
- Miaotofu01/Study-Mate：353 → 859（+506）
- bowenliang123/dsh-context：1546 → 1995（+449）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
