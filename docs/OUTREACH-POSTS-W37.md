# W37 官宣外发帖（v0.2 · 2026-09-08 填数完毕，今天可发）

> 决策变更（2026-09-08）：不等周五——周报已连出 4 期、快照完整，**官宣帖今天发**；周五 W37 周报生成后在原帖下更新 3 个数字做二次触达（不另开帖）。发布链接回填 RESEARCH §决策日志。
> 结构遵循 OUTREACH §四：3 个数字 + 1 个 movers 看点 + 站点/RSS 链接，中立语气（数据说话，不拉踩）。

---

## 帖 1 · LINUX DO（社区向，中文）

**标题：DSH Insights：给 dsh 插件生态做了个「全量、可复核」的健康分观察站（附每周生态周报）**

正文：

大家好，我们给 DeepSeek Harness 插件生态做了个观察站 **DSH Insights**（dsh-insights.com），每周五发一期生态周报，已连出 4 期。

三个数字（快照 2026-09-08）：

- **权威插件 10,190 个**——对 13.7k 个 `dsh-plugin` topic 仓库 + 策展目录 + npm 映射共 14,239 个候选做 manifest 门禁逐条校验（`package.json` 声明 `dsh.bundle.patch` 且已提交），噪音全部分桶留痕
- **健康分 S–D 五档（health-v5）**：100 起扣、每条扣分带证据、缺数据不虚构不扣分、星数不进分；S+A 共 1,036 个（10.2%），全体均分 76。被扣最多的三项：76.4% 缺 client export（Web 端装不上）、58.1% 未发 npm、51.7% 缺中文文档
- **开放数据 13 个数据集**：insights.json 稳定 URL、schema 只增不改、CC BY 4.0，agent/目录/市场可直接消费

本周看点：**Buzzso/dsh-sev** 上架 12 天 136★ 且拿到 S 级 95 分；**Jimmy0123-ux/dsh-token-pet** 6 天 34★、S 级——新插件也可以又快又规范。

为什么做这个：topic 一个月冲到 1.3 万+，「找得到」已经被 awesome 和市场解决了，「**信得过**」（重复/弃维护/装不上/兼容风险）没人做——官方也明言不评判。我们只做这一层，不抢目录不抢市场。

插件作者可以：看自己插件的评分与扣分明细（`/p/<owner>/<repo>/`）、挂健康徽章（/badge/ 一键复制）、`npx dsh-insights-kit selfcheck <dir>` 本地自检（与线上同规则书）、修完 push 后到 Actions 自助重检（分钟级生效）。分数有异议提 issue 申诉，中英皆可。

普通用户可以在 dsh 里直接装 **dsh-insights-kit** 插件：「体检」看你已装插件的健康分，「查验」在安装前搜任意插件，「场景」按你要做的事推荐组合。

- 站点：https://dsh-insights.com （周报 /weekly/ · 插件库 /dashboard/ · 方法论 /about/）
- RSS：https://dsh-insights.com/feed.xml
- 开源管线（每个数字可复现）：https://github.com/ice5kysl/dsh-insights

---

## 帖 2 · GitHub Discussions（ice5kysl/dsh-insights，中英双语）

**Title: DSH Insights is live — an open, reproducible observatory for the dsh plugin ecosystem (weekly report every Friday, 4 issues out)**

**ZH:**
> DSH Insights（dsh-insights.com）上线：对 dsh 插件生态做**全量真伪校验 + 客观健康分（S–D，逐条证据）+ 官方动态 + 生态周报**。当前权威集 **10,190**（manifest 门禁，0 重复），S+A 1,036，开放数据 CC BY 4.0（insights.json 稳定 URL）。周报已连出 4 期，W37 本周五见。插件作者可申诉/纠错/自助重检（Actions → recheck），本地自检 `npx dsh-insights-kit selfcheck <dir>`。方法论全公开：/about/。

**EN:**
> DSH Insights (dsh-insights.com) is live: full-ecosystem authenticity gating + objective health scores (S–D, per-deduction evidence, no stars, no invented data) + official dynamics + a weekly report for the DeepSeek Harness plugin ecosystem. Authoritative set: **10,190** plugins (manifest-gated, 0 duplicates); S+A: 1,036; open data under CC BY 4.0 with a stable `insights.json` URL for agents/curators. Weekly every Friday — 4 issues already out. Plugin authors: check `/p/<owner>/<repo>/`, appeal via issues (ZH/EN), self-check locally with `npx dsh-insights-kit selfcheck <dir>`, or trigger a re-check from Actions.
>
> Why: the topic hit 13.7k repos in a month — discovery is solved, **trust isn't**. We only build that layer. Site · RSS · full open-source pipeline: https://github.com/ice5kysl/dsh-insights

---

## 发布后（5 分钟）

1. 两个帖子的链接回填本文件顶部 + `docs/RESEARCH.md` §决策日志（「W37 外发：LINUX DO __ / Discussions __」）
2. 周五 W37 周报帖发出后，带链接跟进 #4399
3. Umami 面板标记发布日（之后看曲线）

## 发布记录

- （待回填）
