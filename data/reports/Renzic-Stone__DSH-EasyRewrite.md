# 插件报告 · Renzic-Stone/DSH-EasyRewrite

> 生成 2026-09-05 · dsh-plugin-insights / Stage 17 · 启发式评估，非安全审计

**A**（96/100）· 分类「记忆 / 知识」· ★102

- 仓库：https://github.com/Renzic-Stone/DSH-EasyRewrite
- npm：`dsh-easyrewrite@2.3.1`（28 版本）
- 最近 push：2026-08-31 · 创建 2026-08-18
- 收录：awesome-dsh-plugin — · imsai —
- 同类（记忆 / 知识，62 个）分位：击败 **100%**（中位 66 分）

## 打分明细

| 加分项 | +分 |
|---|---|
| manifest 清单 | +8 |
| README | +6 |
| 中英/双语 | +10 |
| LICENSE | +4 |
| lib/index.js | +5 |
| lib/client.js | +5 |
| npm 已发布 | +8 |
| 版本同步 | +6 |
| 近30天活跃 | +5 |
| 有 star | +6 |
| 高社区关注 | +8 |
| 基分 | 25 |

## 清单与产物

README ✅ · 中文/双语 ✅ · LICENSE ✅ · cordis.patch ✅ · lib/index.js ✅ · lib/client.js ✅ · client 导出 —

## LLM 解读

消息撤回与重编辑插件，兼容性强，设置丰富，UI现代化且轻量。
- 能力主类：message-edit
- 能力标签：recall、rewrite、message、edit、settings、ui
- 可验证宣称：native experience；strong compatibility；simple toggles；rich settings；modern lightweight UI

## 建议优化清单（按性价比）

| 动作 | 影响 | 怎么做 |
|---|---|---|
| 声明 exports["./client"] | +4 · 官方加载器解析需要 | package.json exports 增加 ./client → lib/client.js |
| 提交 awesome-dsh-plugin | 曝光与反向链接（见下方文案） | fork → data/plugins/<owner>__<repo>.yml → PR（≤3 条/PR） |
| 提交 imsai / deepseek1024 目录 | 覆盖另一主流渠道 | fork → catalog/plugins JSON → 一个 PR 一条 |
| 等待周下载数据入库 | 用于展示真实使用度 | 由 CI refresh 自动补齐 downloads.json |

---

## 提交收录（可复制）

### awesome-dsh-plugin（data/plugins/Renzic-Stone__DSH-EasyRewrite.yml）
```yaml
url: https://github.com/Renzic-Stone/DSH-EasyRewrite
name: Renzic-Stone/DSH-EasyRewrite
category: ui
description:
  en: DSH Web内目前最无感的消息撤回、重编辑插件，原版体验，兼容性强，功能简单可开关，设置丰富，现代化轻量ui框架。The most seamless message recall & re-edit plugin for DSH Web — native experience, strong compatibility, simple toggles, rich settings, modern lightweight UI. DSH
```

### PR 描述（EN/中文）

Add Renzic-Stone/DSH-EasyRewrite（category ui）—— 标准 Cordis bundle 插件，中英双语，目标 dsh ≥ 0.1.1-rc.2；npm：`dsh-easyrewrite@2.3.1`。

