# 致 dsh-llm-retry-settings 的作者：一期一会 · 体检与建议

> zeng6125-rgb/dsh-llm-retry-settings · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-llm-retry-settings 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：A（91/100）· 在「状态 / 监控 / 用量」类 359 个插件里超过 83% 的同类（同类中位 84）**

- ★4 · DSH 插件：LLM 自动重试设置卡片——重试次数/退避/抖动与 25 个错误码可勾选，回答被输出 token 上限截断时还能自动续写，改完实时生效。
- npm：`dsh-llm-retry-settings@0.1.8`（5 个版本）
- 最近 push 2026-09-04 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「LLM重试设置卡片：重试次数/退避/抖动，25个错误码可勾选，截断自动续写，实时生效。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 2，按扣分权重）**：

1. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。
2. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**能力标签**：retry、backoff、jitter、codes、continue；README 宣称：25个错误码可勾选；回答截断时自动续写；修改实时生效

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add zeng6125-rgb/dsh-llm-retry-settings to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-llm-retry-settings@0.1.8.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

