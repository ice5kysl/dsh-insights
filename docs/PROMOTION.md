# 推广与使用手册（PROMOTION & USAGE）

> 2026-09-05 · 配套 RELEASE-CHECKLIST.md 使用。核心打法：**先当"生态基建+作者钩子"用起来，再争取被权威目录/市场采纳**；不做流量站。

## 一、定位一句话（对外口径，别跑偏）

> dsh-insights = DeepSeek Harness 插件生态的**客观健康分数据层**：全量真伪判定 + A–D 健康分（逐条证据、规则公开、非安全审计）+ 开放数据。我们不做目录、不做市场、不做榜单——只提供"卡片上那个分数"。

## 二、三类用户 × 用法

### 1. 插件使用者（安装前决策）
- 用站点：https://dsh-insights.com/ （按健康分排序、点开看扣分原因）
- 用 CLI：`node bin/query.mjs --grade A --active30 --npm published --search "会话管理"`
- 用 agent：问 dsh 里的 agent"哪个插件值得装"，指向 `/data/insights.json`
- 心智锚点：A/B/C/D + 证据；**信任来自可复核**（点开看到"为什么扣分"）

### 2. 插件作者（被看见 + 被信任）
- 自查：`npx --yes github:ice5kysl/dsh-plugin-health <owner/repo>` 或跑本仓库评分
- 徽章：托管后 `![dsh health](https://dsh-insights.com/badge/<owner>/<repo>.svg)`（路由待站点加；本地 `node bin/badge.mjs` 先出 SVG）
- 修复路径：报告给"怎么修"（发布 npm / 补 exports["./client"] / 中英 README / LICENSE / dsh-plugin topic / 保持活跃）
- 投稿加分：给 awesome-dsh-plugin 投稿时自带 `health ≥ B` 证据（若门槛方案落地）

### 3. 策展人与平台（采纳层，M2）
- 提案文档：`docs/M2-INTEGRATION.md`（选项 A 卡片字段 / 选项 B 收录门槛）
- 数据源：`data/insights.json`（join key = owner/name；schema 只增不改）
- 平台/desktop 壳（M4）：质量数据底座授权

## 三、推广渠道 × 时机 × 动作

| 时机 | 渠道 | 动作 | 成功标准 |
|---|---|---|---|
| **今天（发布后）** | awesome-dsh-plugin org Discussions / dsh-market | 发 M2 提案帖（ZH/EN 草稿在 docs/M2-INTEGRATION.md） | 收到回复（采纳/拒绝/改法） |
| **今天** | 自己的两个插件 README | 贴 health badge（本地 SVG，热链稳定后换） | 有可点击的"活例子" |
| **今天** | GitHub Discussions / Issues | README 即产品说明；开 Discussions 板块收申诉与建议 | 首个 issue/Discussion |
| **全量快照完成时** | Discord（deepseek-harness 官方社区）/ linux.do / 中文 dsh 社区 / HN? | 发"首个全量客观评分数据集"帖 + 站点 + query CLI 演示 | 帖子互动 + repo ★ |
| **周快照稳定后** | awesome org / dsh-market 持续跟进 | 每周数据 URL 更新 + 采纳谈判 | ≥1 家接入（M2 退出） |
| **月度** | 自家 report.md | 月度生态报告（M3 媒体位） | 被转发/引用 |

**叙事三件套（帖子/README/演示统一用）**
1. 数据点：topic 13.6k、3 周 3,159 策展条目、中位 ★3、47% 未发 npm
2. 证据点：70% 缺 client export / 58% 无中文文档（analyze 实测）
3. 反差点：14.5k★ 权威列表明说"不评判质量" → 评估层无人做、我们做且开源

## 四、使用（读者操作手册，放 README/帖子附一段）

```bash
# 查某个插件
node bin/query.mjs --search omdsh
# 找"健康 A + 已发 npm + 活跃"的文件管理类
node bin/query.mjs --grade A --npm published --active30 --search file --top 10
# 拿全量数据（agent/脚本）
curl https://dsh-insights.com/data/insights.json
# 作者自查插件健康
npx --yes github:ice5kysl/dsh-plugin-health ice5kysl/dsh-workspace-kit
```

## 五、指标与复盘（每月）

- 覆盖：valid 数 / topic 全量覆盖率（progress.mjs）
- 采纳：引用我们的目录·市场数（M2 目标 ≥1）
- 钩子：badge 部署仓库数（M2 目标 ≥5）
- 传播：repo ★、insights.json 拉取、站点访问
- 公信力：校准回归通过率、申诉处理时长

## 六、红线（推广时绝不越界）

- 不宣称"安全审计"（任何文案都带"客观启发式信号"）
- 不排名/不拉踩（给分不给榜，作者可申诉）
- 不贬低其他目录/市场（我们是互补层）
- 数据开放、规则版本化、可回滚（公开透明才有公信力）
