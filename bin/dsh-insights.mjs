#!/usr/bin/env node
/**
 * dsh-insights — 兼容别名：转发到统一编排器 bin/pipeline.mjs
 *
 *   node bin/dsh-insights.mjs run [--limit N] [--skip-discover]
 *     → node bin/pipeline.mjs full（LIMIT 经环境变量透传；
 *       --skip-discover → --from validate）
 *
 * @module dsh-insights/cli
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const li = args.indexOf('--limit')
const env = li >= 0 ? { ...process.env, LIMIT: String(Number(args[li + 1]) || 0) } : { ...process.env }
const forward = args.includes('--skip-discover') ? ['full', '--from', 'validate'] : ['full']
const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'pipeline.mjs'), ...forward], { stdio: 'inherit', env })
process.exit(r.status ?? 1)
