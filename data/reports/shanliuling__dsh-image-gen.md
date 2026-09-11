# 致 dsh-image-gen 的作者：一期一会 · 观测分享

> shanliuling/dsh-image-gen · 第 1 期（数据快照 2026-09-11）

你好！我们是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）**——一个对 dsh 插件生态做公开观测的小项目。这封信把我们采集到的关于 dsh-image-gen 的公开数据和一些不成熟的想法分享给你，**仅供参考，不构成任何要求**；说得不对的地方欢迎直接指出（评分规则公开在 [About](https://dsh-insights.com/about/)，可复核可反驳）。

**我们的启发式模型给当前状态的读数：S（100/100）** · 在「模型 / 代理」类 991 个插件的分布里大致位于前列（同类中位 79）。模型只看公开信号（文档/发布/维护节奏等），读不出插件的真实质量——它更适合用来发现「可能被忽略的细节」，而不是下结论。

- ★399 · AI image studio for DeepSeek Harness — generate, edit & compare images in chat, with 500+ prompts, gallery, multi-model workflows and ComfyUI.
- npm：`dsh-image-gen@0.4.0`（18 个版本）
- 周下载：**1307**
- 最近 push 2026-09-11

以下几项检查未发现问题（仅作记录）：client 导出齐备、产物布局规范、files 白名单、npm 已发布、npm 版本同步、README 齐备、中文/双语文档、LICENSE、dsh-plugin topic、已度过新仓观察期、近期活跃；按 README 解读，主要能力是「AI图像工作室，聊天中生成、编辑和对比图片，含500+提示词、画廊和多模型工作流。」。

本期观测没有发现明显的短板信号。

**观察员的额外视角**（LLM 生成 · 仅供思路，不进分数）：

1. **声明 engines.dsh** —— 在 package.json 声明 engines.dsh（如 "^0.1.1"）后，你的兼容区间会进入 compat.json，用户升级 dsh 前即可看到兼容信号；这是生态刚立的约定，早声明的插件在详情页会展示更完整的兼容行。
2. **把 500+ prompts 变成可检索资产** —— 提示词库是你的内容壁垒——单独导出成 JSON 或目录页，用户能检索、别人能引用；多模型 + ComfyUI 工作流是差异化卖点，README 里用一张「同提示词多模型对比图」比文字有说服力得多。

**能力标签**：image-gen、image-edit、compare、gallery、comfyui、multi-model、prompts；README 宣称：500+ prompts；支持ComfyUI；支持multi-model workflows；支持gallery

> 后续：我们每周做一次全生态观测，下期会附上与本期对比的变化。**如果这类信件对你构成打扰，回复一声即可，我们此后不再发送到贵仓库。**

这封信由开源管线自动生成——分数有误、建议不对路，直接回复本 issue 或到 [dsh-insights](https://github.com/ice5kysl/dsh-insights) 提 issue。我们也写了一个 dsh 内的自检小工具 [dsh-insights-kit](https://github.com/ice5kysl/dsh-insights-kit)（`npx dsh-insights-kit selfcheck <dir>`），觉得有用可以试试，没用也请忽略。

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-11
> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

