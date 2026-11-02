# DSH 插件生态周报 · 2026-W44（2026/10/26～2026/11/01）

> 数据快照 2026-11-02 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

**新作者正撬动体验入口**：QingYunA/answer-me-with-html 以 5023 stars 冲上新增榜且 npm=false，c1overzz/dsh-bili-scroll 也拿到 1120 stars 并已发 npm，说明内容/场景型新插件能快速获客，但发布完成度决定能否沉淀用户。
**头部插件形成断层增长**：Ebony-Vinyl/dsh-our-free-model 从 8876 跃至 55755，dsh-market 从 6169 升至 10113，模型与市场入口的网络效应正在加剧，后来者应避开同质功能堆叠。
**高星项目存在交付缺口**：YuJunZhiXue/dsh-purge 达 15339 stars 但 published=false，yjh051108/dsh-routing-suite 6998 stars 同样未发布，热度与可安装性错位会直接损耗转化。
**高分插件仍缺曝光转化**：SenmuuuuW/dsh-whale-report 评分 100、omdsh-dev/DSH-better-sidebar 等四款 95 分插件 stars 仍为 0，说明质量识别已跑在分发前面，索引源与推荐位比追星更关键。
本周基调：流量正加速涌向强场景入口和头部插件，而交付完整性与依赖质量决定谁能接住这波增长。

## 本周洞察

- dsh-v0.2.2-alpha.2 在 2026-10-28 被标记为 breaking，改动是插件管理页支持富文本详情并改善布局和导航，意味着依赖管理页入口或解析插件详情的插件需要优先回归，alpha 阶段不宜直接推给普通用户。
- risers 中 Ebony-Vinyl/dsh-our-free-model 从 8876 涨到 55755、T-Auto/dsh-ops 从 371 涨到 5002，头部跃迁与冷启动放大同时出现，说明本周增长既来自强入口集中，也来自细分工具被索引源重新发现。
- dsh-v0.2.1-rc.1 允许从「自定义插件索引源」发现和安装插件，而 gems 里 SenmuuuuW/dsh-whale-report 100 分、omdsh-dev/DSH-better-sidebar 等四款 95 分插件 stars 仍为 0，意味着索引源开放会把竞争从 star 数转向可发现的高完成度供给。
- crashTop 显示 dsh-workspace-kit 的 module-missing 计数为 1，@wishp3/dsh-cite 与 dsh-token-usage 也同为 module-missing，说明缺模块是本周最明确的崩溃类别，作者应在发布前补齐依赖声明和安装自检。

## 行动建议

