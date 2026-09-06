# 致 dsh-vision-proxy 的作者：一期一会 · 体检与建议

> Flyvhidbwo/dsh-vision-proxy · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-vision-proxy 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（88/100）· 在「其它」类 1279 个插件里超过 73% 的同类（同类中位 83）**

- ★15 · DeepSeek Harness 插件：DeepSeek Pro 大脑 + 自动识图。GUI 附加图片默认经官方 deepseek-v4-flash-vision-exp 原生识图，转译成文字后交给 DeepSeek 作答（纯文本的 V4-Pro 也能看图）；支持百炼/智谱/OpenRouter 等任意 OpenAI 
- npm：`dsh-vision-proxy@0.4.1`（21 个版本）
- 最近 push 2026-08-26 · 收录：awesome-dsh-plugin ✅ · imsai —

**做得好的**：产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「图片经视觉模型转成文字后交给DeepSeek，让纯文本模型也能识图；支持OpenAI兼容接口，无Key时自动探测Ollama。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **补充中英/双语文档** —— 中文生态第一印象。怎么做：加 README.zh-CN.md 并与英文版互链。
3. **提交 imsai/deepseek1024** —— 覆盖另一主流渠道。怎么做：catalog/plugins JSON，一个 PR 一条。

**能力标签**：vision、proxy、image、vlm、ollama、deepseek；README 宣称：uses official deepseek-v4-flash-vision-exp for image recognition by default；converts images to text before answering；enables pure-text V4-Pro to handle images；supports OpenAI-compatible VLMs such as Bailian/Zhipu/OpenRouter

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add Flyvhidbwo/dsh-vision-proxy to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-vision-proxy@0.4.1.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

