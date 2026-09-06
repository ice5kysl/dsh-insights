# 数据集 Schema（DSH Insights）

> 状态：v0.2 · 2026-09-06 · 数据契约：权威集/分桶/健康分的字段口径与规则 changelog
> 文档地图：[VISION](./VISION.md)（为什么）→ [PRODUCT-PLAN](./PRODUCT-PLAN.md)（做什么/怎么做）→ [PRODUCT-DESIGN](./PRODUCT-DESIGN.md)（页面与指标）→ [ROADMAP](./ROADMAP.md)（什么时候）· [RESEARCH](./RESEARCH.md)（证据）· SCHEMA（数据契约）· [OUTREACH](./OUTREACH.md)（外发）

快照由 `pipeline/validate/validate.mjs` 产出，JSONL（每行一个对象，UTF-8）。行按来源分三类：

## `data/plugins.jsonl` — 权威集（有效插件）

```jsonc
{
  "valid": true,
  "checkedAt": "ISO 时间（本轮校验）",
  "kind": "repo",
  "owner": "ice5kysl", "repo": "dsh-workspace-kit",
  "full_name": "ice5kysl/dsh-workspace-kit",
  "html_url": "https://github.com/...",
  "stars": 0, "forks": 0,
  "created_at": "…", "pushed_at": "…",
  "archived": false, "fork": false,
  "default_branch": "main",
  "topics": ["dsh-plugin", "…"],
  "description": "…",
  "license": "MIT | null",
  "source": "topic:dsh-plugin | curated:… | seed | npm:<name> | null",
  "files": {                 // 来自一次递归 git-tree 探测
    "tree": true,
    "cordisPatch": true, "libIndex": true, "libClient": true,
    "readme": true, "readmeZh": true, "license": true
  },
  "pkgName": "dsh-workspace-kit", "version": "0.1.1",
  "dshPatch": "./cordis.patch.yml", "patchHasName": true,
  "eval": {
    "hasClientExport": true, "mainIsLib": true,
    "licenseField": "MIT", "filesWhitelist": ["lib", "…"],
    "repoUrl": "git+https://…", "dshPlatform": "web | null",
    "dshInject": ["@deepseek-ai/…"] | null
  },
  "metrics": {
    "ageDays": 1.2, "idleDays": 0.3,
    "active30": true, "ageGate1": true, "hasZhDocs": true
  },
  "npm": { "published": true, "latest": "0.1.1", "versions": 2, "latestTime": "…" }
       | { "published": false }
}
```

## `data/invalid.jsonl` — 被拒/噪声（reason 分桶）

```jsonc
{ "valid": false, "reason": "no-signal|fork|archived|repo-gone|repo-http403|tree-failed|no-package.json|package-parse|no-dsh-bundle|patch-missing|patch-fetch",
  "owner": "…", "repo": "…", "source": "…", "checkedAt": "…" }
```

- `no-signal`：廉价启发式（topic/名称/描述）不认为与 dsh 相关，**未消耗 API**。
- `no-dsh-bundle` / `no-package.json`：有信号但缺清单 —— 可能真是插件但未按官方 bundle 形态分发（如仅 tarball/Releases），属"待人工复核桶"。

## `data/candidates*.jsonl` — 原始候选

`candidates-all.jsonl` = 各来源 repo 行去重 + npm→repo 映射新增行；`state/npm-mapped.jsonl` 为映射明细（`{kind:'npm-map', name, repo, repository, latest}`，采集中间存档）。

## 派生产物

- `data/analysis.json` — 聚合统计（totals/distribution/topTopics/topByStars）。
- `data/enrich.json` — 每插件统一记录（health 分 + category + 收录渠道 + 周下载），见 §health。
- `data/insights.json` — 对外 agent 契约（稳定 URL，schema 只增不改）。
- `data/report.md` — 人类可读报告。
- `data/last-diff.md` — 与**上一快照**的 diff（每次产出后基线滚动，`data/prev-plugin-ids.json` 更新为当前快照）。
- `site/index.html` — 自包含静态站。

