# DSH 插件生态周报 · 2026-W47（2026/11/16～2026/11/22）

> 数据快照 2026-11-23 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **高星新品卡在发布关** alchaincyf 的 nuwa-skill（38820 星）与 huashu-design（30450 星）均 npm=false，且进入 newAuthors；关注已起量，未发 npm 会把安装转化挡在门外。
- **purge 赛道出现复刻潮** kingcharleslzy-ai/dsh-purge 以 11673 星进入 addedTop，YuJunZhiXue/dsh-purge 从 4584 升至 15339，mmparko/dsh-purge 从 0 升至 5805；同名清理插件靠复刻抢量，差异化不足会被迅速稀释。
- **市场入口成为分发基建** dsh-market/dsh-market 星数从 6169 升至 13244、周下载 270421，且 dsh-v0.2.3-alpha.1 支持添加 Git 仓库作为插件来源；入口价值上升，作者需要把仓库可发现性当作发布的一部分。
- **缺模块拖累安装成功率** crashTop 三条均为 module-missing，涉及 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage；计数虽低，但问题集中在依赖打包，首装体验最易受损。
- **免费模型插件吸走注意力** Ebony-Vinyl/dsh-our-free-model 从 8876 升至 84054 且 published=true；用户对成本敏感，但高星不等于长期维护，需看发布与更新。
本周基调：高星新作与市场入口正在吸走注意力，但发布完整性和依赖可靠性决定它们能否转化为可用供给。

## 本周洞察

- dsh-v0.2.3-alpha.1 是本周发布列表中唯一 breaking 版本，开放 Git 仓库作为插件来源并支持私有仓库浏览安装；这会把插件分发从 npm 单通道扩展到仓库直连，也让权限与来源可信度成为新的安装前置条件。
- gems 里 SenmuuuuW/dsh-whale-report 拿到 100 分，另有四款 95 分插件 stars 仍为 0；评分与热度脱节意味着生态还有一批未被发现的优质供给，用户选型应给低星高分插件试装机会。
- crashTop 三条均为 module-missing，分别指向 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage；这类问题不是功能 bug 而是依赖完整性缺口，会直接打断首次安装。
- newAuthors 中 alchaincyf 同时贡献 nuwa-skill（38820 星）和 huashu-design（30450 星），但两者 npm=false；新作者势能已形成，发布动作滞后会让新增流量停留在收藏层。

## 行动建议

