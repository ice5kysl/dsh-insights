# D4 · 实装 smoke 测试（真实运行时加载回放）

> 状态：**最小切片已上线**（2026-09-17）· 代码 `pipeline/verify/replay.mjs` + `lib/cdp.mjs` · 产物 `data/replay.json`
> 定位：[ROADMAP](./ROADMAP.md) 附录 A 的 **D4**——事实层最硬的一格。它是**高危触达（指控作者插件崩溃）的发送前门禁**，也是 [缺陷驱动队列 B2](./OUTREACH-QUEUE-B2.md) 的前置工程。

## 1. 为什么要它：静态判定会误判，而且已经误判过一次

`data/compat-observed.json` 的 `never` / `broken-since` 是**静态分析**：扫插件 client bundle 里「代码态」的 `require("X")` 字面量，对着 shell 的模块表（seed 词 ∪ 图行）判可解析性。

2026-09-10 的 [dsh-vision-router#447](https://github.com/ysr666/dsh-vision-router/issues/447) 证明这条路会误报——真实运行完全正常，误报根因有两层静态分析看不到：① 图行工厂注册（require 在调用时可解析）② host 侧 `tapIndex` 改写模块面。当时立的规矩是：**「实测」二字必须名副其实；指控别人崩溃前必须过真实运行时回放**。

**这个规矩此前只是一个纪律，没有工具。本阶段把它变成可执行的门禁。**

## 2. 做法

每个目标 2 次启动（baseline 全局只跑一次）：

1. **隔离**：`DSH_HOME` 指向仓库内的 `.d4-sandbox/home`（已 gitignore），**绝不碰用户的 `~/.dsh`**
2. **干净基线**：清空 `profiles/web`，起一次不装任何插件的真实 shell，记录噪声地板
3. **装目标**：`dsh plugin --profile web add <pkg>@<version>`（会写进该 profile 的 `dsh.profile.bundles`，即真会被加载）
4. **起真实 shell**：`dsh web --port 0 --no-open`，从 stdout 取带 token 的 URL
5. **真实浏览器**：headless Chromium 打开该 URL，抓 `Runtime.exceptionThrown` / console error / Log error，并跑一段探针看应用是否真的挂起来
6. **差集归因**：`插件运行报错 − baseline 报错` = 归因到插件的报错；再给 verdict

### verdict

| verdict | reason | 含义 |
|---|---|---|
| `ok` | `loaded` | shell 起来、应用挂载、无归因报错 |
| `broken` | `shell-boot-failed` | **shell 进程自身启动失败**（host 侧；最严重） |
| `broken` | `app-did-not-mount` | shell 起来了但页面白屏 |
| `broken` | `page-load-error` | 页面报出加载类错误（模块/导出/加载失败） |
| `degraded` | `page-novel-errors` | 应用起来了，但有归因报错（非致命） |
| `install-failed` | — | npm 装不上（还没到运行阶段） |

## 3. 零依赖实现（为什么不用 Playwright）

本管线维持 **package.json 无 dependencies**。Node ≥22 自带全局 `WebSocket`，配 CDP 的 `Target` / `Runtime` / `Log` 三个域就够用；浏览器二进制**复用 Playwright 已下载的缓存**（不额外下载、也不依赖它的 npm 包）。找不到时读 `DSH_REPLAY_CHROME`。

### 踩过的坑（改动前请先读）

- **必须 `--no-sandbox`**：本机文件沙箱会挡掉 Chrome 写 `~/Library/Application Support/.../Crashpad`，进程随后不稳定、CDP websocket 会在一两秒后以 `1006` 断开——**表现为「连接成功但所有命令超时」**，极易误诊成协议问题。
- **必须 `--remote-allow-origins=*`**（Chrome ≥111 起 CDP ws 的准入校验）。
- **用 browser 端点 + flatten session**：page target 的 ws 端点会被立刻关闭。
- **必须清残留写锁**：dsh 用 `$DSH_HOME/.credentials.yaml.lock` 做写入互斥，被 SIGKILL 的 shell 不会自己释放；残留锁会让**下一个** shell 启动时报 `atomic-write: timed out waiting for the writer lock`——表现为**「连已知正常的对照组都 broken」的环境性假阳性**。所以：SIGTERM → 等待 → SIGKILL 整组 → 清 `.lock`，且命中该错时清锁重试一次。

## 4. 怎么跑

```bash
npm run replay -- dsh-insights-kit@0.10.2 FSMargoo/dsh-at-file   # 目标 = owner/repo 或 pkg@version
npm run replay -- --baseline-only                                # 只采集基线
npm run replay -- --fresh-baseline <targets…>                    # 强制重采基线
npm run replay -- --settle 12000 <targets…>                      # 慢机器加长等待
```

需要本机有 `dsh`（`DSH_BIN` 可覆盖）与一份 Chromium。输出 `data/replay.json`。

## 5. 首次结果（2026-09-17 · shell 0.1.5-rc.1）

对照组 `dsh-insights-kit@0.10.2` → `ok`（证明装置本身可用），其余 5 个取自 B2 队列头部：

| 目标 | 静态判定 | **实跑** | 结论 |
|---|---|---|---|
| dsh-insights-kit@0.10.2（对照） | — | ✅ ok | 装置自证 |
| FSMargoo/dsh-at-file | broken-since | ❌ broken | ✅ 静态判对（但根因不同，见下） |
| Tkingxiao/dsh-any-background | broken-since | ❌ broken | ✅ 静态判对 |
| anweat/dsh-restart | broken-since | ❌ broken | ✅ 静态判对 |
| WSL043/dsh-chat-manager | never | ✅ **ok** | ⚠️ **静态假阳性** |
| hellodigua/dsh-share | never | ✅ **ok** | ⚠️ **静态假阳性** |

### 两个必须记住的发现

1. **静态口径在这批里有 40%（2/5）是假阳性。** 如果按原计划直接发信，就是**两封新的 vision-router 式误报**——对着正常工作的作者说「你的插件崩了」。这正是本门禁存在的意义，而且第一天就兑现了。
2. **真实失败根因和静态模型猜的不是一回事。** 三个真 broken 全是 **host 侧**问题，静态分析（只看 client bundle 的 require）根本看不到：
   - `dsh-at-file` → `The requested module '@deepseek-ai/dsh-settings' does not provide an export named 'settingsNamespace'`
   - `anweat/dsh-restart` → 同款 host 侧导出缺失
   - `dsh-any-background` → `cannot get property "webServer" without inject`
   
   这意味着：**即使 verdict 蒙对，静态分析给出的「为什么」也常常是错的**——对外信件必须用回放得到的那条真实根因，而不是静态推断。

## 6. 边界（别过度承诺）

- 判的是「**装上之后 shell 能不能正常起来**」，不是「插件功能完全可用」。只渲染 UI 不做事的插件不会被本测试判负。
- 目前只覆盖**本机那一个 shell 版本**（0.1.5-rc.1）。矩阵化（多 shell 版本）是下一步。
- **会真实执行第三方 npm 包的 host 侧代码**。虽在隔离 DSH_HOME + 临时 profile 内（不写用户目录、不装进用户 profile），但仍以当前用户权限运行。因此本阶段**不进任何自动 profile**，只在手动/CI 沙箱里跑。
- 归因靠 baseline 差集；baseline 本身偶发波动会污染差集（用 `--fresh-baseline` 重采）。

## 7. 下一步

1. **CI 矩阵化**：`.github/workflows/replay.yml`（`workflow_dispatch` 手动触发，先跑通再考虑定时），多 shell 版本 × 队列目标。
2. **并入展示**：把 `data/replay.json` 的「实跑」结论叠到 `/p/` 详情页与 `/data/`，让静态判定与实测结论**并列可见**（互不覆盖，注明方法）。
3. **门禁化**：B2 队列里每个目标发信前必须 `ok` 反转为 `broken` 才允许发——即 `data/replay.json` 里 `verdict === 'broken'`。
