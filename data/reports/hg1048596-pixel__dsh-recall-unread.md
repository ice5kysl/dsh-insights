# 致 dsh-recall-unread 的作者：一期一会 · 体检与建议

> hg1048596-pixel/dsh-recall-unread · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-recall-unread 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（82/100）· 在「记忆 / 知识」类 135 个插件里超过 38% 的同类（同类中位 83）**

- ★124 · DeepSeek Harness (DSH) 插件：在模型读取前撤回已发送的文字消息，支持单条与全部撤回。A DeepSeek Harness plugin that recalls sent-but-unread text messages before the model reads them — one-by-o
- npm：`dsh-recall-unread@1.1.0`（1 个版本）
- 周下载：**71**
- 最近 push 2026-08-19 · 收录：awesome — · imsai —

**做得好的**：files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「在模型读取前撤回已发送的未读文字消息，支持单条和全部撤回。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。
3. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。

其次还可以考虑：提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：recall、unread、message、undo；README 宣称：在模型读取前撤回已发送的文字消息；支持单条撤回；支持全部撤回

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add hg1048596-pixel/dsh-recall-unread to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-recall-unread@1.1.0.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

