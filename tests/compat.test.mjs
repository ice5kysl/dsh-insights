import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runPipelineFixture } from './helpers/pipeline-fixture.mjs'

test('compat reads formal dsh engines first, falls back to legacy engines, and retains peers', (t) => {
  const manifests = {
    nested: { dsh: { engines: { dsh: '>=0.1.0-rc.7' } } },
    legacy: { engines: { dsh: '^0.1.0', node: '>=20' } },
    both: { dsh: { engines: { dsh: '>=0.2.0' } }, engines: { dsh: '^0.1.0' } },
    peers: { peerDependencies: { '@deepseek-ai/dsh': '^0.2.0', react: '^19' } },
    neither: {},
  }
  const responses = {
    'https://registry.npmjs.org/%40deepseek-ai/dsh': { body: { 'dist-tags': { latest: '0.2.0' }, versions: { '0.2.0': {} } } },
  }
  for (const [name, manifest] of Object.entries(manifests)) {
    responses[`https://registry.npmjs.org/${name}`] = { body: {
      'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': manifest },
    } }
  }
  const result = runPipelineFixture(t, 'pipeline/analyze/compat.mjs', {
    responses,
    files: { 'data/plugins.jsonl': Object.keys(manifests).map((pkgName) => JSON.stringify({ pkgName, full_name: `author/${pkgName}`, npm: { published: true } })).join('\n') },
  })
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.read('data/compat.json'))
  assert.deepEqual(output.plugins.map((p) => p.enginesDsh), ['>=0.1.0-rc.7', '^0.1.0', '>=0.2.0', null, null])
  assert.deepEqual(output.plugins[3].dshPeers, [{ name: '@deepseek-ai/dsh', range: '^0.2.0' }])
  assert.match(output.note, /dsh\.engines\.dsh/)
  assert.match(output.note, /not a runtime test/)
})
