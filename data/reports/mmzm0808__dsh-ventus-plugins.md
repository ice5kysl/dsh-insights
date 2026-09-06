# 致 dsh-ventus-plugins 的作者：一期一会 · 体检与建议

> mmzm0808/dsh-ventus-plugins · 第 1 期（数据快照 2026-09-06）

你好！我是 **DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com）** 的自动观测员。这封信聊聊 dsh-ventus-plugins 当前的状态，以及本期最值得动手的几件事——数据先行，绝无恭维。

**本期概览：C（69/100）· 在「消息 / 协作集成」类 176 个插件里超过 2% 的同类（同类中位 84）**

- ★10 · DSH 自装插件整合包：把 11 个自装插件合并成单一安装项。内含终末地工业编辑部风主题（等高线背景、ENDFIELD 水印、玻璃/纯色侧边栏表面）、用量悬浮球与日/月/年热力图、右侧重栏（文件树/编辑器/终端/Git）、多引擎搜索、3D 虎鲸桌宠、子代理进度、悬浮侧边栏、提示词优化浮窗、UA 中继反代。所有功能与设置
- npm：尚未发布
- 最近 push 2026-09-02 · 收录：awesome — · imsai —

**做得好的**：files 白名单、npm 版本同步、README 齐备、中文/双语文档、已度过新仓观察期、近期活跃 等检查全部通过；按 README 解读，主要能力是「11款自装插件合集，含主题、热力图、搜索、桌宠、进度、UA中继，可单独安装。」。这些是你的基本盘，保持即可。

**本期最值得做（Top 3，按扣分权重）**：

1. **发布到 npm** —— 一键安装与进商店的前提。怎么做：npm publish（先查包名是否被占用）。
2. **补 client 导出** —— GUI 能力才能被 dsh 加载（TUI/CLI 类插件可忽略）。怎么做：按官方 bundle 规范补 exports["./client"]。
3. **补 LICENSE** —— 开源可信度。怎么做：加 MIT LICENSE 文件并在 package.json 声明 license。

其次还可以考虑：打 dsh-plugin topic（官方唯一的发现机制）；main 对齐 lib/index.js（产物布局符合官方 bundle 惯例）；提交 awesome-dsh-plugin（上架主目录（曝光+反链））；提交 imsai/deepseek1024（覆盖另一主流渠道）。

**能力标签**：bundle、theme、heatmap、search、pet、sidebar、subagent、relay；README 宣称：11个自装插件合并成单一安装项；所有功能与设置原样保留；每个模块都支持单独安装

> 注：本期是基线首期。之后每期我们会对比上一期，告诉你分数/名次/收录/下载的**变化**。

**想被更多人看到？** 下面这段可直接复制去提交收录：

```text
Add mmzm0808/dsh-ventus-plugins to the DSH plugin directory (category ui) — a standard Cordis "bundle" plugin targeting @deepseek-ai/dsh ≥ 0.1.1-rc.2.
```

---

> 由 DSH Insights · DeepSeek Harness 全景观察站（dsh-insights.com） 自动生成 · 数据快照 2026-09-06
> 开源管线 [dsh-insights](https://github.com/ice5kysl/dsh-insights) · 每插件体检 [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health) · 示例页 https://dsh-insights.com/
> 我们每周还产出**全生态周报**（data/weekly/）——想让你的插件进『优质未收录』观察名单，或想投稿/上榜，欢迎来仓库提 issue/PR。

> 注：本报告为启发式数据初稿，非安全审计；打分 100 起扣四档（fail −20 / 较重 −10 / 中 −5 / 轻 −2），阈值 S≥95 · A≥90 · B≥75 · C≥60。

