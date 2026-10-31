/**
 * The AryaSearch card in the generated bundle: the slot it registers into, the
 * route it calls, the fields it offers, and the absence of anything the shell
 * cannot serve.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const bundle = read('../lib/client.js')
const source = read('../client/aryasearch.js')
const switches = JSON.parse(read('../client/switches.json'))

test('the card registers beside the shipped Web search card', () => {
  assert.ok(bundle.includes("name: 'plugins.item'"))
  assert.ok(bundle.includes("id: 'arya-search'"))
  assert.ok(bundle.includes("label: () => 'AryaSearch'"))
  assert.ok(bundle.includes('AryaSearchCard'))
})

test('the card talks to one host route', () => {
  assert.ok(bundle.includes("const ARYASEARCH_ROUTE = 'api/polish.websearch'"))
  for (const action of ['status', 'save', 'test']) {
    assert.ok(bundle.includes(`action: '${action}'`), `the ${action} action is missing`)
  }
})

test('the card exposes the mode, the endpoint and the auth choices', () => {
  for (const label of ['Automatic', 'Always', 'Off', 'Instance URL', 'Authentication', 'Bearer token', 'Basic auth', 'Custom headers', 'Search defaults']) {
    assert.ok(bundle.includes(label), `the card is missing "${label}"`)
  }
})

test('the card explains the selection it makes', () => {
  assert.ok(source.includes('Pins AryaSearch only while DeepSeek has no API key'))
  assert.ok(source.includes('the effective provider above is always read back from the Host'))
})

test('the fragment makes no module request and no nested document', () => {
  assert.equal(source.includes('require('), false)
  for (const forbidden of ['iframe', 'XMLHttpRequest', '<script', 'import ']) {
    assert.equal(source.includes(forbidden), false, `client/aryasearch.js must not contain ${forbidden}`)
  }
})

test('the switch is declared and documented', () => {
  const entry = switches.switches.find(candidate => candidate.key === 'aryaSearch')
  assert.ok(entry !== undefined, 'aryaSearch is missing from switches.json')
  assert.equal(entry.label, 'AryaSearch provider')
  assert.equal(entry.defaultOn, true)
  const readme = read('../README.md')
  assert.ok(readme.includes('(`aryaSearch`)'), 'the README must list the switch')
  assert.ok(readme.includes('docs/aryasearch.md'), 'the README must link the page doc')
})
