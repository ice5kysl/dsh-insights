# 外发与采纳 SOP（Outreach）

> 状态：v0.2 · 2026-09-06 · 对外口径、渠道节奏与采纳推进的唯一操作手册（合并原 PROMOTION.md 与 RELEASE-CHECKLIST.md 残余）
> 文档地图：[VISION](./VISION.md)（为什么）→ [PRODUCT-PLAN](./PRODUCT-PLAN.md)（做什么/怎么做）→ [PRODUCT-DESIGN](./PRODUCT-DESIGN.md)（页面与指标）→ [ROADMAP](./ROADMAP.md)（什么时候）· [RESEARCH](./RESEARCH.md)（证据）· [SCHEMA](./SCHEMA.md)（数据契约）· OUTREACH（外发）

核心打法（维持）：**先当"生态基建 + 作者钩子"用起来，再争取被权威目录/市场采纳**；不做流量站。内容全部机器生成，人只 review + 外发。

## 一、对外口径（v0.2，别跑偏）

> DSH Insights = DeepSeek Harness 的**生态与动态全景观察站**：全量插件真伪判定 + A–D 健康分（逐条证据、规则公开、非安全审计）+ 官方动态与 rc 兼容雷达（M2）+ 生态周报。我们不做目录、不做市场、不做榜单——只提供可引用、可复核的数据与观测。

L1 子口径（面向目录/市场提案时用）：「我们不抢收录权，只提供卡片上那个分数」（详见 [M2-INTEGRATION.md](./M2-INTEGRATION.md)）。

**叙事三件套（帖子/README/演示统一用）**
1. 数据点：topic 13.6k、3 周 3,159 策展条目、中位 ★3、47% 未发 npm
2. 证据点：70% 缺 client export / 58% 无中文文档（analyze 实测）
3. 反差点：14.5k★ 权威列表明说"不评判质量" → 评估层无人做、我们做且开源

## 二、三类用户 × 用法

### 1. 插件使用者（安装前决策）
- 站点：https://dsh-insights.com/ （按健康分排序、点开看扣分原因）
- CLI：`node bin/query.mjs --grade A --active30 --npm published --search "会话管理"`
- agent：指向 `https://dsh-insights.com/data/insights.json`（稳定 URL，永不变更）
- 心智锚点：A/B/C/D + 证据；**信任来自可复核**

### 2. 插件作者（被看见 + 被信任）
- 插件页/信件：`https://dsh-insights.com/p/<owner>/<repo>/`（分数证据 + 最值得做的 3 件事）
- 自查：`npx --yes github:ice5kysl/dsh-plugin-health <owner/repo>`
- 徽章：`![dsh health](https://dsh-insights.com/badge/<owner>/<repo>.svg)`（本地 `node bin/badge.mjs` 先出 SVG）
- 修复路径：发布 npm / 补 `exports["./client"]` / 中英 README / LICENSE / `dsh-plugin` topic / 保持活跃

### 3. 策展人与平台（采纳层）
- 提案存档：[M2-INTEGRATION.md](./M2-INTEGRATION.md)（选项 A 卡片 health 字段/sidecar · 选项 B 收录门槛 health≥B）
- 数据源：`data/insights.json`（join key = owner/name；schema 只增不改）
- 平台/desktop 壳（M4）：质量数据底座授权

## 三、渠道 × 时机 × 动作

| 时机 | 渠道 | 动作 | 状态/成功标准 |
|---|---|---|---|
| 2026-09-05（已做） | awesome-dsh-plugin org Discussions | 发集成提案（ZH/EN） | ✅ 已发 = **#4399**，待回复；回复记 RESEARCH §决策日志 |
| 2026-09-05（已做） | 自荐 2 插件 README | 贴 health badge | ✅ 已生效（活例子） |
| **每周五（周报节奏）** | LINUX DO / GitHub Discussions / 中文 dsh 社区 | 发当期生态周报帖（模板见 §四）+ 站点周报页链接 | 连续外发期数（M1 ≥2 · M2 ≥6） |
| 全量新快照有亮点时 | deepseek-harness Discord / HN（可选） | "全量客观评分数据集"帖 + query CLI 演示 | 帖子互动 + repo ★ |
| 周快照稳定后 | awesome org / dsh-market 跟进 | 每周数据 URL 更新 + 采纳谈判 | ≥1 家接入（M3 退出标准） |
| 徽章热链稳定后 | 作者圈层 | 推动 Top 插件 README 挂 badge | 部署 ≥5 仓库（M3） |

**转载许可**：数据与报告按 **CC BY 4.0** 开放引用，署名 dsh-insights.com 即可（见根 `DATA-LICENSE` 与 /data 页声明）。

## 四、周报外发 SOP（ROADMAP M1 缺口，本节约定）

1. **生成**：每周五 CI 跑 content/weekly → `data/weekly/YYYY-Www.md` + `LATEST.md` + 站点 `/weekly/` + feed.xml 重建（机器生成全文）。
2. **review**（人，≤15 分钟）：核对数字与 movers 无异常；口径变更必须出现在"口径公告位"。
3. **外发**（人，模板化）：LINUX DO + 本仓库 Discussions 各一帖，结构 = 本周 3 个数字 + 1 个 movers 看点 + 站点/RSS 链接；语气中立（数据说话，不拉踩）。
4. **记录**：外发链接与反馈记 RESEARCH §决策日志；断更即警报（PRODUCT-DESIGN §红线：连续断更 2 期暂停新功能先修管线）。

## 五、使用速查（放 README/帖子附录）

```bash
node bin/query.mjs --search omdsh                                        # 查某个插件
node bin/query.mjs --grade A --npm published --active30 --search file    # 组合筛选
curl https://dsh-insights.com/data/insights.json                         # 全量数据（agent/脚本）
npx --yes github:ice5kysl/dsh-plugin-health ice5kysl/dsh-workspace-kit   # 作者自查
```

## 六、红线（外发时绝不越界）

- 不宣称"安全审计"（任何文案都带"客观启发式信号"）
- 不排名/不拉踩（给分不给榜，作者可申诉）
- 不贬低其他目录/市场（我们是互补层）
- 数据开放、规则版本化、可回滚（公开透明才有公信力）

## 七、风险与回滚（原 RELEASE-CHECKLIST 残余）

- CI 每日刷新踩 search 限额 → refresh 用 token 分片 + BUDGET_FLOOR（已内置），失败自动下轮补。
- Pages 数据文件大（scored/insights MB 级）→ Pages 只发瘦身数据，完整数据留仓库（pages.yml 已按此配置）。
- 采纳被拒 → 走 RESEARCH 决策日志"替代路径"：独立数据层 + badge 热链 + dsh-market `DSHM_REGISTRY_URL` 镜像。
