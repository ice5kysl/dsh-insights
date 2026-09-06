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
    // 注：站点的「近 7 天活跃」为 analyze 派生（pushed_at 距今 <7 天），不入 metrics
    // active30 保留给 health 的 activity.dormant 规则（30 天停滞才是维护风险，7 天过苛）
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

评分只有一套（health-v2 扣分制），由 `score.mjs` 的 `scoreAll` 提供；`analyze`（enrich.json）、`export-json`（insights.json）、badges、history 全部经它取分，不再各自实现。`data/health.json` 为聚合（grades/avg/median/topDeductions）；`data/enrich.json` 每插件行：`{full_name, stars, score, grade, dimScores, drops:[{code,sev,label}], missing[], category, inAwesome, inImsai, covered, weekly}`（score/grade/drops 来自 health；category/收录渠道/周下载为 analyze 独有维度）。

### 评估指标体系 v1（维度框架）

六个维度；**计分四维**进入总分（100 起扣），**展示两维**只呈现不进分，**兼容维度**预留：

| 维度 | 定义 | 指标项（数据来源） | 计分处理 |
|---|---|---|---|
| 工程质量 `eng` | bundle 规范与发布卫生 | client 导出 · main=lib 布局 · files 白名单 · npm 发布 · npm↔仓库版本一致（package.json / npm registry） | **计分**（warn −5/项） |
| 文档完整性 `docs` | 用户上手材料与许可 | README 有无（fail −20）· 中文/双语文档 · LICENSE（git tree 探测） | **计分** |
| 可发现性 `discover` | 被找到的能力 | `dsh-plugin` topic（repo topics）；策展收录 awesome/imsai（listed.json） | topic **计分**；收录**只展示** |
| 维护活跃 `maint` | 存活与持续维护信号 | 仓库年龄 <1 天 · >30 天无提交（pushed_at；npm ≥2 版本豁免 too-young） | **计分** |
| 安全卫生 `safety` | 写面/消毒启发式（非审计） | 源文件写面（fs 写/子进程/HTTP 写动词）· 渲染消毒器（深检 deep.jsonl，抽样覆盖） | **增量信号，单独标注，不进总分**（覆盖不足，不虚构） |
| 采用度 `adoption` | 社区使用与关注 | ★ · npm 周下载（downloads.json）· 收录渠道 | **只展示不进分**（可刷/monorepo 污染，见原则） |
| 兼容性 `compat` | 与 dsh 版本匹配 | engines.dsh 声明（实测声明率 ~1%，不可用）· 深检 API 符号 × rc changelog（M2 雷达 v1） | **预留维度，暂缺测** |

原则（维持）：纯客观信号；星数不进分；缺失不虚构不扣分（missing 明示）；社区评分/投票永不引入。`dimScores` = 各计分维度独立 100 起扣（与该维度内规则扣分同步），总分 = 全部计分规则合并起扣。

```jsonc
"health": {
  "score": 87,                  // 0–100，从 100 扣分，clamp ≥0
  "grade": "B",                 // S≥95 · A≥90 · B≥75 · C≥60 · D<60
  "ruleVersion": "health-v1",
  "at": "ISO…",
  "drops": [                    // 每条扣分都带证据
    { "code": "npm.unpublished", "sev": "warn", "label": "未发布到 npm（仅仓库安装）", "evidence": { "pkgName": "…" } }
  ],
  "dims": { "npm": [ … ] },     // drop 按维度分组（manifest/npm/docs/repo/activity）
  "missing": ["files"]          // 探测不到、未扣分的字段
}
```

**规则（RULE_VERSION=health-v3；升版必须在此加 changelog）**

Changelog：
- health-v4 (2026-09-06)：新增 **S 级（≥95）**——v3 下 A(≥90) 占 28% 仍偏宽，S 档（实测 10.0%）给真正卓越的插件出头空间；阈值成为 S≥95 · A≥90 · B≥75 · C≥60 · D<60。
- health-v3 (2026-09-06)：**区分度重构**——扣分从一刀切 −5/−20 改为四档（fail −20 / major −10 / warn −5 / minor −2）；`npm.unpublished` 升 major（无法一键安装是核心可用性）；`not-lib-main`/`no-files-whitelist` 降 minor；新增 7 条：`docs.no-description`、`repo.sparse-topics`、`npm.single-release`、`npm.release-stale`（>90 天）、`eng.no-tests`、`eng.no-ci`、`docs.no-docs-dir`、`docs.tiny-readme`（<400B）。树探测信号（tests/CI/docsDir/readmeBytes）随 backfill 逐步生效（缺失不扣分）。背景：v2 分布 A+B 99.6% 无区分度。
- health-v2 (2026-09-05)：`activity.too-young` 收窄——仅当插件 npm 发布版本 <2 时生效（有 ≥2 个发布版本 = 有存活证据，常见于仓库重建/迁移；刚建仓且只发 1 版仍警告）。

| code | sev | 依据 |
|---|---|---|
| docs.no-readme | fail −20 | 无 README |
| npm.unpublished | major −10 | 未发布 npm（无法一键安装，核心可用性） |
| manifest.no-client-export | warn −5 | `exports["./client"]` 缺失（注：TUI/CLI 类插件可能本无 web client，见 caveat） |
| npm.version-drift | warn −5 | npm `latest` ≠ 仓库 `version`（含同名抢注/错配可能，evidence 双侧给出） |
| npm.release-stale | warn −5 | npm 最近发布距今 >90 天 |
| docs.zh-missing | warn −5 | 无中文/双语文档（生态惯例 zh-first；英文作者可申诉调参） |
| docs.no-description | warn −5 | 仓库无 description |
| repo.no-license | warn −5 | 无 LICENSE |
| repo.no-dsh-topic | warn −5 | topics 非空且无 `dsh-plugin`（可发现性） |
| activity.too-young | warn −5 | 仓库 <1 天（npm ≥2 版本豁免） |
| activity.dormant | warn −5 | 闲置 >30 天 |
| eng.no-tests | warn −5 | 无测试目录/测试文件（树探测） |
| manifest.not-lib-main | minor −2 | `main !== lib/index.js` |
| manifest.no-files-whitelist | minor −2 | package.json 无 `files` 白名单 |
| repo.sparse-topics | minor −2 | topics 仅 1 个（可发现面窄） |
| npm.single-release | minor −2 | npm 仅 1 个发布版本 |
| eng.no-ci | minor −2 | 无 `.github/workflows`（树探测） |
| docs.no-docs-dir | minor −2 | 无 `docs/` 目录（树探测） |
| docs.tiny-readme | minor −2 | README <400 字节（树探测 blob 大小） |

原则：纯客观信号；不做 star 分（星数会刷、monorepo 污染）；不做社区评分；missing 数据不虚构不扣分（树探测字段在 backfill 完成前对部分行缺失，这些行相应规则不触发）。caveat：`manifest.no-client-export`/`not-lib-main` 对非 web 形态（TUI/CLI/desktop）可能误伤——按 warn/minor 标注并给证据，误判可申诉。
