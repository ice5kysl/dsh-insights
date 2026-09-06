# W37 官宣外发帖 · 草稿（2026-09-06 备好，周五发布前替换占位符）

> 用法：周五 CI 出 W37 后（~11:07），打开 `data/weekly/LATEST.md` 把 3 个数字与 movers 看点替换进正文（标 `【】` 的都是占位符），语气按平台微调后发布。发布链接回填 RESEARCH §决策日志。
> 结构遵循 OUTREACH §四：3 个数字 + 1 个 movers 看点 + 站点/RSS 链接，中立语气（数据说话，不拉踩）。

---

## 帖 1 · LINUX DO（社区向，中文）

**标题：DSH Insights 上线：给 dsh 插件生态做了个「全量、可复核」的健康分观察站**

正文：

大家好，我们给 DeepSeek Harness 插件生态做了个观察站 **DSH Insights**（dsh-insights.com），这周起每周五发一期生态周报。

三个数字（快照 2026-09-06）：

- **权威插件 9,141 个**——对 13,694 个 `dsh-plugin` topic 仓库 + 策展目录 + npm 映射做 manifest 门禁逐条校验（`package.json` 声明 `dsh.bundle.patch` 且已提交），噪音全部分桶留痕
- **健康分 S–D 五档（health-v4）**：100 起扣、每条扣分带证据、缺数据不虚构不扣分、星数不进分；S+A 共 935 个
- **开放数据 11 个数据集**：insights.json 稳定 URL、schema 只增不改、CC BY 4.0，agent/目录/市场可直接消费

本周看点：【W37 movers——star 跳涨/新晋 S 级的 1-2 个插件，从 LATEST.md 抄】

为什么做这个：topic 一个月冲到 1.3 万+，「找得到」已经被 awesome 和市场解决了，「**信得过**」（重复/弃维护/装不上/兼容风险）没人做——官方也明言不评判。我们只做这一层，不抢目录不抢市场。

插件作者可以：看自己插件的评分与扣分明细（`/p/<owner>/<repo>/`）、挂健康徽章、分数有异议提 issue 申诉（中英皆可）、数据更新了可以自助触发重检。

- 站点：https://dsh-insights.com （周报 /weekly/ · 插件库 /dashboard/ · 方法论 /about/）
- RSS：https://dsh-insights.com/feed.xml
- 开源管线（每个数字可复现）：https://github.com/ice5kysl/dsh-insights

---

## 帖 2 · GitHub Discussions（ice5kysl/dsh-insights，中英双语）

**Title: DSH Insights is live — an open, reproducible observatory for the dsh plugin ecosystem (weekly report #2 out Friday)**

**ZH:**
> DSH Insights（dsh-insights.com）上线：对 dsh 插件生态做**全量真伪校验 + 客观健康分（S–D，逐条证据）+ 官方动态 + 生态周报**。当前权威集 **9,141**（manifest 门禁，0 重复），S+A 935，开放数据 CC BY 4.0（insights.json 稳定 URL）。每周五出周报，本周为第 2 期对外。插件作者可申诉/纠错/自助重检。方法论全公开：/about/。

**EN:**
> DSH Insights (dsh-insights.com) is live: full-ecosystem authenticity gating + objective health scores (S–D, per-deduction evidence, no stars, no invented data) + official dynamics + a weekly report for the DeepSeek Harness plugin ecosystem. Authoritative set: **9,141** plugins (manifest-gated, 0 duplicates); S+A: 935; open data under CC BY 4.0 with a stable `insights.json` URL for agents/curators. Weekly every Friday — issue #2 lands this week. Plugin authors: check `/p/<owner>/<repo>/`, appeal via issues (ZH/EN), or trigger a re-check from Actions.
>
> Why: the topic hit 13.7k repos in a month — discovery is solved, **trust isn't**. We only build that layer. Site · RSS · full open-source pipeline: https://github.com/ice5kysl/dsh-insights

---

## 发布后（5 分钟）

1. 两个帖子的链接回填本文件顶部 + `docs/RESEARCH.md` §决策日志（「W37 外发：LINUX DO __ / Discussions __」）
2. #4399 跟进帖可引用本帖链接
3. Umami 面板标记发布日（之后看曲线）
