# 致 sandbase-harness 的作者：一期一会 · 体检与建议

> sandbaseai/sandbase-harness · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 sandbase-harness 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（86/100）· 在「会话管理」类 423 个插件里超过 61% 的同类（同类中位 83）**

- ★642 · Local-first, self-hosted AI agent runtime and MCP bridge with sandboxed sessions, memory, credentials, audit/replay, and a local Console.
- npm：`managed-agents@0.0.1`（1 个版本）
- 周下载：**74**
- 最近 push 2026-08-31 · 收录：awesome — · imsai ✅

**做得好的**：files 白名单、npm 已发布、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「本地优先、自托管的AI代理运行时与MCP桥，提供沙箱会话、记忆、凭据和审计/重放及本地控制台。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **同步 npm 版本** —— 避免商店展示旧版（也可能是包名抢注，需核查）。怎么做：把仓库当前版本发到 npm。
3. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。

其次还可以考虑：提交 awesome-dsh-plugin（上架主目录（曝光+反链））。

**能力标签**：local、selfhost、mcp、sandbox、memory、creds、audit、console；README 宣称：本地优先自托管；提供MCP桥接；沙箱会话；含记忆、凭据、审计/重放及本地控制台

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add sandbaseai/sandbase-harness to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as managed-agents@0.0.1.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

