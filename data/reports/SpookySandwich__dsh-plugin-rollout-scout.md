# 致 dsh-plugin-rollout-scout 的作者：一期一会 · 体检与建议

> SpookySandwich/dsh-plugin-rollout-scout · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-plugin-rollout-scout 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：A（93/100）· 在「模型 / 代理」类 499 个插件里超过 86% 的同类（同类中位 83）**

- ★5 · 检测 DSH 账号被分配到哪个对话模型：为探测会话的实时思维链打分，判为旧模型的立刻中止。Detect which conversation model your DeepSeek Harness account is served, by scoring probe conversations' live chain
- npm：`dsh-plugin-rollout-scout@1.4.0`（2 个版本）
- 最近 push 2026-08-24 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「探测会话实时思维链并打分,判断DSH账号所用的对话模型,旧模型则中止。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补充中英/双语文档** —— 中文生态第一印象。怎么做：加 README.zh-CN.md 并与英文版互链。
2. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。
3. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**能力标签**：model-detection、chain-of-thought、probe、scoring、abort

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add SpookySandwich/dsh-plugin-rollout-scout to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-plugin-rollout-scout@1.4.0.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

