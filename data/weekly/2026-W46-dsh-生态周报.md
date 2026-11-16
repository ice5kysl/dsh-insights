# DSH 插件生态周报 · 2026-W46（2026/11/09～2026/11/15）

> 数据快照 2026-11-16 · 由 DSH Insights（DeepSeek Harness 全景观察站 · dsh-insights.com）自动整理 · 开源：[dsh-insights](https://github.com/ice5kysl/dsh-insights)

## 编者按

- **新作者以未发布高星抢占心智**：alchaincyf 的 nuwa-skill 与 huashu-design 分别拿到 38349、29576 星，但 npm 均为 false，说明本周新增注意力先落在仓库而非可安装包上。
- **免费模型插件形成虹吸**：Ebony-Vinyl/dsh-our-free-model 从 8876 星升至 75756 星，且已发布中文，显示免费模型入口对用户迁移有极强拉动。
- **模块缺失崩溃集中暴露**：crashTop 中 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 均归为 module-missing，其中 dsh-workspace-kit count 为 1，意味着依赖声明与环境匹配仍是稳定性短板。
- **RC 破坏性变更需前置诊断**：dsh-v0.2.2-rc.2 在 2026-11-11 标记 breaking，并改动 Git Worktree 审阅与 GitHub 评审处理，升级前应先验证插件组合兼容性。
本周基调：热度向免费模型与高星新作者集中，但可安装性和模块依赖问题正在放大。

## 本周洞察

- Ebony-Vinyl/dsh-our-free-model 从 8876 星升至 75756 星，位列 risers 首位且已发布中文，说明“免费模型入口”正在把观望用户快速转化为插件用户。
- 新作者 alchaincyf 的 nuwa-skill 与 huashu-design 分别拿到 38349、29576 星却 npm:false，说明高星仓库可先占心智，但生态会短期出现“可看不可装”的落差。
- gems 中 SenmuuuuW/dsh-whale-report 拿到 100 分、Han-1413141/dsh-cost-meter 拿到 95 分却均为 0 星，说明评分体系正在提前识别尚未被社区发现的监控与用量类工具。
- crashTop 三条均归为 module-missing，涉及 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage，说明模块缺失是当前最可见的稳定性风险，会直接影响插件组合的可运行性。

## 行动建议

- **给插件用户**：升级 dsh-v0.2.2-rc.2 前，先检查 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 在当前环境是否可加载，避免遇到 module-missing 崩溃。
- **给插件用户**：想找实用插件可优先试装 gems 中 0 星但高分的 dsh-whale-report、dsh-cost-meter，重点关注状态监控、成本与用量场景。
- **给插件作者**：参考 alchaincyf 的 nuwa-skill、huashu-design 热度高但 npm:false 的情况，未发 npm 的作者应尽快发布可安装包，把星标转化为真实使用。
- **给插件作者**：针对 crashTop 的 module-missing，发布前检查 dsh-workspace-kit、@wishp3/dsh-cite、dsh-token-usage 的依赖完整性，并明确标注兼容的 DSH 版本与环境。

> 深度分析见《DSH 生态洞察》长报告：https://dsh-insights.com/insights/?utm_source=weekly&utm_medium=site

## 本期速览

- 权威插件 **25046** 个（通过 dsh.bundle manifest 校验；另有 6871 个被拒/噪声分桶）
- 近 7 天活跃 15.1%（30 天 51.2%）· 可过收录门禁（仓库≥1天）98.2%
- npm 发布率 44.1%（已发布 11042 / 版本滞后 5680）
- 中英/双语文档率 48.3% · 平均质量分 74.2（S+A 5.3%）
- curated 收录覆盖 4.6%（1150 个已进 awesome/imsai）
- npm 周下载样本 Top 15 合计 6996144
- LLM 能力标注进度：1823/25046

## 官方动态（dsh × DeepSeek 平台）

- dsh 官方仓库 ★281,645 · 最近 push 2026-11-13
- npm dist-tags：alpha=0.2.2-alpha.3 · latest=0.2.2-rc.1 · next=0.2.2-rc.3
- 最新 release：dsh-v0.2.2-rc.3（pre-release · 2026-11-13）
- 最近 8 个 release 中 4 个含 breaking/迁移关键词——升级前请核对 releases 说明
- rc 兼容信号：latest=0.2.2-rc.1；已探测 7822 个 npm 插件，仅 1711 个声明 engines.dsh（声明率过低，雷达走 v1 API 符号路线）
- DeepSeek 平台：DeepSeek-V3 ★104,842 · v1.0.0；DeepSeek-R1 ★92,029 · v1.0.0；awesome-deepseek-integration ★39,886；DeepInfer ★26,076；DeepSeek-Coder ★24,381；DeepSeek-OCR ★24,165；dsh-superagent-prototype ★23,302；Janus ★17,770
- 详见站点「动态」页：https://dsh-insights.com/dynamics/

## 增长与榜单

| 仓库 | ★ | npm | 中/双语 |
|---|---|---|---|
| Ebony-Vinyl/dsh-our-free-model | 75756 | ✓ | ✓ |
| alchaincyf/nuwa-skill | 38349 | — | ✓ |
| alchaincyf/huashu-design | 29576 | — | ✓ |
| YuJunZhiXue/dsh-purge | 15339 | ✓ | ✓ |
| dsh-market/dsh-market | 12524 | ✓ | ✓ |
| zhu1090093659/dsh-web | 10431 | ✓ | ✓ |
| kingcharleslzy-ai/dsh-purge | 8732 | — | ✓ |
| superdesigndev/treg | 8089 | — | — |

### 周下载 Top 10（已发布样本）

- ranxianglei/billion-context：**848080**/周
- sunyuhuirong/deepseek-account：**510593**/周
- dsh-market/dsh-market：**293468**/周
- bowenliang123/dsh-context：**133085**/周
- JHboy203/dsh-plugin-catalog：**103410**/周
- yhm0619/dsh-pet-read：**95892**/周
- omdsh-dev/DSH-better-sidebar：**95414**/周
- lijiaqi-AI-Product-Manager/dsh-agent-compare：**92759**/周
- flymysql/dsh-remote：**79516**/周
- T-Auto/dsh-ops：**73476**/周

### 仓库领先、尚未发布 Top 5（作者已改版本号，npm 上还没有）

- YuJunZhiXue/dsh-purge：仓库 1.3.3 → npm 0.0.0-stage
- zhu1090093659/dsh-web：仓库 0.1.1 → npm 0.0.1
- GanyuanRan/Aegis：仓库 2.9.6 → npm 0.1.0
- adoresever/graph-memory：仓库 1.6.0-beta.13 → npm 1.5.8
- sandbaseai/sandbase-harness：仓库 0.3.8 → npm 0.0.1

### npm 领先仓库 Top 5（发布版比默认分支 package.json 新）

- dsh-market/dsh-market：仓库 1.43.0 → npm 1.73.20
- MeteorNOX/DeepSeek-Balance-Whale-Widget：仓库 0.2.10 → npm 0.4.2
- elysia395/dsh-wallpaper-engine：仓库 0.7.0 → npm 1.4.2
- ranxianglei/billion-context：仓库 0.1.131 → npm 0.1.184
- bowenliang123/dsh-context：仓库 0.42.0 → npm 0.85.1

## 信号与观察（启发式）

- 质量两级分化仍在：A 级 1088 个 vs D 级 2863 个（C 级是主体 9311），生态"能跑但文档/发布不齐"的中段插件占比最高。
- 功能分类上「其它」最拥挤（8356 个），「文件浏览/预览」紧随其后——新插件建议差异化而非堆同质功能。
- 60 个插件没有 README、14004 个未发布 npm：这是最容易的"入门级改进"，也最影响被收录。
- curated 收录仍集中于少数头部（1150/25046），未收录中不少质量 A/B —— 详见站内「优质未收录」榜。
- 本周新增 9529 / 消失 0，见文末「本周快照 Diff」。

## 优质未收录 · 建议收录（Top 8，供作者与目录维护者）

- belowthetree/dsh-mcp-setting（A，★0，周下载 163）
- runcat-tommy/dsh-unitverse（A，★0，周下载 320）
- skyyyyyk/dsh-szg-hint（A，★0，周下载 93）
- zhz8888/dsh-android-emulator-helper（A，★3，周下载 625）
- zhz8888/dsh-ios-simulator-helper（A，★3，周下载 301）
- GallenShao/dsh-faster-compress（A，★1，周下载 331）
- HildebrandYu/dsh-open-with（A，★0，周下载 472）
- zhuweiyou/dsh-holdem（A，★1，周下载 164）

## 本期动作 & 社区行动

- 我们持续在做的：质量分级/打分明细/收录渠道矩阵/LLM 能力标注/每插件"致作者的信"；人工点评种子 5 条待校对。
- 给插件作者：站内可看自己与同类差距；想上榜就补 README/中文文档/npm 发布/进目录——每少一条扣分就离 A 近一步。
- 给 dsh 官方/社区：如果你希望某类能力得到生态补足或某插件进入官方视野，欢迎到仓库 issue 提需求；数据与管线完全开源可复核。

---

## 本周快照 Diff（基线 2026-10-15）

- 当前权威插件：**25046**（基线 15517 · 2026-10-15）
- 新增 9529 · 消失 0

### 新增（Top 15，按 ★）
- alchaincyf/nuwa-skill ★38349
- alchaincyf/huashu-design ★29576
- kingcharleslzy-ai/dsh-purge ★8732
- QingYunA/answer-me-with-html ★6339
- Ebony-Vinyl/EAC-design-world ★1541 (npm ✓)
- c1overzz/dsh-bili-scroll ★1415 (npm ✓)
- woniuniuniu/dsh-media-desk ★1389
- Alice-Marx/dsh-model-router ★961 (npm ✓)
- op7418/dsh-guizang-design ★922 (npm ✓)
- 6shenhonghong9/dsh-startup-screen ★847
- SAOS-3624/dsh-see-now ★661 (npm ✓)
- aureth-labs/dsh-aurabot-qq ★647
- ZSeven-W/dsh-game-studio ★562 (npm ✓)
- SAOS-3624/dsh-video-storyboard ★550 (npm ✓)
- XDTrees/dsh-xdpool ★531 (npm ✓)

### star 涨幅榜（同基线）
- Ebony-Vinyl/dsh-our-free-model：8876 → 75756（+66880）
- YuJunZhiXue/dsh-purge：4584 → 15339（+10755）
- dsh-market/dsh-market：6169 → 12524（+6355）
- elysia395/dsh-wallpaper-engine：1020 → 7076（+6056）
- T-Auto/dsh-ops：371 → 5843（+5472）
- mmparko/dsh-purge：0 → 5053（+5053）
- ranxianglei/billion-context：901 → 5170（+4269）
- bowenliang123/dsh-context：1995 → 5143（+3148）
- superdesigndev/treg：4986 → 8089（+3103）
- MeteorNOX/DeepSeek-Balance-Whale-Widget：4495 → 7246（+2751）

---

> 数据来源：GitHub 公开元数据 + npm registry；评估为启发式（非安全审计）。完整数据集 data/plugins.jsonl / csv，站点 https://dsh-insights.com/
> 周报与"致作者的信"由 DSH Insights 自动生成，欢迎转载（保留出处即可）。
