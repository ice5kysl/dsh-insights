# 作者触达队列 · B2（缺陷驱动，2026-09-17 重建）

> **为什么重建**：原「第二批（队列 11–20）」被整批弃用（2026-09-17 决策）。原因有二：
> 1. **满分促销信**——原名单 10 位全是 `S(100)`，信件正文「本期观测没有发现明显的短板信号」，且缺 batch 1 那种「观察员的额外视角」个性化段。信的实际内容是「你很好 + 用我们的工具」，正是 2026-09-09 [DSH-better-sidebar#581](https://github.com/omdsh-dev/DSH-better-sidebar/issues/581) 被公开吐槽的「评委视角/引流」形态。
> 2. **名单建立在错误数据上**——队列按「近 30 天活跃」筛选，而该指标当时被冻结（见 [SCHEMA §health changelog health-v6](./SCHEMA.md)）。原名单里 2 位已实际停更 >30 天。
>
> **新口径**：选「**真的有问题、且这问题值得作者知道**」的插件，复制 2026-09-09 加载体检专线的打法——[dsh-ego-browser#32](https://github.com/Fisfzy/dsh-ego-browser/issues/32) 那封信直接促成作者发出 0.8.4 修掉崩溃，是全部外联里唯一产生**真实代码修复**的一封。

## 选择口径（可复现）

数据源 `data/compat-observed.json`（实测兼容矩阵 · **静态分析口径，非运行时测试**）× `data/plugins.jsonl` × `data/enrich.json` × `data/downloads.json`：

1. `verdict.cls ∈ {never, broken-since}` —— 在所有已发布 shell 上加载失败 / 某版本起持续失败（加载即崩类）
2. **排除 `hostTransform` 标记**（host 侧 tapIndex 改写模块面，静态口径不可判定——vision-router 误报的根因）
3. 排除 `maint.single-push` / `discover.batch-import`（一次性导入的模板农场，不触达）
4. 近 30 天有提交（用 `deriveActivity` 现算口径，保证信里「你仍在维护」这句话成立）
5. 排除已触达的 12 个仓库（首批 10 + 加载体检 2）
6. 排序：**周下载 → 星数**（优先打真实用户在用的）

命中 **99** 个，下表列前 20。

> ⚠️ **下表 `npm` 列的版本号取自权威集，而权威集的 npm 数据是首次校验时冻结的**——2026-09-17 抽样重探 40 个已发布插件，**约 25% 的版本号已过期**（与 health-v6 修掉的活跃度缺陷同源，详见 [RESEARCH](./RESEARCH.md) 决策日志）。回放装置已改为**现探 registry 取真实 latest**（结果里记 `versionDrift`），所以**发信前一律以 `data/replay.json` 里的版本为准**，不要照抄下表。

## 队列（前 20 · 按周下载）

| # | 仓库 | npm | 判定 | 周下载 | ★ | 停更天 | 健康分 |
|---|---|---|---|---|---|---|---|
| 1 | [FSMargoo/dsh-at-file](https://github.com/FSMargoo/dsh-at-file) | `dsh-at-file@0.6.3` | broken-since | 1,896 | 512 | 15 | B · 84 |
| 2 | [Tkingxiao/dsh-any-background](https://github.com/Tkingxiao/dsh-any-background) | `dsh-any-background@0.2.8` | broken-since | 1,047 | 29 | 2 | B · 86 |
| 3 | [WSL043/dsh-chat-manager](https://github.com/WSL043/dsh-chat-manager) | `dsh-chat-manager@1.3.5` | never | 865 | 6 | 2 | A · 93 |
| 4 | [anweat/dsh-restart](https://github.com/anweat/dsh-restart) | `dsh-restart@0.1.2` | broken-since | 647 | 7 | 7 | S · 95 |
| 5 | [liuGuanYi-hub/dsh-message-edit](https://github.com/liuGuanYi-hub/dsh-message-edit) | `dsh-message-edit@0.2.3` | broken-since | 539 | 1 | 26 | C · 71 |
| 6 | [clown139880/dsh-live2d-avatar](https://github.com/clown139880/dsh-live2d-avatar) | `dsh-live2d-avatar@0.2.1` | never | 367 | 0 | 5 | B · 77 |
| 7 | [hellodigua/dsh-share](https://github.com/hellodigua/dsh-share) | `dsh-share@0.4.1` | never | 360 | 35 | 4 | A · 93 |
| 8 | [xiaoshihou514/dsh-desktop-pet](https://github.com/xiaoshihou514/dsh-desktop-pet) | `dsh-desktop-pet@0.2.0` | broken-since | 317 | 35 | 26 | B · 89 |
| 9 | [siegfly/dsh-deepseek-vision](https://github.com/siegfly/dsh-deepseek-vision) | `dsh-deepseek-vision@0.1.7` | broken-since | 317 | 8 | 5 | A · 90 |
| 10 | [SuperstructureJH/dsh-workbuddy-ppt](https://github.com/SuperstructureJH/dsh-workbuddy-ppt) | `dsh-workbuddy-ppt@0.1.0` | broken-since | 302 | 1 | 19 | B · 81 |
| 11 | [GitHubJiKe/dsh-markdown-preview](https://github.com/GitHubJiKe/dsh-markdown-preview) | `dsh-markdown-preview@0.3.0` | broken-since | 298 | 2 | 30 | B · 84 |
| 12 | [lgquan/dsh-voco](https://github.com/lgquan/dsh-voco) | `@flowingspring/dsh-voco@0.3.13` | broken-since | 283 | 1 | 15 | A · 93 |
| 13 | [xiaoksio/dsh-solution-explorer](https://github.com/xiaoksio/dsh-solution-explorer) | `dsh-solution-explorer@1.0.0` | never | 276 | 11 | 3 | B · 86 |
| 14 | [tingfeng347/dsh-vscode-workbench](https://github.com/tingfeng347/dsh-vscode-workbench) | `dsh-vscode-workbench@0.1.8` | never | 271 | 9 | 15 | A · 93 |
| 15 | [ThreeBody6666/dsh-computer-use](https://github.com/ThreeBody6666/dsh-computer-use) | `@crazy_th/dsh-computer-use@0.2.4` | broken-since | 250 | 1 | 25 | S · 96 |
| 16 | [suntianc/dsh-ui-settings-icons](https://github.com/suntianc/dsh-ui-settings-icons) | `dsh-ui-settings-icons@0.1.2` | broken-since | 250 | 1 | 6 | B · 86 |
| 17 | [yangdongzhen590/dsh-knj-extension-center](https://github.com/yangdongzhen590/dsh-knj-extension-center) | `dsh-knj-extension-center@2026.9.13` | never | 249 | 0 | 7 | C · 72 |
| 18 | [zhijun-dai/Catppuccin-dsh-theme](https://github.com/zhijun-dai/Catppuccin-dsh-theme) | `dsh-catppuccin@0.2.3` | broken-since | 235 | 9 | 13 | B · 78 |
| 19 | [TsFreddie/dsh-compaction-instant](https://github.com/TsFreddie/dsh-compaction-instant) | `dsh-compaction-instant@0.1.4` | broken-since | 217 | 13 | 14 | A · 94 |
| 20 | [linxichen/dsh-rigorquant](https://github.com/linxichen/dsh-rigorquant) | `dsh-rigorquant@0.4.1` | broken-since | 204 | 5 | 6 | A · 91 |

## ⚠️ 发送前硬门禁（不得跳过）

2026-09-10 的 vision-router 误报已立过规矩：**「实测」二字必须名副其实；高危触达（指控别人崩溃）发前必须过真实运行时回放**。本队列的判定来源是**静态分析**，因此：

- [ ] **每个目标发出前必须跑 `npm run replay -- <target>`**，只有 `data/replay.json` 里该目标 `verdict === 'broken'` 才允许发信；
- [ ] 实跑为 `ok` 的**一律不发**（宁缺勿错）——并把它当作静态口径的假阳性样本，反馈给 [compat-observed](../pipeline/analyze/compat-observed.mjs) 修正；
- [ ] 信件文案必须写明方法（「真实 shell + 浏览器复核」或「静态分析，未复现」），**不得写「实测崩溃」除非真的是回放结论**；
- [ ] 每封信附**回放给出的那条真实根因**（不是静态推断的那条）+ 参考修法。

### 门禁已可用：D4 最小切片（2026-09-17 上线）

运行时回放能力已落地为 [D4 实装 smoke 测试](./D4-REPLAY.md)（`pipeline/verify/replay.mjs` + `lib/cdp.mjs`，零依赖；`npm run replay`）。**门禁第一次跑就证明不能省**——队列前 5 个目标里 **3 个实跑完全正常**：

| 目标 | 静态判定 | 实跑 | 处理 |
|---|---|---|---|
| FSMargoo/dsh-at-file | broken-since | ❌ broken（host 侧 `settingsNamespace` 导出缺失，`@0.6.3`） | ✅ 可发 |
| anweat/dsh-restart | broken-since | ❌ broken（host 侧导出缺失，`@0.1.2`） | ✅ 可发 |
| Tkingxiao/dsh-any-background | broken-since | ✅ **ok**（`@0.2.9`） | 🚫 **不发**——静态依据的 `0.2.2` 已过期，作者早修好了 |
| WSL043/dsh-chat-manager | never | ✅ **ok**（`@1.3.5`） | 🚫 **不发** |
| hellodigua/dsh-share | never | ✅ **ok**（`@0.4.1`） | 🚫 **不发** |

> **静态口径在这批里假阳性率 60%（3/5）。** 没有回放就是三封新的 vision-router 式误报。另外真 broken 的根因**全在 host 侧**（模块导出），静态分析只看 client bundle 的 require，**连「为什么」都指错了**——信件必须用回放那条根因。三者里还有一个是**版本过期**造成的假阳性（见上方 ⚠️ 注），进一步说明「按真实 npm 版本回放」不是可选优化。

## 信件形态

不使用「一期一会」健康信模板（那是全量、中性的观测分享）。改用加载体检信：**发生了什么（哪个 shell 版本）→ 我们怎么复核的（真实 shell + 浏览器）→ 回放给出的根因 → 参考修法 → 不要求任何行动**。范例（dsh-at-file）：

> 装上 `dsh-at-file@0.6.3` 后，dsh 0.1.5-rc.1 的 shell 起不来，报：
> `The requested module '@deepseek-ai/dsh-settings' does not provide an export named 'settingsNamespace'`
> （发生在 `lib/index.js` 的 import 阶段，host 侧。）

## 关联

- 原队列（首批 10 + 已发记录）：[OUTREACH-QUEUE.md](./OUTREACH-QUEUE.md)
- 渠道与节奏：[OUTREACH.md](./OUTREACH.md)
- 回放装置与边界：[D4-REPLAY.md](./D4-REPLAY.md)
- 判定口径全文：`data/compat-observed.json` 的 `note` 字段（中英双语）
