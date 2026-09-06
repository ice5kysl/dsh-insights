#!/usr/bin/env node
/**
 * 兼容别名：原 refresh-extra → 统一编排器 daily profile。
 *   node bin/refresh-extra.mjs  →  node bin/pipeline.mjs daily
 *
 * @module dsh-insights/bin/refresh-extra
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const r = spawnSync(process.execPath, [join(import.meta.dirname, 'pipeline.mjs'), 'daily'], { stdio: 'inherit', env: { ...process.env } })
process.exit(r.status ?? 1)
