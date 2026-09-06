# 当前焦点（2026-09-06）

> 本文件只放当前焦点；完整规划见 [docs/ROADMAP.md](./docs/ROADMAP.md)，外发操作见 [docs/OUTREACH.md](./docs/OUTREACH.md)。
> 当前处于 **M1 收口期**（退出标准：站点品牌一致 · ≥2 期周报对外 · 信件全量生成）。

## M1 收口（按执行序）

1. **「致作者的信」全量生成**：content/letters 现仅 7 封样例 → 全量 2113 封 + `/p/<owner>/<repo>` 页面（先小批 20–50 试跑确认质量再全量；diff 驱动更新）。
2. **W37 生态周报**：9/11（周五）前出第 2 期（现仅 W36 一期）→ 满足"≥2 期对外"；按 OUTREACH §四 SOP 外发。
3. **站点品牌化收尾**：favicon + OG 元信息（社交分享卡片）。
4. **健康分规则版本化**：`rulesVersion` 对外字段 + 口径 changelog 落文件（SCHEMA §health 已有，补对外 JSON 字段）。
5. **i18n 多语言检测器**：README 语言足迹扩展到 ja/ko/es，入 enrich 与站点维度。
6. **外发 SOP 执行**：按 OUTREACH §三渠道表推进（集成提案 #4399 跟进回复）。

## 之后进 M2（10 月）

collect/dynamics 官方动态快照器 → 周报双栏（官方 × 生态）→ rc 兼容雷达（路线由契约字段普查声明率决定：≥10% 走 v0 声明对比，否则 v1 API 符号交集）→ 站点 `/dynamics` 页。

## 已立项候选（M3）

- **DSH Insights 自身插件化**（2026-09-06 立项）：做一个薄只读 dsh 插件（侧栏面板渲染场景推荐/健康分/周报摘要，数据取站点稳定 JSON URL）。价值：dogfooding 证明、分发进入 harness 内部（最强"被消费"渠道）、成为第 N+1 个被自己管线打分的插件。排在 M1 收口之后。

## 历史 TODO（已完成的不再列）

全量 validate（权威集 2113）· npm→repo 映射 · 快照与 CI · 站点增强 · 校准集 —— 均已完成，记录见 ROADMAP 文末完成清单与 README Status。