- **给插件用户**：升级 dsh-v0.2.2-alpha.2 前先做插件组合回归，重点检查插件管理页的富文本详情、布局和导航行为；使用 dsh-workspace-kit 的用户先补齐缺失模块再启用。
- **给插件用户**：对 YuJunZhiXue/dsh-purge、yjh051108/dsh-routing-suite 这类 published=false 的高星插件，先不要作为开箱即用依赖，优先选择已发布 npm 的同类插件或等待作者发布。
- **给插件作者**：尽快为高星项目补发 npm 包：YuJunZhiXue/dsh-purge（15339 stars）、yjh051108/dsh-routing-suite（6998 stars）目前 published=false，否则热度会卡在安装门槛前。
- **给插件作者**：参考 gems 做差异化完成度：SenmuuuuW/dsh-whale-report 的 100 分和 omdsh-dev/DSH-better-sidebar 等 95 分但 stars 为 0，说明侧栏、代理、成本计量、用量监控等细分位仍有机会；发布前声明依赖并针对 module-missing 自检，dsh-workspace-kit 本周已出现该签名。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **19503** 个（通过 dsh.bundle manifest 校验；另有 6113 个被拒/噪声分桶）
- 近 7 天活跃 15.7%（30 天 46.3%）· 可过收录门禁（仓库≥1天）98%
- npm 发布率 44%（已发布 8574 / 版本滞后 4745）
- 中英/双语文档率 48.3% · 平均质量分 74.1（S+A 5.1%）
- curated 收录覆盖 5.7%（1108 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 7220074
- LLM 能力标注进度：1823/19503

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★268,416 · 最近 push 2026-10-30
- npm dist-tags：latest=0.2.1-rc.5 · alpha=0.2.2-alpha.2 · next=0.2.1-rc.5
- 最新 release：dsh-v0.2.1-rc.5（pre-release · 2026-10-30）
- 最近 8 个 release 中 2 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.1-rc.2；已探测 6039 个 npm 插件，仅 780 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,709 · v1.0.0；DeepSeek-R1 ★91,993 · v1.0.0；awesome-deepseek-integration ★39,672；DeepInfer ★24,821；DeepSeek-Coder ★24,336；DeepSeek-OCR ★24,108；Janus ★17,767；FlashMLA ★13,231
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| Ebony-Vinyl/dsh-our-free-model | 55755 | ✓ | ✓ |
| YuJunZhiXue/dsh-purge | 15339 | — | ✓ |
| dsh-market/dsh-market | 10113 | ✓ | ✓ |
| zhu1090093659/dsh-web | 9922 | ✓ | ✓ |
| yjh051108/dsh-routing-suite | 6998 | — | ✓ |
| superdesigndev/treg | 6954 | — | — |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 6709 | ✓ | ✓ |
| QingYunA/answer-me-with-html | 5023 | — | ✓ |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**788347**/周
- sunyuhuirong/deepseek-account：**559082**/周
- dsh-market/dsh-market：**361739**/周
- yhm0619/dsh-pet-read：**224840**/周
- MeteorNOX/DeepSeek-Balance-Whale-Widget：**174422**/周
- bowenliang123/dsh-context：**139038**/周
- LuniteGlaze/dsh-plugin-catalog：**136941**/周
- liustack/modlens：**104446**/周
- omdsh-dev/DSH-better-sidebar：**99313**/周
- T-Auto/dsh-ops：**66334**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.73.8
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- liustack/modlens：仓库 3.25.4 → npm 3.27.2
- elysia395/dsh-wallpaper-engine：仓库 0.7.0 → npm 1.4.0
- bowenliang123/dsh-context：仓库 0.42.0 → npm 0.79.0

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 802 个 vs D 级 2433 个（C 级是主体 6975），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（6613 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 52 个插件没有 README、10929 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1108/19503），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 3986 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- belowthetree/dsh-mcp-setting（A，★0，周下载 275）
- runcat-tommy/dsh-unitverse（A，★0，周下载 364）
- skyyyyyk/dsh-szg-hint（A，★0，周下载 141）
- d0ublecl1ck/dsh-session-watch（A，★0，周下载 18）
- ai-tool-labs/dsh-plugin-square（A，★0，周下载 0）
- ai-tool-labs/dsh-squares（A，★1，周下载 138）
- zhz8888/dsh-android-emulator-helper（A，★2，周下载 642）
- zhz8888/dsh-ios-simulator-helper（A，★2，周下载 338）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-15）

- 当前权威插件：**19503**（基线 15517 · 2026-10-15）
- 新增 3986 · 消失 0

### 新增（Top 15，按 ★）
- QingYunA/answer-me-with-html ★5023
- c1overzz/dsh-bili-scroll ★1120 (npm ✓)
- Alice-Marx/dsh-model-router ★595 (npm ✓)
- JeffKeeping/dsh-purge-plus ★466
- Ebony-Vinyl/EAC-design-world ★399 (npm ✓)
- XDTrees/dsh-xdpool ★376 (npm ✓)
- uumit-ai/dsh-uumit-remote ★271 (npm ✓)
- Yuuyuko-uu/dsh-feiyu-mood ★219
- InariNGT-Ofiicial/dsh-bili-humanism ★219
- evilevil/dsh-purge-021rc2 ★214
- Yuuyuko-uu/dsh-speak-up ★205
- jaccen/Awesome-Gaussian-Skills ★176
- WestFox-AwA/dsh-wish-specializer ★141
- Loping151/dsh-nekowhale-stickers ★130 (npm ✓)
- xiaoshe1337-star/Xsdsh-purge ★105

### star 涨幅榜（同基线）
- Ebony-Vinyl/dsh-our-free-model：8876 → 55755（+46879）
- YuJunZhiXue/dsh-purge：4584 → 15339（+10755）
- T-Auto/dsh-ops：371 → 5002（+4631）
- dsh-market/dsh-market：6169 → 10113（+3944）
- elysia395/dsh-wallpaper-engine：1020 → 4480（+3460）
- mmparko/dsh-purge：0 → 2906（+2906）
- ranxianglei/billion-context：901 → 3579（+2678）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：4495 → 6709（+2214）
- bowenliang123/dsh-context：1995 → 3968（+1973）
- superdesigndev/treg：4986 → 6954（+1968）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