历史变更（2026-09-06）：评分体系统一为 health-v2 扣分制（v0.1 的 enrich 加分制废弃，其含 star 加分违背口径）；`data/scored.jsonl`、`data/snapshot-meta.json`、`data/COMPLETE.json`、`data/candidates.jsonl` 停止产出（git 历史保留）。

## 校验口径（methodology）

"有效/权威" = 仓库非 fork/归档 + 存在 `package.json` 且声明 `dsh.bundle.patch` + 该 patch 文件已提交。这是**下限**（manifest 未提交/纯 tarball 分发的会进 invalid 桶复核）。GitHub 搜索每查询 ≤1000 条、contents 列目录 ≤1000 条；完整宇宙需多轮/多源补充。

## `health` — 健康分（`pipeline/analyze/score.mjs` 唯一真源 → `data/health.json` + `data/enrich.json` + `data/insights.json`）

评分只有一套（health-v2 扣分制），由 `score.mjs` 的 `scoreAll` 提供；`analyze`（enrich.json）、`export-json`（insights.json）、badges、history 全部经它取分，不再各自实现。`data/health.json` 为聚合（grades/avg/median/topDeductions）；`data/enrich.json` 每插件行：`{full_name, stars, score, grade, drops:[{code,sev,label}], missing[], category, inAwesome, inImsai, covered, weekly}`（score/grade/drops 来自 health；category/收录渠道/周下载为 analyze 独有维度）。

```jsonc
"health": {
  "score": 87,                  // 0–100，从 100 扣分，clamp ≥0
  "grade": "B",                 // A≥90 · B≥75 · C≥60 · D<60
  "ruleVersion": "health-v1",
  "at": "ISO…",
  "drops": [                    // 每条扣分都带证据
    { "code": "npm.unpublished", "sev": "warn", "label": "未发布到 npm（仅仓库安装）", "evidence": { "pkgName": "…" } }
  ],
  "dims": { "npm": [ … ] },     // drop 按维度分组（manifest/npm/docs/repo/activity）
  "missing": ["files"]          // 探测不到、未扣分的字段
}
```

**规则（RULE_VERSION=health-v2；升版必须在此加 changelog）**

Changelog：
- health-v2 (2026-09-05)：`activity.too-young` 收窄——仅当插件 npm 发布版本 <2 时生效（有 ≥2 个发布版本 = 有存活证据，常见于仓库重建/迁移；刚建仓且只发 1 版仍警告）。

| code | sev | 依据 |
|---|---|---|
| manifest.no-client-export | warn −5 | `exports["./client"]` 缺失（注：TUI/CLI 类插件可能本无 web client，见 caveat） |
| manifest.not-lib-main | warn −5 | `main !== lib/index.js` |
| manifest.no-files-whitelist | warn −5 | package.json 无 `files` 白名单 |
| npm.unpublished | warn −5 | 未发布 npm（仅仓库安装；生态 47% 未发布，故非 fail） |
| npm.version-drift | warn −5 | npm `latest` ≠ 仓库 `version`（含同名抢注/错配可能，evidence 双侧给出） |
| docs.no-readme | fail −20 | 无 README |
| docs.zh-missing | warn −5 | 无中文/双语文档（生态惯例 zh-first；英文作者可申诉调参） |
| repo.no-license | warn −5 | 无 LICENSE |
| repo.no-dsh-topic | warn −5 | topics 非空且无 `dsh-plugin`（可发现性） |
| activity.too-young | warn −5 | 仓库 <1 天 |
| activity.dormant | warn −5 | 闲置 >30 天 |

原则：纯客观信号；不做 star 分（星数会刷、monorepo 污染）；不做社区评分；missing 数据不虚构不扣分。caveat：`manifest.no-client-export`/`not-lib-main` 对非 web 形态（TUI/CLI/desktop）可能误伤——v1 先按 warn 标注并给证据，误判可申诉。