- **给插件用户**：升级 dsh-v0.2.3-alpha.1 前，先备份插件组合并确认是否有私有 Git 仓库来源；该版本为 breaking，安装后优先验证 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 是否出现 module-missing。
- **给插件用户**：选型时先试 gems 中 95–100 分但 stars 为 0 的插件（如 dsh-whale-report、dsh-cost-meter、dsh-agent-teams）；高星但 npm=false 的 nuwa-skill、huashu-design 暂不宜直接作为依赖。
- **给插件作者**：高星仓库尽快发 npm：alchaincyf/nuwa-skill（38820 星）、huashu-design（30450 星）与 kingcharleslzy-ai/dsh-purge（11673 星）均 npm=false；先补齐安装入口，再谈留存。
- **给插件作者**：发布前做依赖完整性检查：本周 crashTop 全部为 module-missing，涉及 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage；在元数据中声明兼容范围并验证打包产物，避免首装即崩。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **27651** 个（通过 dsh.bundle manifest 校验；另有 7241 个被拒/噪声分桶）
- 近 7 天活跃 12.1%（30 天 48.2%）· 可过收录门禁（仓库≥1天）98%
- npm 发布率 44.3%（已发布 12250 / 版本滞后 6091）
- 中英/双语文档率 47.9% · 平均质量分 73.9（S+A 4.8%）
- curated 收录覆盖 4.2%（1152 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 8081658
- LLM 能力标注进度：1823/27651

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★285,669 · 最近 push 2026-11-22
- npm dist-tags：next=0.2.2-rc.5 · latest=0.2.2-rc.5 · alpha=0.2.3-alpha.2
- 最新 release：dsh-v0.2.3-alpha.2（pre-release · 2026-11-22）
- 最近 8 个 release 中 4 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.2-rc.1；已探测 8894 个 npm 插件，仅 2228 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,893 · v1.0.0；DeepSeek-R1 ★92,062 · v1.0.0；awesome-deepseek-integration ★40,002；DeepInfer ★26,325；DeepSeek-Coder ★24,396；dsh-superagent-prototype ★24,261；DeepSeek-OCR ★24,187；Janus ★17,775
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| Ebony-Vinyl/dsh-our-free-model | 84054 | ✓ | ✓ |
| alchaincyf/nuwa-skill | 38820 | — | ✓ |
| alchaincyf/huashu-design | 30450 | — | ✓ |
| YuJunZhiXue/dsh-purge | 15339 | ✓ | ✓ |
| dsh-market/dsh-market | 13244 | ✓ | ✓ |
| kingcharleslzy-ai/dsh-purge | 11673 | — | ✓ |
| zhu1090093659/dsh-web | 10594 | ✓ | ✓ |
| superdesigndev/treg | 8749 | — | — |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**1189554**/周
- sunyuhuirong/deepseek-account：**504456**/周
- dsh-market/dsh-market：**270421**/周
- lijiaqi-AI-Product-Manager/dsh-agent-compare：**178116**/周
- helloHub1212/dsh-windows-mcp：**175836**/周
- WNLUO/dsh-mobile-plugin：**147988**/周
- bowenliang123/dsh-context：**114669**/周
- JHboy203/dsh-plugin-catalog：**95306**/周
- flymysql/dsh-remote：**92515**/周
- omdsh-dev/DSH-better-sidebar：**82697**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- YuJunZhiXue/dsh-purge：仓库 1.3.3 → npm 0.0.0-stage
- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.80.0
- elysia395/dsh-wallpaper-engine：仓库 0.7.0 → npm 1.4.3
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- bowenliang123/dsh-context：仓库 0.42.0 → npm 0.87.1
- ranxianglei/billion-context：仓库 0.1.131 → npm 0.1.184

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 1085 个 vs D 级 3225 个（C 级是主体 10626），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（9178 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 65 个插件没有 README、15401 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1152/27651），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 12134 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- zhz8888/dsh-android-emulator-helper（A，★2，周下载 993）
- zhz8888/dsh-ios-simulator-helper（A，★3，周下载 859）
- GallenShao/dsh-faster-compress（A，★1，周下载 384）
- zhuweiyou/dsh-holdem（A，★1，周下载 105）
- REALOIYO/dsh-qwenwork-connector（A，★4，周下载 519）
- railgun20001/dsh-session-row-actions（A，★0，周下载 236）
- xymy666/dsh-cache-probe（A，★0，周下载 254）
- xiaoxin3309/dsh-backup-rescue（A，★0，周下载 162）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-15）

- 当前权威插件：**27651**（基线 15517 · 2026-10-15）
- 新增 12134 · 消失 0

### 新增（Top 15，按 ★）
- alchaincyf/nuwa-skill ★38820
- alchaincyf/huashu-design ★30450
- kingcharleslzy-ai/dsh-purge ★11673
- QingYunA/answer-me-with-html ★6604
- Ebony-Vinyl/EAC-design-world ★1811 (npm ✓)
- woniuniuniu/dsh-media-desk ★1658
- c1overzz/dsh-bili-scroll ★1467 (npm ✓)
- op7418/dsh-guizang-design ★1025 (npm ✓)
- Alice-Marx/dsh-model-router ★1014 (npm ✓)
- keli-wen/agy-staff ★910
- 6shenhonghong9/dsh-startup-screen ★872
- CallMeGuLab/dsh-purge-safe ★821
- ZSeven-W/dsh-game-studio ★819 (npm ✓)
- SAOS-3624/dsh-see-now ★740 (npm ✓)
- aureth-labs/dsh-aurabot-qq ★719

### star 涨幅榜（同基线）
- Ebony-Vinyl/dsh-our-free-model：8876 → 84054（+75178）
- YuJunZhiXue/dsh-purge：4584 → 15339（+10755）
- dsh-market/dsh-market：6169 → 13244（+7075）
- elysia395/dsh-wallpaper-engine：1020 → 7892（+6872）
- mmparko/dsh-purge：0 → 5805（+5805）
- T-Auto/dsh-ops：371 → 5977（+5606）
- ranxianglei/billion-context：901 → 5170（+4269）
- superdesigndev/treg：4986 → 8749（+3763）
- bowenliang123/dsh-context：1995 → 5422（+3427）
- liguobao/ds-harness-remote：308 → 3570（+3262）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
