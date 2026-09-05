#!/usr/bin/env node
/**
 * Refresh extras used by CI (and locally when network allows):
 *   00 lists → 07 downloads → analyze → site → export → 08 diff
 *
 * @module dsh-plugin-insights/bin/refresh-extra
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const node = process.execPath
for (const script of ['00-lists.mjs', '07-downloads.mjs', '03-analyze.mjs', '04-site.mjs', '05-export.mjs', '08-diff.mjs']) {
  console.log(`=== ${script} ===`)
  const r = spawnSync(node, [join(ROOT, 'stages', script)], { stdio: 'inherit', env: { ...process.env } })
  if (r.status !== 0) { console.error(`failed ${script}`); process.exit(r.status ?? 1) }
}
console.log('[refresh-extra] done')
