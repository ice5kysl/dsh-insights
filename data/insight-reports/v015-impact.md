# v0.1.5 对 dsh 生态的影响:一份基于全量实测的观察

> 数据口径:DSH Insights 2026-09-11 快照 · 兼容矩阵 2431 插件 × 4 shell 版本逐插件实测 · 所有数字可在本站 /data/ 复核。
> Data: DSH Insights 2026-09-11 snapshot · compatibility matrix = 2431 plugins × 4 shell versions, per-plugin load-tested · every number verifiable via /data/.

## TL;DR

1. **兼容性:零风险**。0.1.2-rc.1 → 0.1.5-rc.1 逐插件实测 **0 治愈、0 新破坏**,模块表与 0.1.2 完全一致 —— 生态里 144 个坏插件全是存量,其中 132 个(92%)坏在同一个从未被任何 shell 收录的模块上。
2. **真正的升级门槛不是兼容,是 Node 版本**:CLI 在 Node < 24.21 上**零输出静默退出**(官方公告的 `npx` 路径全覆盖中招),社区已 3 例确认。
3. **结构性影响大于兼容影响**:公告内置的侧栏文件树/预览直接作用于生态最大类目 —— **1522 个侧栏/文件类插件(占权威集 14%)进入收编带**,头部三家合计周下载 ~8.5 万。
4. **公告效应真实但温和**:新插件创建日新增回升至 98/日(周内次高)。
5. **卫生观察**:官方 npm dist-tag 曾长期指向远古版本;`engines` 未声明;`engines.dsh` 的 semver 预发布陷阱会广播与作者意图相反的信号。

## 一、兼容性:一次零风险升级

Compat: a zero-risk upgrade

对权威集 2431 个已发布插件,我们将其最新版 client bundle 的全部外部 require 对照 0.0.1-rc.5 / 0.1.2-rc.1 / 0.1.5-alpha.2 / 0.1.5-rc.1 四档 shell 的模块表逐插件实测加载:

| shell | ok | broken | conditional |
|---|---|---|---|
| 0.0.1-rc.5(旧 latest tag) | 2332 | 81 | 0 |
| 0.1.2-rc.1(升级源) | 2266 | 144 | 3 |
| 0.1.5-alpha.2 | 2266 | 144 | 3 |
| **0.1.5-rc.1** | **2266** | **144** | **3** |

**0.1.2 → 0.1.5:零迁移。** 没有 plugin 因升级而坏,也没有因升级而愈。144 个 broken 中:

- **132 个(92%)缺的是 `@deepseek-ai/dsh-client-runtime/client`** —— 一个从未被烘进任何已发布 shell 模块表的模块。修法是确定的:迁移到 `dsh-client-store`(0.1.2-alpha.2 起收录,同名 API,多数一行替换),详见修法库。
- 其余为 node 内建 require(stream/buffer/fs 等 ~13 个)与个别 UI 模块。

**结论:担心升级弄坏插件的用户可以放心升 —— 你们的插件如果今天能用,0.1.5 上也能用。**

## 二、真正的门槛:Node 版本静默坑

The real gate: the silent Node-version trap

`@deepseek-ai/dsh` 0.1.5 的 CLI 入口以 `if (import.meta.main)` 守卫,该属性在旧 Node 上为 `undefined` —— **整个 CLI 零输出、退出码 0**。`--version`、`--help`、`web` 全部静默。实测版本线:

| Node | 结果 |
|---|---|
| 22.14 / 23.11 / 24.0 / 24.1 | ❌ 静默失败 |
| **24.21 / 25.9 / 26.8** | ✅ 正常 |

官方公告"已安装 Node.js 开发工具链即可 `npx` 快速启动"—— 但所有 Node ≤ 24.20 的用户踩到的不是报错,是**什么都没有**。详见官方 Discussions #6124(含我们的全版本实测表与修复建议:声明 `engines` + 运行时守卫)。升级前请先 `node --version`。

## 三、结构性影响:1522 个插件的收编带

Structural impact: the 1,522-plugin absorption zone

公告内置的右侧 Sidebar 文件树 + 多格式预览,与「侧栏 / 工作区」「文件浏览 / 预览」两个类目正面重叠 —— 合计 **1522 个插件(权威集的 14%)**,其中包括生态下载榜头部:

| 插件 | 周下载 | 重叠点 |
|---|---|---|
| dsh-better-sidebar | 43,309(生态第 2) | 侧栏增强 |
| dsh-univer-office | 26,504 | 文件预览/编辑 |
| dsh-context | 15,102 | 文件浏览/预览 |

这不是"官方抄袭插件",而是平台成熟化的必然一步;但同一份公告也给出了对冲:**左右两侧标准化插件扩展入口**。收编带里的插件,出路是做内置不做的事(更深的格式支持、编辑、外部集成),而不是和内置比基础浏览。同时提醒:官方预告的「内置插件管理面板」是下一块会落地的区域。

## 四、公告效应:涌入真实但温和

Announcement effect: real but mild

权威集内按仓库创建日的新增:09-08 82 → 09-09 78 → **09-10(公告日)98** —— 回升至周内次高,次于 09-03 的 102。公告拉新存在,但生态的主要增量仍来自日常惯性而非单日脉冲。

## 五、卫生观察(给官方的三条)

Hygiene notes for the dsh team

1. **dist-tag 卫生**:npm `latest` 曾长期指向远古的 0.0.1-rc.5(我们的矩阵快照留有证据),公告日才移正 —— 建议发版即移 tag。
2. **engines 缺失 + 静默失败**:package.json 无 `engines`,旧 Node 安装无警告、运行无输出(见 #6124)。
3. **`engines.dsh` 的 semver 预发布陷阱**:`>=0.1.0-rc.6` 字面上把 0.1.1-rc.x / 0.1.2-rc.x 全判不兼容,与作者意图相反(dsh-dream-skin 实测后弃用声明改运行时探测)。若未来宿主强制校验该字段,需要先定义预发布语义。

---

*方法与数据:兼容矩阵 = 最新版 tarball 的 client bundle 静态 require 提取 × shell 模块表判定(三态:ok/conditional/broken),缓存入 git、每日增量;全部原始数据见 /data/compat-observed.json,修法见 /data/fixes.json。观察站与 DeepSeek 官方无隶属关系;发现误判请提 issue。*
