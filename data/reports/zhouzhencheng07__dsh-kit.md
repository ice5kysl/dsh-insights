# 致 dsh-kit 的作者：一期一会 · 体检与建议

> zhouzhencheng07/dsh-kit · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-kit 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：B（83/100）· 在「文件浏览 / 预览」类 462 个插件里超过 40% 的同类（同类中位 84）**

- ★5 · Page capability kit for DeepSeek Harness (dsh): terminal dock, file tree, source control, skills manager, phone access, background jobs and keyless web search i
- npm：`dsh-kit@0.2.1`（3 个版本）
- 最近 push 2026-09-04 · 收录：awesome — · imsai —

**做得好的**：files 白名单、npm 已发布、README 齐备、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「为DSH浏览器界面提供终端、文件树、源码控制、技能管理、电话访问、后台任务和无密钥网页搜索能力。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
2. **同步 npm 版本** —— 避免商店展示旧版（也可能是包名抢注，需核查）。怎么做：把仓库当前版本发到 npm。
3. **补充中英/双语文档** —— 中文生态第一印象。怎么做：加 README.zh-CN.md 并与英文版互链。

其次还可以考虑：main 对齐 lib/index.js（产物布局符合官方 bundle 惯例）；提交 awesome-dsh-plugin（上架主目录（曝光+反链））；提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：terminal、file-tree、source-control、skills、phone-access、background-jobs、web-search、browser-ui；README 宣称：Provides terminal dock；Provides file tree；Provides source control；Provides skills manager

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add zhouzhencheng07/dsh-kit to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2, published as dsh-kit@0.2.1.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

