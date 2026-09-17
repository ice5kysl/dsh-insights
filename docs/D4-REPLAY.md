# D4 · 实装 smoke 测试（真实运行时观测）

> 状态：**最小切片 + Tier 1 信号采集已上线**（2026-09-17）· 代码 `pipeline/verify/replay.mjs` + `lib/cdp.mjs` · 产物 `data/replay.json` / `data/replay-history.jsonl` / `data/replay-shots/`
> 定位：[ROADMAP](./ROADMAP.md) 附录 A 的 **D4**（事实层最硬的一格）。它是**高危触达（指控作者插件崩溃）的发送前门禁**，也是 [缺陷驱动队列 B2](./OUTREACH-QUEUE-B2.md) 的前置工程。

## 1. 为什么要它：静态判定会误判，而且已经误判过

`data/compat-observed.json` 的 `never` / `broken-since` 是**静态分析**：扫插件 client bundle 里「代码态」的 `require("X")` 字面量，对着 shell 的模块表（seed 词 ∪ 图行）判可解析性。

2026-09-10 的 [dsh-vision-router#447](https://github.com/ysr666/dsh-vision-router/issues/447) 证明这条路会误报——真实运行完全正常。当时立的规矩是：**「实测」二字必须名副其实；指控别人崩溃前必须过真实运行时回放**。这个规矩此前只是纪律，本阶段把它变成可执行的门禁。

**实测结果：静态口径在抽样里 60% 假阳性**（见 §6）。

## 2. 做法：一次真实运行，多份事实

贵的部分只有一次——`pnpm install`（网络）+ 起 shell（进程）+ 起浏览器。页活着的时候多采一份事实的边际成本接近零，所以本装置不再只回答「崩没崩」，而是**顺便把后续场景会用到的事实一次采齐**。

每个目标 2 次启动（baseline 全局只跑一次）：

1. **隔离**：`DSH_HOME` 指向仓库内的 `.d4-sandbox/home`（已 gitignore），**绝不碰用户的 `~/.dsh`**
2. **干净基线**：清空 `profiles/web`，起一次不装任何插件的真实 shell，记录噪声地板
3. **装目标**：`dsh plugin --profile web add <pkg>@<version>`（写进 `dsh.profile.bundles`，即真会被加载）
4. **起真实 shell**：`dsh web --port 0 --no-open`，从 stdout 取带 token 的 URL
5. **真实浏览器**：headless Chromium（CDP）打开该 URL——分两段等待，中途**关掉首启公告弹窗**，再采报错/出站/截图
6. **差集归因**：`插件运行报错 − baseline 报错` = 归因到插件的报错

### verdict

| verdict | reason | 含义 |
|---|---|---|
| `ok` | `loaded` | shell 起来、应用挂载、无归因报错 |
| `broken` | `shell-boot-failed` | **shell 进程自身启动失败**（host 侧；最严重） |
| `broken` | `app-did-not-mount` | shell 起来了但页面白屏 |
| `broken` | `page-load-error` | 页面报出加载类错误（模块/导出/加载失败） |
| `degraded` | `page-novel-errors` | 应用起来了，但有归因报错（非致命） |
| `install-failed` | — | npm 装不上（还没到运行阶段） |

## 3. 采到的信号（Tier 1）

| 字段 | 来源 | 后续用在哪 |
|---|---|---|
| `verdict` / `reason` / `shellError` | shell 日志 + 页面报错 | 外联门禁、信件修法、/p/ 页 |
| `hostBootMs` | 起进程 → URL 可用 | 启动开销信号 |
| `page` | 页面探针 | 「装了没反应」判定 |
| `errors` / `warnings` | console + Runtime + Log | 质量信号（弃用 API 等） |
| `egress[]` | CDP `Network` 域 | **safety 从源码启发式升级为运行时观测** |
| `shot` | CDP `Page.captureScreenshot` | **插件页缩略图**（我们此前没有） |
| `installed` | 装出来的 package.json | 依赖数 / peer 数 / install 脚本 / license / `engines.dsh` |
| `versionDrift` | 现探 npm registry 对比权威集 | 反馈权威集数据缺陷（见 §7） |

**纪律**：`egress` 只留 host（剥掉路径/query，排除 shell 自身与 localhost），只写「观测到向谁发了请求」，**绝不断言插件恶意**——延续「非安全分析」红线。

**截图策略**：只对 `grade ∈ {S,A}` 且回放 `ok` 的插件出图（1280×800 webp q70，约 11–12 KB/张），控制仓库体积，同时是优质插件的正向激励。

## 4. 零依赖实现（为什么不用 Playwright）

本管线维持 **package.json 无 dependencies**。Node ≥22 自带全局 `WebSocket`，配 CDP 的 `Target`/`Runtime`/`Log`/`Network`/`Page` 域就够用；浏览器二进制**复用 Playwright 已下载的缓存**（不额外下载、也不依赖其 npm 包）。找不到时读 `DSH_REPLAY_CHROME`。

### 踩过的坑（改动前请先读）

- **必须 `--no-sandbox`**：本机文件沙箱会挡掉 Chrome 写 `~/Library/Application Support/.../Crashpad`，进程随后不稳定、CDP websocket 一两秒后以 `1006` 断开——**表现为「连接成功但所有命令超时」**，极易误诊成协议问题。
- **必须 `--remote-allow-origins=*`**（Chrome ≥111 起 CDP ws 的准入校验）。
- **用 browser 端点 + flatten session**：page target 的 ws 端点会被立刻关闭。
- **必须清残留写锁**：dsh 用 `$DSH_HOME/.credentials.yaml.lock` 做写入互斥，被 SIGKILL 的 shell 不释放；残留锁会让**下一个** shell 报 `atomic-write: timed out waiting for the writer lock`——表现为**「连已知正常的对照组都 broken」的环境性假阳性**。所以：SIGTERM → 等待 → SIGKILL 整组 → 清 `.lock`，命中该错再重试一次。
- **必须先关首启弹窗**：shell 首次启动会弹「Internal Testing Notice」并**盖住整个 UI**。不关掉的话截图全是同一张公告图、插件面板也看不见，截图这项能力等于白做。

## 5. 怎么跑

```bash
npm run replay -- ice5kysl/dsh-insights-kit FSMargoo/dsh-at-file   # 目标 = owner/repo 或 pkg@version
npm run replay -- --baseline-only                                  # 只采集基线
npm run replay -- --fresh-baseline <targets…>                      # 强制重采基线
npm run replay -- --settle 12000 <targets…>                        # 慢机器加长等待
```

需要本机有 `dsh`（`DSH_BIN` 可覆盖）与一份 Chromium。输出三份产物，均由 SCHEMA 记录。

## 6. 实测结果（2026-09-17 · shell 0.1.5-rc.1）

| 目标 | 静态判定 | **实跑** | 真实版本 | 结论 |
|---|---|---|---|---|
| ice5kysl/dsh-insights-kit（对照） | ok | ✅ ok | 0.10.2 | 装置自证 |
| ice5kysl/dsh-workspace-kit（对照） | supported-since | ✅ ok | 0.1.11 | 装置自证 |
| ice5kysl/dsh-file-explorer-kit（对照） | ok | ✅ ok | 0.3.8 | 装置自证 |
| FSMargoo/dsh-at-file | broken-since | ❌ broken | 0.6.3 | ✅ 静态判对 |
| anweat/dsh-restart | broken-since | ❌ broken | 0.1.2 | ✅ 静态判对 |
| Tkingxiao/dsh-any-background | broken-since | ✅ **ok** | 0.2.9 | ⚠️ **假阳性**（且是版本过期造成） |
| WSL043/dsh-chat-manager | never | ✅ **ok** | 1.3.5 | ⚠️ **假阳性** |
| hellodigua/dsh-share | never | ✅ **ok** | 0.4.1 | ⚠️ **假阳性** |

**静态说 broken 的 5 个里，实跑正常的有 3 个——假阳性率 60%。** 如果按静态口径直接发信，就是**三封新的 vision-router 式误报**：对着正常工作的作者说「你的插件崩了」。

### 三个必须记住的发现

1. **静态口径的假阳性率高到不能单独用作触达依据**（本批 60%）。门禁不是保险，是刚需。
2. **真 broken 的根因全在 host 侧，静态分析连「为什么」都指错了。** 静态只看 client bundle 的 `require`，而实际报的是 host 侧错误：
   - `dsh-at-file` → `The requested module '@deepseek-ai/dsh-settings' does not provide an export named 'settingsNamespace'`
   - `dsh-restart` → 同款 host 侧导出缺失
3. **版本过期会直接制造假阳性。** `dsh-any-background` 在权威集记的 0.2.2 上确实崩，但 npm 上的真实 latest 是 **0.2.9**——作者早已修好。本装置现在**现探 registry 取真实 latest**（见 §7），否则我们会去教一个已经修好的作者做事。

> 附带的自查收获：`dsh-workspace-kit@0.1.3` 曾经在实跑里 `degraded`（client `require("@deepseek-ai/dsh-client-runtime/client") missed the module table`——正是我们提醒别人的那一类）；到 0.1.11 已恢复正常。**dogfooding 有效**。

## 7. 顺带挖出的第二个数据缺陷：权威集 npm 数据冻结

回放要装包，才发现权威集的 `npm.latest` 也是**首次校验时冻结、此后不刷新**的（`refresh.mjs` 只更新 stars/pushed_at/archived/fork/topics）——与 health-v6 修掉的活跃度是同一类缺陷。

- 抽样重探 40 个已发布插件：**约 25% 的权威集版本号已过期**
- 本批 8 个目标里 **6 个 drift**（如 insights-kit：corpus `0.5.0` vs npm `0.10.2`）
- 影响面：`npm.version-drift` 扣分、站点展示的 npm 版本、队列表里的 `pkg@version`、以及**回放会验到旧包**

装置侧已修（现探 registry + 记 `versionDrift`）；**权威集本身的修复待决策**（同 health-v6，属会改分的口径变更）。

## 8. 边界（别过度承诺）

- 判的是「**装上之后 shell 能不能正常起来**」，不是「插件功能完全可用」。
- 目前只覆盖**本机那一个 shell 版本**；矩阵化是下一步。
- **会真实执行第三方 npm 包的 host 侧代码**（隔离 DSH_HOME + 临时 profile，不写用户目录、不装进用户 profile），但仍以当前用户权限运行 → 本阶段**不进任何自动 profile**，只在手动/CI 沙箱里跑。
- 归因靠 baseline 差集；baseline 波动会污染差集（`--fresh-baseline` 重采）。
- 截图是 shell 整体界面（能看到插件在侧栏的入口），**不是插件面板特写**——要拍到面板需逐个插件知道怎么激活，暂不做。

## 9. 下一步

1. **CI 矩阵化**：`.github/workflows/replay.yml`（`workflow_dispatch` 手动，**尚未在 CI 实跑过**）× 多 shell 版本 → 真实兼容矩阵替代静态口径。
2. **并入展示**：把 `verdict` / 截图 / `egress` 叠到 `/p/` 详情页与 `/data/`，与静态判定**并列可见、互不覆盖**。
3. **门禁化**：队列目标必须 `verdict === 'broken'` 才允许发信（已写进 B2 队列）。
4. **修权威集 npm 数据冻结**（§7）——回放已证明它会制造假阳性。
