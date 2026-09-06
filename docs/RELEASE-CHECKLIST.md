# 发布清单（RELEASE CHECKLIST）· 从本地到公开

> 目标：把 dsh-insights 变成可被生态引用的公开数据层。每步都有可复现命令；标 ⏸ 的步骤需要你（仓库 owner）操作。

## Phase 0 · 前置确认（本地，已完成/进行中）

- [x] 产品文档：VISION / ROADMAP / PRODUCT-PLAN / RESEARCH / M2-INTEGRATION
- [x] LICENSE(MIT)、README 产品定位、schema(含 health 规格)
- [x] 分片全量抓取（13,583 topic 候选）、校准集 15/15
- [x] health-v1 评分、insights.json、badge 渲染、站点（健康列 + 扣分明细）
- [~] 全量权威集（你的 validate 进程 ~2,044/14,144，ETA 数小时）
- [x] 复现命令：`GITHUB_TOKEN="$(gh auth token)" npm run snapshot`（analyze→site→export→score→export:json）

## Phase 1 · 建仓并推送（⏸ 你操作，~5 分钟）

1. GitHub 新建空仓库 `ice5kysl/dsh-insights`（建议 Public + MIT）。
   - 或独立 org（见 VISION O2）——决定"中立第三方"叙事。
2. 推送：
   ```bash
   cd <本仓库目录>
   git remote add origin git@github.com:ice5kysl/dsh-insights.git
   git push -u origin main
   ```
3. 建 secret `GITHUB_TOKEN`（repo 写权限）→ 供 `refresh.yml` 每日刷新用。
   - 说明：fine-grained token，Contents read/write on this repo 即可；GitHub 自带的 `GITHUB_TOKEN` 不能用于 search API 提额，需要 PAT。

## Phase 2 · 激活 CI 与站点（推完自动，先备好）

- [x] `.github/workflows/refresh.yml`（已有）：每日 03:00 UTC 跑全量管线并 commit 快照（需要 secret）。
- [ ] `.github/workflows/pages.yml`（本清单配套）：main 更新后把 `site/` 部署到 GitHub Pages → 得到公开站点 URL。
- [ ] 公开数据 URL 约定（Pages 根 = repo `site/` 目录下的发布形态，实际路径以部署为准）：
  - 站点：`https://dsh-insights.com/`
  - 数据：同目录 `data/insights.json`（若 Pages 只发 site/ 则需要把 data 也放入部署产物）
  - badge 热链：`https://dsh-insights.com/badge/<owner>/<repo>.svg`（站点需带 badge 目录/路由；本地先 `node bin/badge.mjs`）
- [ ] 在仓库根放 `llms.txt`（若 Pages 根可读）：一句话说明 + `data/insights.json` URL → 对 AI 爬虫开放。

## Phase 3 · 全量快照（校验完成后）

```bash
cd <本仓库目录>
GITHUB_TOKEN="$(gh auth token)" npm run snapshot   # 或逐段跑
npm run regress                                    # 校准 15/15 复验
git add data/ site/ && git commit -m "snapshot: full authoritative set v0.1"
git push
```
退出标准（M0）：一条命令从零复现；首个全量权威集快照入库；seeds 回归通过。

## Phase 4 · 对外发布（⏸ 你操作或授权）

1. 发 [M2-INTEGRATION.md](./M2-INTEGRATION.md) 的 Discussion 帖子（ZH/EN 草稿已就绪）给：
   - awesome-dsh-plugin org（Discussions）
   - dsh-market（issues/Discussions）
   - deepseek-harness Discord 插件频道 / linux.do / 中文社区（以"第一个全量客观评分数据集"叙事）
2. 把回复记进 RESEARCH.md §决策日志。
3. 作者钩子：给自己的两个插件 README 贴 badge（`bin/badge.mjs` 生成的 SVG 先本地提交，热链 URL 稳定后替换）。

## Phase 5 · 节奏上线（M1/M2 收口）

- 周快照：周一跑 Phase 3；或等 `refresh.yml` 自动。
- 站点 v2：健康分分布图、缺口矩阵（vs 官方内置）、月度新增——本地产物已含大部分，做 UI 收尾。
- 兼容矩阵（M3）：engines.dsh vs 发行版本（需 validate 增补字段，单独 PR）。

## 风险与回滚

- CI 每日刷新踩 search 限额 → refresh 用 token 分片 + BUDGET_FLOOR（已内置），失败自动下轮补。
- Pages 数据文件大（scored/insights MB 级）→ 数据走 git LFS 或仅发 insights.json（瘦身版）到 Pages，完整数据留在仓库。
- 采纳被拒 → 走 RESEARCH 决策日志"替代路径"：独立数据层 + badge 热链 + dsh-market `DSHM_REGISTRY_URL` 镜像。
