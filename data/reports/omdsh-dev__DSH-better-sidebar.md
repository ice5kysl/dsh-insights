# 致 DSH-better-sidebar 的作者：一期一会 · 体检与建议

> omdsh-dev/DSH-better-sidebar · 第 1 期（数据快照 2026-09-08）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 DSH-better-sidebar 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：S（100/100）· 在「侧栏 / 工作区」类 588 个插件里超过 99% 的同类（同类中位 80）**

- ★3339 · 开放的侧边栏底座，支持三方拓展注册新侧边栏页面。内置文件渲染编辑/终端/侧边对话/Git/子代理页面 ｜ Open sidebar foundation, supports third-party extensions to register new sidebar pages. Built-in file rende
- npm：`dsh-better-sidebar@0.18.0`（20 个版本）
- 周下载：**97317**
- 最近 push 2026-09-04 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、产物布局规范、files 白名单、npm 已发布、npm 版本同步、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「开放侧边栏底座，支持第三方注册页面；内置文件编辑、终端、对话、Git、子代理页面。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 2，按扣分权重）**：

1. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。
2. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**观察员的额外视角**（LLM 生成 · 仅供思路，不进分数）：

1. **声明 engines.dsh** —— 你是侧边栏类 588 个插件里被装得最多的底座型插件。dsh 0.1.2-rc 正在收紧 client 注入契约，在 package.json 声明 engines.dsh（如 "^0.1.1"）后，用户升级前就能在体检/详情页看到兼容信号，你的声明也会进入 compat.json 被全生态引用——一次声明，长期受益。
2. **把静默用户变成关注者** —— 周下载 97k 对 ★3339，下载/星比约 29:1，说明大量用户在静默使用。README 顶部放一张 30 秒演示 GIF + 健康徽章，比再加功能的转化效率高；另外建议把「第三方页面注册 API」的稳定性承诺写清楚（semver 或 deprecated 政策），底座型插件最缺的是让人敢在你上面盖房子。

**能力标签**：sidebar、registry、files、terminal、git、chat、agents；README 宣称：支持三方拓展注册新侧边栏页面；内置文件渲染编辑/终端/侧边对话/Git/子代理页面

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add omdsh-dev/DSH-better-sidebar to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-better-sidebar@0.18.0.
```

**一起共建**：这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue（规则书公开在 /about/，可复核可反驳）。dsh 里的「体检/查验/场景」插件 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit) 也在找第一批共建者：试用反馈、评分规则建议、PR 都欢迎。

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-08
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 作者自检 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`）· 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

