import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runPipelineFixture } from './helpers/pipeline-fixture.mjs'

const AWESOME = 'https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin'
const IMSAI = 'https://api.github.com/repos/imsai-sh/awesome-deepseek-harness-plugins'
const previous = JSON.stringify({ fetchedAt: '2026-01-01T00:00:00Z', awesome: ['old/plugin'], imsai: ['old/other'] })
const entry = (path, type = 'blob') => ({ path, type, mode: type === 'tree' ? '040000' : '100644', sha: `${path}-sha` })
const tree = (entries) => ({ body: { sha: 'snapshot-sha', truncated: false, tree: entries } })

function responses(awesomeFiles = [entry('author__plugin.yml')]) {
  return {
    // Keep the old Contents endpoint in the fixture to reproduce its 1,000-entry cap.
    [`${AWESOME}/contents/data/plugins`]: { body: awesomeFiles.slice(0, 1000).map((e) => ({ name: e.path, type: e.type === 'blob' ? 'file' : 'dir' })) },
    [`${IMSAI}/contents/catalog/plugins`]: { body: [{ name: 'another--plugin.json', type: 'file' }] },
    [`${AWESOME}/git/trees/HEAD`]: tree([entry('data', 'tree')]),
    [`${AWESOME}/git/trees/data-sha`]: tree([entry('plugins', 'tree')]),
    [`${AWESOME}/git/trees/plugins-sha`]: tree(awesomeFiles),
    [`${IMSAI}/git/trees/HEAD`]: tree([entry('catalog', 'tree')]),
    [`${IMSAI}/git/trees/catalog-sha`]: tree([entry('plugins', 'tree')]),
    [`${IMSAI}/git/trees/plugins-sha`]: tree([entry('another--plugin.json')]),
  }
}

function collect(t, fixtures) {
  return runPipelineFixture(t, 'pipeline/collect/lists.mjs', {
    responses: fixtures,
    files: { 'data/listed.json': previous },
  })
}

test('lists collects entries beyond the Contents API 1,000-file cap', (t) => {
  const entries = Array.from({ length: 1000 }, (_, i) => entry(`author${i}__plugin.yml`))
  entries.push(entry('z-author__last-plugin.yml'))
  const result = collect(t, responses(entries))
  assert.equal(result.status, 0, result.stderr)
  const listed = JSON.parse(result.read('data/listed.json'))
  assert.equal(listed.awesome.length, 1001)
  assert.ok(listed.awesome.includes('z-author/last-plugin'))
  assert.deepEqual(listed.imsai, ['another/plugin'])
})

test('lists includes only immediate catalog files, not directories or unrelated files', (t) => {
  const result = collect(t, responses([
    entry('author__plugin.yml'), entry('fake__directory.yml', 'tree'),
    entry('fake__notes.md'), entry('README.md'), entry('__missing-owner.yml'),
    entry('author__repo--name.yml'), entry('wrong--catalog.json'),
    entry('author__.yml'), entry('nested/author__plugin.yml'),
  ]))
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.read('data/listed.json')).awesome, ['author/plugin', 'author/repo--name'])
})

for (const [name, key, response] of [
  ['truncated target tree', `${AWESOME}/git/trees/plugins-sha`, { body: { truncated: true, tree: [entry('partial__plugin.yml')] } }],
  ['truncated parent tree', `${AWESOME}/git/trees/HEAD`, { body: { truncated: true, tree: [entry('data', 'tree')] } }],
  ['failed second catalog', `${IMSAI}/git/trees/plugins-sha`, { status: 503, body: { message: 'Service Unavailable' } }],
  ['malformed tree', `${AWESOME}/git/trees/plugins-sha`, { body: { truncated: false } }],
  ['malformed entry', `${AWESOME}/git/trees/plugins-sha`, tree([null])],
  ['unknown completeness', `${AWESOME}/git/trees/plugins-sha`, { body: { tree: [] } }],
  ['missing catalog path', `${AWESOME}/git/trees/data-sha`, tree([])],
]) {
  test(`lists preserves the entire previous snapshot on ${name}`, (t) => {
    const fixtures = responses()
    fixtures[key] = response
    // Old code silently replaces the failed directory with an empty list.
    if (name === 'failed second catalog') fixtures[`${IMSAI}/contents/catalog/plugins`] = response
    const result = collect(t, fixtures)
    assert.equal(result.read('data/listed.json'), previous)
    assert.notEqual(result.status, 0, 'incomplete collection must fail visibly')
  })
}

test('lists accepts a complete empty catalog as an empty membership list', (t) => {
  const result = collect(t, responses([]))
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.read('data/listed.json')).awesome, [])
})
