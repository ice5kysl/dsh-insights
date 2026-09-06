# 致 dsh-code 的作者：一期一会 · 体检与建议

> UNLINEARITY/dsh-code · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-code 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（88/100）· 在「主题 / 视觉美化」类 200 个插件里超过 71% 的同类（同类中位 81）**

- ★33 ·  Claude-Code-style TUI bundle for DeepSeek Harness. 充分结合 DSH 的核心机制和高级特性与Codex CLI 、Claude Code 等主流交互机制，打造的 DSH-Code. （对齐DSH官方上游最新版本！持续更新中！支持DSH 特殊模式，插件系统，模型管理，子
- npm：`dsh-code@1.0.3`（15 个版本）
- 最近 push 2026-08-31 · 收录：awesome — · imsai —

**做得好的**：files 白名单、npm 已发布、npm 版本同步、README 齐备、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「类Claude Code的DSH TUI工具集，支持特殊模式、插件、模型/子代理管理及动画，1.0起自迭代。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **补充中英/双语文档** —— 中文生态第一印象。怎么做：加 README.zh-CN.md 并与英文版互链。
3. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。

其次还可以考虑：提交 awesome-dsh-plugin（上架主目录（曝光+反链））；提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：TUI、agent、models、subagent、plugins、modes、animate；README 宣称：Aligns to official DSH upstream and is constantly updated；Supports DSH special modes, plugin system, model and subagent management, and model-switch animations；Since v1.0.0, code is self-iterated by DSH-Code without external agents/CLIs

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add UNLINEARITY/dsh-code to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-code@1.0.3.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

