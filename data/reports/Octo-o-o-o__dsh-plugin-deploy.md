# 致 dsh-plugin-deploy 的作者：一期一会 · 体检与建议

> Octo-o-o-o/dsh-plugin-deploy · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-plugin-deploy 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（88/100）· 在「其它」类 1279 个插件里超过 73% 的同类（同类中位 83）**

- ★2 · DeepSeek Harness 插件：一句话把项目部署到 Cloudflare，一句话把插件发布到 npm。零账号也能拿到线上地址；凭据模型看不到。
- npm：`dsh-plugin-deploy@0.1.3`（4 个版本）
- 最近 push 2026-09-04 · 收录：awesome-dsh-plugin ✅ · imsai —

**做得好的**：files 白名单、npm 已发布、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「一句话部署到Cloudflare并发布npm插件，无需账号即可获得线上地址。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **同步 npm 版本** —— 避免商店展示旧版（也可能是包名抢注，需核查）。怎么做：把仓库当前版本发到 npm。
3. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。

其次还可以考虑：提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：cloudflare、npm、deploy、publish、zero-account；README 宣称：支持一句话将项目部署到Cloudflare；支持一句话将插件发布到npm；零账号也能拿到线上地址；凭据模型看不到

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add Octo-o-o-o/dsh-plugin-deploy to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-plugin-deploy@0.1.3.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

