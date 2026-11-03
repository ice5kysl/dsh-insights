import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')

// Run the real CLI and filesystem writes in an isolated directory; only HTTP is stubbed.
export function runPipelineFixture(t, script, { responses, files = {} }) {
  // Canonicalize macOS /var -> /private/var so CLI import.meta.url guards run.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-pipeline-test-')))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  for (const file of [script, 'lib/api.mjs', 'lib/data.mjs']) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    copyFileSync(join(ROOT, file), join(dir, file))
  }
  mkdirSync(join(dir, 'data'), { recursive: true })
  for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content)
  writeFileSync(join(dir, 'responses.json'), JSON.stringify(responses))
  writeFileSync(join(dir, 'fetch-fixture.mjs'), `
    import { readFileSync } from 'node:fs'
    const responses = JSON.parse(readFileSync(new URL('./responses.json', import.meta.url)))
    globalThis.fetch = async (url) => {
      const fixture = responses[String(url)]
      if (!fixture) throw new Error('Unexpected request: ' + url)
      return new Response(JSON.stringify(fixture.body), { status: fixture.status ?? 200 })
    }
  `)
  const result = spawnSync(process.execPath, ['--import', join(dir, 'fetch-fixture.mjs'), join(dir, script)], {
    cwd: dir,
    env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '' },
    encoding: 'utf8',
    timeout: 20000,
  })
  assertFinished(result)
  return { ...result, read: (file) => readFileSync(join(dir, file), 'utf8') }
}

function assertFinished(result) {
  if (result.error) throw result.error
  if (result.signal) throw new Error(`Pipeline terminated: ${result.signal}\n${result.stderr}`)
}
