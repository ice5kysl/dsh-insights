# 致 dsh-deepseek-usage 的作者：一期一会 · 体检与建议

> mmzm0808/dsh-deepseek-usage · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-deepseek-usage 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（84/100）· 在「状态 / 监控 / 用量」类 359 个插件里超过 49% 的同类（同类中位 84）**

- ★10 · DeepSeek API 用量监测 DSH 插件：悬浮球 + 展开面板，展示开放平台真实余额、累计消费、今日消费、请求次数、Tokens 与分模型用量，支持手动登录获取 userToken。
- npm：`dsh-deepseek-usage@0.1.0`（1 个版本）
- 最近 push 2026-09-02 · 收录：awesome — · imsai —

**做得好的**：client 导出齐备、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「DeepSeek API用量监测插件：悬浮球/面板显示余额、消费、请求数、Tokens与分模型用量，支持手动登录。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 LICENSE** —— 开源可信度。怎么做：加 MIT LICENSE 文件并在 package.json 声明 license。
2. **main 对齐 lib/index.js** —— 产物布局符合官方 bundle 惯例。怎么做：调整 package.json main 或产物目录。
3. **提交 awesome-dsh-plugin** —— 上架主目录（曝光+反链）。怎么做：data/plugins/<owner>__<repo>.yml 提 PR。

其次还可以考虑：提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：usage、monitor、floating-ball、dashboard、tokens、balance、per-model；README 宣称：显示真实余额；累计消费；今日消费；请求次数

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add mmzm0808/dsh-deepseek-usage to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-deepseek-usage@0.1.0.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

