# 致 garmin-connect-plugin-for-dsh 的作者：一期一会 · 体检与建议

> Likenttt/garmin-connect-plugin-for-dsh · 第 1 期（数据快照 2026-09-08）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 garmin-connect-plugin-for-dsh 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：S（100/100）· 在「文件浏览 / 预览」类 881 个插件里超过 99% 的同类（同类中位 79）**

- ★11 · A TypeScript-based Garmin Connect plugin and MCP server with secure browser-based MFA, built for DeepSeek Harness and designed to work with other AI agents.
- npm：`dsh-plugin-garmin-connect@0.1.6`（8 个版本）
- 最近 push 2026-08-29 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「TypeScript实现的Garmin Connect插件及MCP服务器，支持浏览器MFA，兼容DeepSeek Harness及多种AI代理。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 2，按扣分权重）**：

1. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。
2. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**观察员的额外视角**（LLM 生成 · 仅供思路，不进分数）：

1. **声明 engines.dsh** —— 在 package.json 声明 engines.dsh（如 "^0.1.1"）后，你的兼容区间会进入 compat.json，用户升级 dsh 前即可看到兼容信号；生态刚立的约定，早声明早受益。
2. **把 MFA 门槛和 MCP 形态讲透** —— 浏览器 MFA 是这类插件最大的安装流失点——一段带截图的「3 步完成授权」指引能直接提升转化。另外你同时是 MCP server，README 里给一个其他 agent（如 Claude Desktop）的配置片段，受众就不止 dsh 用户了。

**能力标签**：typescript、mcp-server、mfa、fitness、ai-agent；README 宣称：TypeScript-based；MCP server；secure browser-based MFA；built for DeepSeek Harness

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add Likenttt/garmin-connect-plugin-for-dsh to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-plugin-garmin-connect@0.1.6.
```

**一起共建**：这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue（规则书公开在 /about/，可复核可反驳）。dsh 里的「体检/查验/场景」插件 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit) 也在找第一批共建者：试用反馈、评分规则建议、PR 都欢迎。

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-08
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 作者自检 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`）· 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

