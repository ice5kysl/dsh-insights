# DSH 插件生态周报 · 2026-W43（2026/10/19～2026/10/25）

> 数据快照 2026-10-26 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **高星未发 npm 是发布缺口**：QingYunA/answer-me-with-html 以 4434 星进入新增榜但 npm=false，jaccen/Awesome-Gaussian-Skills 170 星同样未发布，热度尚未转成安装入口。
- **头部跃升抬高集中度**：Ebony-Vinyl/dsh-our-free-model 从 8876 升到 42984、T-Auto/dsh-ops 从 371 升到 4281，增量明显向少数项目聚拢。
- **模块缺失是崩溃主因**：crashTop 中 dsh-workspace-kit 以 count=1 居首，@wishp3/dsh-cite 与 dsh-token-usage 同类归因，用户排障应先查依赖声明与安装完整性。
- **高分小插件存在发现错位**：SenmuuuuW/dsh-whale-report 评分 100、omdsh-dev/DSH-better-sidebar 评分 95 但 stars=0，质量信号尚未被星标发现机制充分放大。
本周基调：生态热度在涨，但发布完整性与质量发现机制比新增数量更值得本周关注。

## 本周洞察

- risers 显示 Ebony-Vinyl/dsh-our-free-model 从 8876 星升至 42984 星、T-Auto/dsh-ops 从 371 升至 4281，单周跃升把注意力进一步推向头部；生态发现页需要更快识别跃升项目，否则长尾插件更难获得曝光。
- newAuthors 中 QingYunA/answer-me-with-html 新增 4434 星但 npm=false，c1overzz/dsh-bili-scroll 新增 814 星且 npm=true；新作者首作即可冲榜，但未发 npm 会直接把高星流量挡在安装环节外。
- dsh-v0.2.1-rc.1 以 breaking 方式允许自定义插件索引源，rc.3 已在 10/23 发布且 breaking=false；索引源开放会改变插件发现路径，作者需要保证包元数据可被外部索引稳定读取。
- crashTop 中 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 均归为 module-missing；崩溃集中在依赖缺失，意味着安装声明与 peer 依赖校验仍是生态短板。

## 行动建议

