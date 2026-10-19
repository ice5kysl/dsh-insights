# DSH 插件生态周报 · 2026-W42（2026/10/12～2026/10/18）

> 数据快照 2026-10-19 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **新面孔带来高星冲击**：本周新增作者 Ebony-Vinyl 的 dsh-our-free-model 拿到 24760 星且已发 npm，说明“免费模型”类入口插件仍能靠单一强需求快速吸量，新进入者应优先找这类高频刚需。
- **未发 npm 是转化缺口**：YuJunZhiXue/dsh-purge 有 7078 星但 published=false，yjh051108/dsh-routing-suite 有 6988 星也未发布，说明关注度没有转成可安装供给，榜单热度与分发闭环脱节。
- **黑马插件验证运维刚需**：T-Auto/dsh-ops 从 8 星冲到 3066 星，ranxianglei/billion-context 从 532 升到 1879 星且周下载 450525，说明“运维/上下文”类工具已从长尾变成高频入口。
- **零星高分项目值得关注**：gems 中 SenmuuuuW/dsh-whale-report 评分 100、Han-1413141/dsh-cost-meter 评分 95 但 stars 均为 0，说明评分能提前暴露可用性价值，别只看星数。
- **崩溃集中在模块缺失**：crashTop 中 dsh-workspace-kit 的 module-missing 计数为 1，@wishp3/dsh-cite 与 dsh-token-usage 也归入同类，说明装机/依赖解析仍是插件体验的第一道裂缝。
本周基调：新增供给活跃，但高星未发布和模块缺失提醒生态从冲榜转向可用性闭环。

## 本周洞察

- dsh-v0.2.1-rc.1 于 2026-10-17 标记 breaking，允许用户从“自定义插件索引源”中发现和安装插件；这意味着插件分发入口开始外溢到第三方源，作者需要提前验证索引源配置和安装链路，避免新入口放大兼容问题。
- T-Auto/dsh-ops 从 8 星升至 3066 星、ranxianglei/billion-context 从 532 星升至 1879 星且周下载 450525，说明运维与上下文管理已从长尾需求变成高频入口，值得作为用户选型和作者差异化的重要方向。
- gems 中 SenmuuuuW/dsh-whale-report 以 0 星拿到 100 分、Han-1413141/dsh-cost-meter 等 0 星项目拿到 95 分，说明评分能先于星数识别“可用但未被发现”的插件，生态推荐不应只按热度排序。
- crashTop 里 dsh-workspace-kit 出现 module-missing 1 次，@wishp3/dsh-cite 与 dsh-token-usage 也被列入同类，说明模块缺失是当前最明确的崩溃信号，发布前的依赖完整性校验应成为硬门槛。

## 行动建议

