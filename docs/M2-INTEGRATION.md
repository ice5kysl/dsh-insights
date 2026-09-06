# M2 集成提案：给 awesome-dsh-plugin / dsh-market 的健康分数据层

> 状态：草案 v1 · 2026-09-05 · 提议对象：[awesome-dsh-plugin org](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（收录注册表 / awesome-dsh-plugin.com）与 [dsh-market](https://github.com/dsh-market/dsh-market)（应用内市场，消费其 plugins.json）。本文件也是 PR/Discussions 的草稿与决策日志模板。

## 一句话提案

> 让 **dsh-insights 的健康分（health-v1）**成为权威目录与市场卡片上的可选质量字段/收录门槛——数据开源、规则透明、每周刷新、**纯客观、非安全审计**。不抢你们的收录权，只提供"卡片上那个分数"。

## 背景（为什么现在提）

- `dsh-plugin` topic 已 13,600+ 仓库，权威目录 3,159 条（成立不足 4 周、~58 条/天净增），中位 ★3、仅 47% 发布 npm、头部被 monorepo 子路径污染。
- 贵方 README 明言 *"This list doesn't rank plugins or judge their quality, and we don't want to"*，且声明非安全审查——**质量评级这一层你们主动让出了**。我们恰好只做这一层，与你们零冲突。
- 全生态至今没有任何客观健康分；最接近的 DshMarketPlace 只判"可安装性"且覆盖有限。

## 我们的数据怎么来的（可复核性）

1. **全量抓取**：`topic:dsh-plugin` created 时间窗分片全量（13,583 / 13,600，2026-09-05 实测），规避 GitHub 1000/查询封顶。
2. **真伪判定**：manifest 门禁——非 fork/归档 + `package.json` 声明 `dsh.bundle.patch` + patch 文件已提交 → `data/plugins.jsonl`（权威集）。
3. **健康分 health-v1**：纯客观 11 条规则（manifest/npm/docs/repo/activity），从 100 扣分（warn −5 / fail −20），**每条扣分带证据值**，缺失数据不虚构不扣分，星数不进分。
4. **校准回归**：15 条已知真/假 seeds，`npm run regress` 每次跑批必过（当前 15/15）。
5. 规则升版必须 bump `RULE_VERSION` + changelog（docs/schema.md §health）；已注明 TUI/CLI 类插件的 client-export 误伤 caveat 与申诉通道。

## 数据契约（join key = `owner/name`，与贵方 plugins.json 对齐）

示例（形状取自本机已校验插件，正式文件见仓库 `data/insights.json`，MIT 开放）：

```jsonc
{
  "full_name": "omdsh-dev/DSH-better-sidebar",   // == plugins.json 的 owner + "/" + name
  "url": "https://github.com/omdsh-dev/DSH-better-sidebar",
  "stars": 3339,
  "license": "MIT",
  "npm": { "published": true, "latest": "0.18.0" },
  "health": {
    "score": 100, "grade": "A",          // A≥90 B≥75 C≥60 D<60
    "drops": [],                          // 扣分 code+证据见 insights.json / scored.jsonl
    "ruleVersion": "health-v1"
  }
}
```

## 两个集成选项（可并选）

**选项 A · 卡片字段 / sidecar（推荐先做）**
- 你们在 CI 里把 `insights.json`（或其按 `full_name` 子集）并入 `plugins.json` 的聚合流程，给每个插件条目附带可选 `health:{score,grade,ruleVersion}`。
- 效果：dsh-market 卡片与 awesome-dsh-plugin.com 插件页自动显示 A–D 徽章；**一行数据、零 UI 成本**（你们已有卡片渲染）。
- 我们的承诺：schema 只增不改；快照周更 + 每次变更 commit；你们随时可停用（数据独立在贵方 CI 中，无运行时依赖我方）。

**选项 B · 收录门槛（策展人减负）**
- 新人插件贡献门槛：`health ≥ B` 才收录（或"低于 C 需人工说明理由"）。
- 我们提供数据支撑 + 免费复核（作者可在 issue 里贴 `npx dsh-plugin-health <repo>` 或跑 `npm run regress` 对应条目）；争议走你们既有流程。
- 价值：把"凭感觉拒人"变成"引用数据拒人"，挡掉皮肤/占位/无 README 垃圾，降低背锅。

## 我们的边界（写进契约，避免误解）

- ❌ 不排名、不做"最佳插件"榜单、不干预你们收录决策——只提供可引用的事实信号。
- ❌ 不是安全审计：健康分是启发式首筛；深检（写面/消毒）只作为附加信号，明示非审计。
- ✅ 全开源（MIT）、方法论文档化、规则版本可回滚、seeds 回归公开。
- ✅ 中文生态优先但规则对英文作者可申诉（`docs.zh-missing` 等主观项可下调权重，v2 讨论）。

## 需要你们拍板的

1. 选项 A / B / 都做？卡片字段放 `plugins.json` 行内还是独立 sidecar 文件（如 `health.json` 按 full_name 索引）？
2. 门槛阈值（B？C+人工复核？）与升级流程。
3. 谁维护接入代码（我们可出 PR，含 CI 步骤与回滚）。

## 决策日志（收到回复后填写 → docs/RESEARCH.md §决策日志）

- [ ] 2026-09-05：提案文档 v1 就绪（本文件）。
- [ ] 发出渠道：________（Discussions / PR / 邮件）
- [ ] 回复：采纳（选项 __）/ 拒绝（理由：____）/ 替代路径（____）
- [ ] 若拒绝：替代路径记录 + 我们独立数据层继续（badge 热链 / llms.txt / 市场镜像 DSHM_REGISTRY_URL）

## 附：Discussion 帖子草稿（可直接粘贴）

**ZH**
> 我们做了 dsh 插件生态的客观健康分数据层（[dsh-insights](https://github.com/ice5kysl/dsh-insights)）：对全量 `dsh-plugin` topic（13.6k+）分片抓取 → manifest 门禁判真伪 → 11 条纯客观规则打分（A–D，逐条证据，星数不进分，缺失不扣分）。数据 MIT 开放、规则版本化、15 条校准 seeds 每轮回归。
> 看到贵方 README 说"不排名、不评判质量"——正好互补：**我们不抢收录权，只提供卡片上的分数**。提案两个选项：A) 把 `health` 作为可选字段/sidecar 并入 plugins.json，市场卡片直接显示徽章；B) 新人收录门槛 `health ≥ B`（数据支撑 + 免费复核）。join key 用 `owner/name`，schema 只增不改，贵方可随时停用。详见仓库 [docs/M2-INTEGRATION.md](https://github.com/ice5kysl/dsh-insights/blob/main/docs/M2-INTEGRATION.md)。期待意见！

**EN**
> We built an objective health-score layer for the dsh plugin ecosystem ([dsh-insights](https://github.com/ice5kysl/dsh-insights)): sharded full crawl of the `dsh-plugin` topic (13.6k+) → manifest-gate authenticity → 11 purely objective rules scoring A–D with per-deduction evidence (no stars, no invented data). Open (MIT), versioned rules, 15 calibration seeds regressed every run.
> Your README says you don't rank or judge quality — that's exactly complementary: we don't want your curation seat, we just want to be the number on the card. Two options: A) optional `health` field/sidecar merged into plugins.json so market cards show the badge; B) a contribution gate of `health ≥ B` (data-backed, free re-check). Join key `owner/name`; schema only additive; you can drop us anytime. Details: [docs/M2-INTEGRATION.md](https://github.com/ice5kysl/dsh-insights/blob/main/docs/M2-INTEGRATION.md). Thoughts?

## 附：仓库内可直接引用的产出

| 产物 | 路径 | 用途 |
|---|---|---|
| agent 可读全量 | `data/insights.json` | 选项 A 的数据源 |
| 逐条扣分证据 | `data/scored.jsonl` | 争议复核 |
| 聚合与报告 | `data/analysis.json` / `data/report.md` | 生态趋势引用 |
| 徽章渲染 | `bin/badge.mjs` | 托管后 `badge/<owner>/<repo>.svg` |
| 健康分规则 | `docs/schema.md §health` | 口径文档 |