- **给插件用户**：升级到 dsh-v0.2.1-rc.3 前先核对 dsh-v0.2.1-rc.1 的自定义索引源变更影响，重点检查 dsh-workspace-kit 等 module-missing 插件是否已补齐依赖。
- **给插件用户**：可优先试用 SenmuuuuW/dsh-whale-report（评分 100）和 omdsh-dev/DSH-better-sidebar（评分 95）这类高评分但未获星标的小插件，作为同类替代观察。
- **给插件作者**：未发 npm 的高星项目尽快发布：QingYunA/answer-me-with-html（4434 星，npm=false）和 jaccen/Awesome-Gaussian-Skills（170 星，npm=false）应补齐 npm 包与安装说明，降低试用门槛。
- **给插件作者**：针对 module-missing 崩溃，发布前声明完整 dependencies 与 peerDependencies，并参考 dsh-v0.2.1-rc.1 的自定义索引源要求补齐元数据，避免被索引后安装失败。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **17011** 个（通过 dsh.bundle manifest 校验；另有 5774 个被拒/噪声分桶）
- 近 7 天活跃 16.2%（30 天 45.1%）· 可过收录门禁（仓库≥1天）97.9%
- npm 发布率 43.7%（已发布 7434 / 版本滞后 4354）
- 中英/双语文档率 48.3% · 平均质量分 73.8（S+A 4.5%）
- curated 收录覆盖 6.2%（1061 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 3271574
- LLM 能力标注进度：1823/17011

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★261,476 · 最近 push 2026-10-23
- npm dist-tags：alpha=0.2.1-alpha.5 · next=0.2.1-rc.3 · latest=0.2.1-rc.2
- 最新 release：dsh-v0.2.1-rc.3（pre-release · 2026-10-23）
- 最近 8 个 release 中 4 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.0-rc.2；已探测 5625 个 npm 插件，仅 554 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,598 · v1.0.0；DeepSeek-R1 ★91,956 · v1.0.0；awesome-deepseek-integration ★39,534；DeepSeek-Coder ★24,311；DeepSeek-OCR ★24,064；DeepInfer ★22,481；Janus ★17,764；FlashMLA ★13,189
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| Ebony-Vinyl/dsh-our-free-model | 42984 | ✓ | ✓ |
| zhu1090093659/dsh-web | 9512 | ✓ | ✓ |
| YuJunZhiXue/dsh-purge | 8892 | — | ✓ |
| dsh-market/dsh-market | 8866 | ✓ | ✓ |
| yjh051108/dsh-routing-suite | 6998 | — | ✓ |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 6067 | ✓ | ✓ |
| superdesigndev/treg | 6055 | — | — |
| liustack/modlens | 4462 | ✓ | ✓ |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**595244**/周
- sunyuhuirong/deepseek-account：**266575**/周
- dsh-market/dsh-market：**175241**/周
- MeteorNOX/DeepSeek-Balance-Whale-Widget：**53699**/周
- omdsh-dev/DSH-better-sidebar：**48564**/周
- levi52/dsh-pet：**46041**/周
- bowenliang123/dsh-context：**42100**/周
- Nicercz007-cloud/schedule：**29926**/周
- MichengAI/dsh-skills-manager：**26049**/周
- Creakono/dsh-cost-meter：**24941**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.70.2
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- liustack/modlens：仓库 3.25.4 → npm 3.27.2
- bowenliang123/dsh-context：仓库 0.42.0 → npm 0.77.0
- ranxianglei/billion-context：仓库 0.1.131 → npm 0.1.184

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 625 个 vs D 级 2284 个（C 级是主体 6012），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（5838 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 45 个插件没有 README、9577 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1061/17011），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 1494 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- belowthetree/dsh-mcp-setting（A，★0，周下载 158）
- runcat-tommy/dsh-unitverse（A，★0，周下载 597）
- skyyyyyk/dsh-szg-hint（A，★0，周下载 37）
- d0ublecl1ck/dsh-session-watch（A，★0，周下载 10）
- ai-tool-labs/dsh-plugin-square（A，★0，周下载 0）
- ai-tool-labs/dsh-squares（A，★1，周下载 64）
- zhz8888/dsh-android-emulator-helper（A，★2，周下载 313）
- zhz8888/dsh-ios-simulator-helper（A，★2，周下载 338）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-15）

- 当前权威插件：**17011**（基线 15517 · 2026-10-15）
- 新增 1494 · 消失 0

### 新增（Top 15，按 ★）
- QingYunA/answer-me-with-html ★4434
- c1overzz/dsh-bili-scroll ★814 (npm ✓)
- XDTrees/dsh-xdpool ★283 (npm ✓)
- Ebony-Vinyl/EAC-design-world ★236 (npm ✓)
- jaccen/Awesome-Gaussian-Skills ★170
- evilevil/dsh-purge-021rc2 ★151
- Yuuyuko-uu/dsh-feiyu-mood ★104
- Rosynb666/dsh-whale-catch ★101
- mengwEX/dsh-block-ptc ★100
- rlaope/deepseek-bot ★76 (npm ✓)
- luowang-ui/dsh-purge-plus ★53
- q253595422/dsh-imagegen-video ★52 (npm ✓)
- LeeRolling/dsh-chat-wallpaper ★42
- realMisakaMikoto/dsh-purge ★34
- LanJinGod/dsh-purge ★30

### star 涨幅榜（同基线）
- Ebony-Vinyl/dsh-our-free-model：8876 → 42984（+34108）
- YuJunZhiXue/dsh-purge：4584 → 8892（+4308）
- T-Auto/dsh-ops：371 → 4281（+3910）
- dsh-market/dsh-market：6169 → 8866（+2697）
- mmparko/dsh-purge：0 → 2357（+2357）
- ranxianglei/billion-context：901 → 2835（+1934）
- elysia395/dsh-wallpaper-engine：1020 → 2808（+1788）
- bowenliang123/dsh-context：1995 → 3590（+1595）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：4495 → 6067（+1572）
- sixtysevenlf/dsh-blender-plugin：212 → 1291（+1079）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
