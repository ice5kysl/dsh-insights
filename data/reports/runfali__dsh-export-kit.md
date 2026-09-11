# 致 dsh-export-kit 的作者：一期一会 · 观测分享

> runfali/dsh-export-kit · 第 1 期（数据快照 2026-09-11）

你好！我们是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）**——一个对 dsh 插件生态做公开观测的小项目。这封信把我们采集到的关于 dsh-export-kit 的公开数据和一些不成熟的想法分享给你，**仅供参考，不构成任何要求**；说得不对的地方欢迎直接指出（评分规则公开在 [About](https://dsh-insights.com/about/)，可复核可反驳）。

**我们的启发式模型给当前状态的读数：B（76/100）** · 在「文件浏览 / 预览」类 910 个插件的分布里大致位于前列（同类中位 79）。模型只看公开信号（文档/发布/维护节奏等），读不出插件的真实质量——它更适合用来发现「可能被忽略的细节」，而不是下结论。

- ★1 · dsh 对话导出套件：一键将对话导出为 Markdown / TXT / JSON / CSV / PNG 长图 / PDF，附公式复制（LaTeX / MathML / Word 兼容）、设置备份与全会话归档。零侵入 bundle 插件，不改 Harness 源码。
- npm：尚未发布
- 最近 push 2026-08-24

以下几项检查未发现问题（仅作记录）：client 导出齐备、产物布局规范、files 白名单、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃；按 README 解读，主要能力是「一键将对话导出为多种格式，支持公式复制与设置备份的零侵入插件。」。

**如果只看几点，这些可能值得留意**（按模型权重排序，均为建议，是否采纳完全由你）：

1. **尚未发布到 npm** —— 一键安装和商店收录都以 npm 为前提。参考做法：npm publish（先查包名是否被占用）。

**能力标签**：export、markdown、pdf、json、csv、latex、backup、archive；README 宣称：支持导出6种格式（Markdown/TXT/JSON/CSV/PNG/PDF）；公式复制支持LaTeX/MathML/Word兼容；零侵入bundle插件不改Harness源码；附设置备份与全会话归档功能

> 后续：我们每周做一次全生态观测，下期会附上与本期对比的变化。**如果这类信件对你构成打扰，回复一声即可，我们此后不再发送到贵仓库。**

这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue。我们也写了一个 dsh 内的自检小工具 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`），觉得有用可以试试，没用也请忽略。

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-11
> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

