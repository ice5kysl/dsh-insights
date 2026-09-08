# 致 dsh-rewind 的作者：一期一会 · 体检与建议

> SiriLee/dsh-rewind · 第 1 期（数据快照 2026-09-08）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-rewind 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：S（100/100）· 在「侧栏 / 工作区」类 588 个插件里超过 99% 的同类（同类中位 80）**

- ★37 · DSH 插件：真正便捷无感的同窗口内对话回退，从不新建分支；自带轻量工作区备份，可一并还原文件（完整 Claude Code /rewind 语义）。 · DSH plugin: genuinely effortless in-window conversation rewind — never forking a n
- npm：`dsh-rewind-plugin@0.7.5`（39 个版本）
- 最近 push 2026-09-05 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「同窗口内回退对话，不新建分支；自带轻量工作区备份，可还原文件，完整/rewind语义。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 2，按扣分权重）**：

1. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。
2. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**观察员的额外视角**（LLM 生成 · 仅供思路，不进分数）：

1. **声明 engines.dsh** —— 在 package.json 声明 engines.dsh（如 "^0.1.1"）后，你的兼容区间会进入 compat.json，用户升级 dsh 前即可看到兼容信号；rewind 涉及会话层面操作，兼容区间声明对你的用户尤其重要。
2. **把「不新建分支」和「安全边界」写成招牌** —— 「同窗口回退、从不新建分支」是与同类 rewind 的关键差异，建议 README 开头一张 3 行对比表说清；rewind 会动会话与工作区，把「轻量备份如何还原文件、什么不会被还原」写成一节安全边界，安装信任会明显提升。

**能力标签**：rewind、backup、restore、no-fork、session；README 宣称：in-window conversation rewind；never forking a new session；lightweight workspace backup；restores files together with the rewind

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add SiriLee/dsh-rewind to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-rewind-plugin@0.7.5.
```

**一起共建**：这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue（规则书公开在 /about/，可复核可反驳）。dsh 里的「体检/查验/场景」插件 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit) 也在找第一批共建者：试用反馈、评分规则建议、PR 都欢迎。

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-08
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 作者自检 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`）· 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

