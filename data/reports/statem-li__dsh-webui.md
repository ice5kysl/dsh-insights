# 致 dsh-webui 的作者：一期一会 · 体检与建议

> statem-li/dsh-webui · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-webui 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（76/100）· 在「文件浏览 / 预览」类 462 个插件里超过 10% 的同类（同类中位 84）**

- ★17 · DeepSeek Harness 会话增强全家桶：定时自动化任务引擎（cron 调度·绑定模型真实执行·Agent 建议确认）、会话产物卡片、对话退回与文件回退/修改历史对比、视图图块与消息导航、工具调用聚合、Markdown 渲染、模型推理等级同步与 Developer Role 兼容检测、AnySearch 网页搜
- npm：尚未发布
- 最近 push 2026-08-27 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、files 白名单、npm 版本同步、README 齐备、中文/双语文档、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「会话增强全家桶：定时任务、产物卡片、回退/文件对比、搜索记忆、用量管理等。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **发布到 npm** —— 一键安装与进商店的前提。怎么做：npm publish（先查包名是否被占用）。
2. **补 LICENSE** —— 开源可信度。怎么做：加 MIT LICENSE 文件并在 package.json 声明 license。
3. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。

其次还可以考虑：提交 awesome-dsh-plugin（上架主目录（曝光+反链））；提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：cron、rollback、filediff、search、memory、budget、skills、browser；README 宣称：cron scheduling with real model execution and agent suggested confirmation；session artifact cards；conversation rollback and file revert/history diff；tool call aggregation

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add statem-li/dsh-webui to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

