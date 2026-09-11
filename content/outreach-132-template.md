# 132 坑外联信模板(观察站「一期一会」系列 · 修法专号)

> 用法:按 `content/outreach-132-targets.json` 顺序( stars 降序,先头部 20 个)逐个替换 `{{repo}}`/`{{pkg}}`/`{{detail}}` 变量;`deadOnly=true` 用 A 版正文,`false`(仅 4 个,多处缺失)用 B 版。发 GitHub issue,标题同信首行。

---

## A 版(deadOnly = 128/132):你不是坏了,是带着一段死代码

**标题:你的插件 bundle 里有一段永远走不到的 fallback(两行修复,顺带净化兼容矩阵标红)**

你好!我们是 [DSH Insights](https://dsh-insights.com) —— dsh 生态的独立观察站,定期向插件作者分享自家插件的可观测数据(上一期给 RevolutionLA/dsh-dream-skin 的报告帮助它定位了一个类似问题,作者已修复合入)。

**这次的发现**:{{repo}} 的 client bundle 里 require 了 `@deepseek-ai/dsh-client-runtime/client`。这个包虽然存在于 npm,但**从未被烘进任何一版 dsh shell 的模块表** —— dsh 的 loader 在任何版本上都解析不到它。

它大概率来自一段社区流传的兼容模板:

```js
try   { store = require('@deepseek-ai/dsh-client-store') }         // ✓ 正路(0.1.2-alpha.2 起收录)
catch { store = require('@deepseek-ai/dsh-client-runtime/client') } // ✗ 死路:走不到,且走到了也必炸
```

**对你的实际影响,取决于写法**(我们无法从 require 静态分析区分,所以两种都说清楚):

- 若是上面的 try/catch 模板:**dsh ≥ 0.1.2-alpha.2 上你的插件加载完全正常**,catch 分支只是死代码 —— 但我们的兼容矩阵按保守口径(集合中存在不可解析项即标红)会把 {{pkg}} 标为 broken,用户在升级前查矩阵时会被误导
- 若是裸 require:那在所有版本上都会崩,更值得删

**修复(两行)**:删掉 catch 分支,只留 `dsh-client-store`;若还想支持 ≤0.1.1 旧 shell,与其留死 fallback,不如声明 `engines.dsh` 或运行时探测

**顺带三条我们踩过坑的建议**:

1. 若声明 `engines.dsh`,注意 semver 预发布陷阱:`>=0.1.0-rc.6` 按标准字面解读会把 0.1.1-rc.x/0.1.2-rc.x 全判不兼容(实测案例见我们的 [口径说明](https://dsh-insights.com/about/))—— 本站一律按基础版本口径解读
2. 修完删干净后,你的兼容矩阵行会自动转绿(次日快照):{{detail}}
3. 可选:README 加一行健康徽章(每日自动刷新,零维护):
   `[![DSH Insights health](https://dsh-insights.com/badge/{{repo}}.svg)](https://dsh-insights.com/p/{{repo}}/)`

完整修法与全部 132 个同坑案例:dsh-insights.com 的 fixes.json(`dsh-client-runtime/client` 条目)。打扰了,数据有误欢迎直接反驳 🙏

---

## B 版(deadOnly = false,仅 4 个):除死代码外还有真实缺失

正文同 A 版,但把「实际影响」段替换为:

**你的插件除上述死模块外,还有 {{otherMissing}} 未被当前 shell 模块表收录(完整清单见下方详情页)—— 这部分是真实的加载破坏,建议一并处理;详情页逐行列出了每个 require 的可解析性。**

---

## 英文版(附在 issue 末尾,折叠)

<details><summary>English</summary>

We're [DSH Insights](https://dsh-insights.com), an independent observatory of the dsh plugin ecosystem, sharing observable data with plugin authors.

**Finding**: {{repo}}'s client bundle requires `@deepseek-ai/dsh-client-runtime/client` — a package that exists on npm but has never been seeded into any released dsh shell's module table, so the loader can never resolve it (any version). It most likely came from a circulating compatibility snippet (`try dsh-client-store / catch dsh-client-runtime`). If it's inside that try/catch: your plugin loads fine on dsh ≥ 0.1.2-alpha.2, and the catch branch is dead code — but our conservative compatibility matrix flags {{pkg}} broken, which misleads users checking before upgrades. If it's a bare require, it crashes everywhere and is even more worth removing.

**Fix (two lines)**: delete the catch branch, keep `dsh-client-store`; declare `engines.dsh` or probe at runtime if you must support older shells. Your matrix row turns green on the next daily snapshot: {{detail}}

Optional: a free, zero-maintenance health badge for your README —
`[![DSH Insights health](https://dsh-insights.com/badge/{{repo}}.svg)](https://dsh-insights.com/p/{{repo}}/)`

Full fix guidance and all 132 sibling cases: fixes.json on dsh-insights.com. Corrections welcome — we publish our methodology.

</details>
