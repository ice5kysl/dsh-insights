# 致 dsh-starter-zh 的作者：一期一会 · 体检与建议

> 863683348/dsh-starter-zh · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-starter-zh 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：A（93/100）· 在「开发 / 数据」类 147 个插件里超过 90% 的同类（同类中位 83）**

- ★1 · DSH 新手入门包：安装即得欢迎语、从 0 到 1 学习路径、按场景推荐插件、新手自查清单，并与 dsh-handbook-zh 中文教程联动。Starter pack for DeepSeek Harness beginners (Chinese).
- npm：`dsh-starter-zh@0.1.0`（1 个版本）
- 最近 push 2026-08-19 · 收录：awesome-dsh-plugin ✅ · imsai —

**做得好的**：产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「DSH中文新手包：欢迎语、学习路径、场景推荐、自查清单，联动中文手册。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 2，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**能力标签**：starter、guide、zh、check；README 宣称：安装即得欢迎语；提供从0到1学习路径；按场景推荐插件；提供新手自查清单

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add 863683348/dsh-starter-zh to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-starter-zh@0.1.0.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

