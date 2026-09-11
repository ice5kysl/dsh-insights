# 致 dsh-stock-terminal 的作者：一期一会 · 观测分享

> linhut/dsh-stock-terminal · 第 1 期（数据快照 2026-09-11）

你好！我们是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）**——一个对 dsh 插件生态做公开观测的小项目。这封信把我们采集到的关于 dsh-stock-terminal 的公开数据和一些不成熟的想法分享给你，**仅供参考，不构成任何要求**；说得不对的地方欢迎直接指出（评分规则公开在 [About](https://dsh-insights.com/about/)，可复核可反驳）。

**我们的启发式模型给当前状态的读数：B（76/100）** · 在「开发 / 数据」类 318 个插件的分布里大致位于前列（同类中位 78）。模型只看公开信号（文档/发布/维护节奏等），读不出插件的真实质量——它更适合用来发现「可能被忽略的细节」，而不是下结论。

- ★7 · 股市行情皮肤+功能插件：DSH Web GUI 全局交易终端视觉 + 实时行情面板（A股/港股/美股/加密/外汇），自选跑马灯、首字母模糊搜索、持仓盈亏管理
- npm：尚未发布
- 最近 push 2026-09-08

以下几项检查未发现问题（仅作记录）：产物布局规范、files 白名单、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃；按 README 解读，主要能力是「股市终端皮肤及实时行情插件：覆盖多市场，含自选跑马灯、模糊搜索和持仓盈亏管理。」。

**如果只看几点，这些可能值得留意**（按模型权重排序，均为建议，是否采纳完全由你）：

1. **尚未发布到 npm** —— 一键安装和商店收录都以 npm 为前提。参考做法：npm publish（先查包名是否被占用）。
2. **未声明 client 导出** —— GUI 能力无法被 dsh web 加载（TUI/CLI 类插件可忽略）。参考做法：按官方 bundle 规范补 exports["./client"]。

**能力标签**：stock-terminal、realtime-quotes、multi-market、watchlist、fuzzy-search、portfolio-pnl、gui-skin；README 宣称：提供DSH Web GUI全局交易终端视觉；实时行情面板覆盖A股/港股/美股/加密/外汇；支持自选跑马灯；支持首字母模糊搜索

> 后续：我们每周做一次全生态观测，下期会附上与本期对比的变化。**如果这类信件对你构成打扰，回复一声即可，我们此后不再发送到贵仓库。**

这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue。我们也写了一个 dsh 内的自检小工具 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`），觉得有用可以试试，没用也请忽略。

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-11
> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

