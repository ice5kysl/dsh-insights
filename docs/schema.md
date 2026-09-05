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
