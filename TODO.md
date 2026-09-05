# dsh-plugin-insights · 续跑计划

按优先级排序（自动续跑轮次按此推进）：

1. **全量 validate**：`LIMIT` 去掉，跑全部 repo 候选（≈3125，真伪校验可继续推进约 600–1200 个"有信号"候选；预算 5000/hr、断点续跑）。每批后跑 analyze+site 并提交快照。
2. **npm 候选 → 仓库映射**：npm search 结果（当前仅 250 上限）尽力关联 repo（links.repository / description），去重后并入候选。
3. **深检（限量）**：对自荐 + star Top N + 标榜"只读"的插件克隆本地跑 dsh-plugin-health 启发式（写面/消毒），结果并入 eval.deep。
4. **快照与 CI**：把 data/ 快照提交（开放数据集）；加 .github/workflows 每日刷新（cron）模板（runs + 提交新快照），注明仅在有 token 时生效。
5. **站点增强**：月度新增柱状/发布率、npm 版本滞后 Top、缺口分析（vs 官方内置能力）、分类标签；index.html 图表零依赖。
6. **校准集**：把已知真/假插件（含 ice5kysl 两个 + joejojoking 等）编进 seeds，保证每轮回归通过。

约束：GitHub 搜索每查询 ≤1000 条；contents API 列目录 ≤1000 条；npm search size ≤250（可翻页）。