- **给插件用户**：升级到 dsh-v0.2.1-rc.1 前先备份并核对“自定义插件索引源”配置，逐个验证已装插件能否从新源发现和安装；该版本 breaking 涉及索引源，避免直接覆盖升级。
- **给插件用户**：遇到启动崩溃先排查 module-missing：优先检查 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 的依赖是否完整，再决定禁用或回退。
- **给插件作者**：未发布 npm 的高星插件尽快补充分发：YuJunZhiXue/dsh-purge（7078 星，published=false）、yjh051108/dsh-routing-suite（6988 星，published=false）、Minglink/dsh-infinite-gen-5（3049 星，npm=false）都在把热度留在仓库层。
- **给插件作者**：参考 gems 的差异化方向补齐可发现性：侧栏/工作区、模型/代理、会话管理、状态/监控/用量等 0 星高评分项目（如 SenmuuuuW/dsh-whale-report 100 分）证明功能价值可被评分识别，作者应把安装说明和索引源兼容性写清楚。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **15681** 个（通过 dsh.bundle manifest 校验；另有 5262 个被拒/噪声分桶）
- 近 7 天活跃 17.6%（30 天 44.2%）· 可过收录门禁（仓库≥1天）97.9%
- npm 发布率 44%（已发布 6901 / 版本滞后 4160）
- 中英/双语文档率 48.1% · 平均质量分 73.7（S+A 4.1%）
- curated 收录覆盖 6.8%（1062 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 2546208
- LLM 能力标注进度：1823/15681

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★253,154 · 最近 push 2026-10-17
- npm dist-tags：latest=0.2.0-rc.2 · alpha=0.2.1-alpha.5 · next=0.2.1-rc.2
- 最新 release：dsh-v0.2.1-rc.2（pre-release · 2026-10-17）
- 最近 8 个 release 中 5 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.0-rc.2；已探测 5589 个 npm 插件，仅 440 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,508 · v1.0.0；DeepSeek-R1 ★91,894 · v1.0.0；awesome-deepseek-integration ★39,417；DeepSeek-Coder ★24,294；DeepSeek-OCR ★24,024；Janus ★17,756；FlashMLA ★13,087；DeepEP ★10,289 · v1.2.1
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| Ebony-Vinyl/dsh-our-free-model | 24760 | ✓ | ✓ |
| zhu1090093659/dsh-web | 8968 | ✓ | ✓ |
| dsh-market/dsh-market | 7210 | ✓ | ✓ |
| YuJunZhiXue/dsh-purge | 7078 | — | ✓ |
| yjh051108/dsh-routing-suite | 6988 | — | ✓ |
| superdesigndev/treg | 5753 | — | — |
| MeteorNOX/DeepSeek-Balance-Whale-Widget | 5270 | ✓ | ✓ |
| liustack/modlens | 4311 | ✓ | ✓ |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**450525**/周
- sunyuhuirong/deepseek-account：**179647**/周
- dsh-market/dsh-market：**117724**/周
- MichengAI/dsh-skills-manager：**63575**/周
- MeteorNOX/DeepSeek-Balance-Whale-Widget：**55242**/周
- omdsh-dev/DSH-better-sidebar：**46445**/周
- bowenliang123/dsh-context：**39359**/周
- Nicercz007-cloud/schedule：**29927**/周
- zhu1090093659/dsh-pet：**22929**/周
- Creakono/dsh-cost-meter：**21462**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1
- FSMargoo/dsh-at-file：仓库 0.7.0 → npm 0.6.3

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.66.42
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- liustack/modlens：仓库 3.25.4 → npm 3.27.1
- bowenliang123/dsh-context：仓库 0.42.0 → npm 0.73.3
- xmanrui/dsh-im：仓库 4.11.0 → npm 5.1.0

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 540 个 vs D 级 2169 个（C 级是主体 5462），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（5464 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 40 个插件没有 README、8780 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1062/15681），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 935 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- belowthetree/dsh-mcp-setting（A，★0，周下载 109）
- MayBeTheWorld/dsh-inherit（A，★1，周下载 18）
- runcat-tommy/dsh-unitverse（A，★0，周下载 504）
- skyyyyyk/dsh-szg-hint（A，★0，周下载 23）
- d0ublecl1ck/dsh-session-watch（A，★0，周下载 4）
- ai-tool-labs/dsh-plugin-square（A，★0，周下载 0）
- ai-tool-labs/dsh-squares（A，★1，周下载 361）
- saya-ch/dsh-mobile（A，★508，周下载 2762）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-11）

- 当前权威插件：**15681**（基线 14746 · 2026-10-11）
- 新增 935 · 消失 0

### 新增（Top 15，按 ★）
- Ebony-Vinyl/dsh-our-free-model ★24760 (npm ✓)
- Minglink/dsh-infinite-gen-5 ★3049
- c1overzz/dsh-bili-scroll ★132 (npm ✓)
- Ebony-Vinyl/EAC-Pack ★72
- Contexera/dsh-agent-team ★69 (npm ✓)
- 398894496-arch/KRouter ★46
- zaofan-make/dsh-qqbot ★42 (npm ✓)
- mistnest/dsh-cuigengji-plugin ★31 (npm ✓)
- Ebony-Vinyl/EAC-skin-loader ★30
- iJetLi/dsh-providers-hub ★29
- Imzl-zl/dsh-toolbox-ui ★28 (npm ✓)
- Scorp1o117/dsh-motion-ui ★27 (npm ✓)
- realchendahuang/dsh-skill ★25 (npm ✓)
- xcisxc29/dsh-qq-plugin ★24 (npm ✓)
- huliux/dsh-asr-plugin ★23 (npm ✓)

### star 涨幅榜（同基线）
- YuJunZhiXue/dsh-purge：3293 → 7078（+3785）
- T-Auto/dsh-ops：8 → 3066（+3058）
- dsh-market/dsh-market：5513 → 7210（+1697）
- superdesigndev/treg：4134 → 5753（+1619）
- ranxianglei/billion-context：532 → 1879（+1347）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：3996 → 5270（+1274）
- corrinehu/dsh-workbuddy-connect：289 → 1329（+1040）
- elysia395/dsh-wallpaper-engine：586 → 1560（+974）
- zhu1090093659/dsh-web：8367 → 8968（+601）
- xmanrui/dsh-im：1596 → 2141（+545）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
