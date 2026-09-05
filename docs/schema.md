# 数据集 Schema（dsh-plugin-insights）

快照由 `stages/02-validate.mjs` 产出，JSONL（每行一个对象，UTF-8）。行按来源分三类：

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

`candidates-all.jsonl` = 各来源 repo 行去重 + npm→repo 映射新增行；`npm-mapped.jsonl` 为映射明细（`{kind:'npm-map', name, repo, repository, latest}`）。

## 派生产物

- `data/analysis.json` — 聚合统计（totals/distribution/topTopics/topByStars）。
- `data/report.md` — 人类可读报告。
- `site/index.html` — 自包含静态站。

## 校验口径（methodology）

"有效/权威" = 仓库非 fork/归档 + 存在 `package.json` 且声明 `dsh.bundle.patch` + 该 patch 文件已提交。这是**下限**（manifest 未提交/纯 tarball 分发的会进 invalid 桶复核）。GitHub 搜索每查询 ≤1000 条、contents 列目录 ≤1000 条；完整宇宙需多轮/多源补充。

## `health` — 健康分（`stages/08-score.mjs` → `data/scored.jsonl` + `data/health.json`）

每条权威插件行附带 `health` 对象；`data/scored.jsonl` = plugins.jsonl 行 + `health`（join key `full_name`）；`data/health.json` 为聚合（grades/avg/median/topDeductions）。

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

**规则（RULE_VERSION=health-v1；升版必须在此加 changelog）**

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
