# 候选插件清单（2026-09-10）——「高需求 × 弱供给 × 低吸收风险」框架全生态扫描

> 方法：enrich.json（10,190 插件）× downloads.json（周下载）× compat-observed.json（15 shell 版本实测）
> × 官方 `.agents/notes/`（implemented/proposed/archived 特性笔记）三路交叉。
> 框架与 @file 否决案的教训见 `BET-REVIEW-2026-09-10-at-file.md`。

## 〇、先排除的（数据支持但方向错误）

| 方向 | 需求证据 | 否决原因 |
|---|---|---|
| @file 提及 | at-file 1,423/周 ★502 | **官方 8-27 已原生实现**（implemented 归档）；流量是惯性 |
| 免费搜索 | free-search 4,725/周 ★127 | **官方 7-31 上线 web-default-search**，还有 search-card/多查询迭代——已吸收 |
| 侧栏/面板底座 | better-sidebar 59,166/周 | 官方 9-04「right-sidebar-docking-infrastructure」+ 9-05/9-08/9-09 连续四天 sidebar 打磨——**正在吸收** |
| 会话内统计/费用显示 | cost-meter 14,273/周 | 官方 9-07「composer-session-stats-pills」已进 composer——风险快速上升 |
| 图片输入/看图 | （多插件） | 官方图片管线密集：7-22 多模态输入、8-10 read-image 工具、8-20 统一图片请求管线、8-24 计费路由——**vision 方向吸收风险上修为中** |
| 订阅当 provider | plugin-subscriptions 2,752/周 ★321 | ToS 灰色（消费订阅跑 API 流量），与我们合规品牌冲突 |

## 一、候选短名单（按推荐度排序）

### ① 失败诊断 / run 复盘（首选）

- **需求证据**：zzh-newlearner/dsh-postmortem **1,377/周、★2、B 级**——零星低质插件拿到这个量，纯需求驱动（npm 搜索「为什么挂了」的自来流量）
- **供给**：独此一家且 B 级、无实测记录；无竞品
- **吸收风险**：**极低**——官方 notes 里诊断/复盘零命中；官方重心在会话/侧栏/composer
- **我们的独特优势（别人抄不走）**：本地日志解析只是及格线；我们能接 **compat-observed 生态崩溃原因库**——「这个错在全生态出现过 N 次、已知的修法是 X、是某插件 vs 某 shell 版本的已知不兼容」。体检站的诊断心智延伸到运行时
- **构建成本**：低-中（本地日志解析、无模型依赖——incumbent 的「No model required」定位是对的）
- **候选包名**：dsh-postmortem 已被占但持有者 ★2/B——差异化命名如 dsh-why-failed / dsh-run-doctor

### ② 浏览器自动化（次选）

- **需求证据**：dsh-browser npm 包 **1,378/周**，被 ben7am1n / justwe-bot / duyefeng 三个仓库同时 claim（**全部 C 级**）——需求溢出到三个影子仓库都能被搜到
- **供给**：三家全 C（文档/质量信号差）；功能完整度待查
- **吸收风险**：**低**——官方 notes 无 browser automation 命中（仅一条无关的 locale 检测）
- **构建成本**：中（Playwright 集成；我们触达队列里的 chendefine/dsh-web-fetch-playwright 作者做过相邻的 web-fetch，生态已有参照）
- **风险点**：工具协议/MCP 侧的官方演进需要持续盯；先验证现有三家到底能不能用（未测=可能无 client bundle 的纯工具插件，体检口径不同）

### ③ 免费语音（观察位）

- **需求证据**：FuzzySoul/dsh-chatvoice 547/周 ★4 B（语音输入 + 朗读，零配置免 key）
- **供给**：B 级单家；**吸收风险低**（官方无命中）
- **构建成本**：中（免费 ASR/TTS 链路选型是难点）；需求量级比①②小一档，先观察

## 二、被验证但供给已强的（不做，存档）

- **记忆**：官方 7-31「third-party-memory-mcp-examples」明示把记忆留给生态（吸收风险低）——但 mnemon 9,263/周 ★331 **S 级健康**，供给不弱。除非有差异化角度（记忆可视化？），否则是正面硬刚
- **移动端**：dsh-mobile 3,123/周（4 仓库 claim 同名包），但 saya-ch 的是 S 级 ok；且构建成本极高（Android App）
- **图像生成**：2,275/周（5 仓库 claim），shanliuling/dsh-image-gen S 级已占位（还是我们的徽章用户）

## 三、结论与建议

**首选 ①（失败诊断/run 复盘）**：需求真实且无人服务、官方零涉足、成本可控、与观测站数据资产直接协同——「为什么崩」本来就是我们的主场。建议先出 PRD：核心功能（本地失败日志 → 人话诊断 + 恢复计划）、差异化（接生态崩溃原因库）、MVP 范围（3 天内可发 v0.1.0）。

次选 ②（浏览器自动化）需要先做一天竞品实测（三个 C 级包到底什么水平）再定。

*数据快照：enrich/downloads/compat-observed @ 2026-09-09/10；官方 notes 扫描 @ 2026-09-10。*
