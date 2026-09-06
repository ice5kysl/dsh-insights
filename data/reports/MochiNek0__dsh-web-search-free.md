# 致 dsh-web-search-free 的作者：一期一会 · 体检与建议

> MochiNek0/dsh-web-search-free · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-web-search-free 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：S（98/100）· 在「搜索 / 命令面板」类 272 个插件里超过 98% 的同类（同类中位 85）**

- ★6 · 面向 DeepSeek Harness 的免费 Web Search 插件，支持 Tavily、Exa、Brave 等八个引擎按可配置顺序自动 fallback
- npm：`dsh-web-search-free@1.3.0`（7 个版本）
- 最近 push 2026-08-28 · 收录：awesome-dsh-plugin ✅ · imsai —

**做得好的**：client 导出齐备、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「DeepSeek Harness的免费网页搜索插件，支持八个引擎可配置顺序自动回退。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 2，按扣分权重）**：

1. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。
2. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**能力标签**：search、web、fallback、tavily、exa、brave；README 宣称：支持Tavily、Exa、Brave等八个引擎；可配置顺序自动fallback

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add MochiNek0/dsh-web-search-free to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-web-search-free@1.3.0.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

