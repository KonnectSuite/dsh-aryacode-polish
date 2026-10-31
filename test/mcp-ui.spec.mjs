/**
 * The MCP page in the generated bundle.
 *
 * The bundle is generated text, so these tests pin what the page must contain:
 * the settings registration, the route, the add-flow tabs, the catalog and
 * GitHub paths, and the absence of anything the Shell cannot serve.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const bundle = read('../lib/client.js')
const source = read('../client/mcp.js')
const switches = JSON.parse(read('../client/switches.json'))

test('the page is a settings section with its own id and order', () => {
  assert.ok(bundle.includes("name: 'settings.section'"))
  assert.ok(bundle.includes("id: 'mcp-servers'"))
  assert.ok(bundle.includes("label: () => 'MCP servers'"))
  assert.ok(bundle.includes('McpServersPage'))
})

test('the page talks to one host route', () => {
  assert.ok(bundle.includes("const MCP_ROUTE = 'api/polish.mcp'"))
  // Direct actions…
  for (const action of ['list', 'catalog', 'catalogEntry', 'search', 'parse']) {
    assert.ok(bundle.includes(`action: '${action}'`), `the ${action} action is missing`)
  }
  // …and the two that go through the shared runner.
  for (const action of ['save', 'test']) {
    assert.ok(bundle.includes(`run('${action}')`), `the ${action} action is missing`)
  }
  assert.ok(bundle.includes("action: 'toggle'"))
  assert.ok(bundle.includes("action: 'remove'"))
})

test('the add flow has all four ways in', () => {
  for (const tab of ['Catalog', 'GitHub', 'Paste', 'Manual']) {
    assert.ok(bundle.includes(`'${tab}'`), `the ${tab} tab is missing`)
  }
  assert.ok(bundle.includes('Browse the catalog'))
  assert.ok(bundle.includes('stdio (a local command)'))
  assert.ok(bundle.includes('streamable HTTP (a service)'))
})

test('the page warns about running a command and about secrets', () => {
  assert.ok(bundle.includes('runs on this machine'))
  assert.ok(bundle.includes('stored in the server list on this machine'))
  assert.ok(bundle.includes('Remove '))
})

test('the fragment makes no module request and no nested document', () => {
  assert.equal(source.includes('require('), false)
  for (const forbidden of ['iframe', 'XMLHttpRequest', '<script', 'import ']) {
    assert.equal(source.includes(forbidden), false, `client/mcp.js must not contain ${forbidden}`)
  }
  // The only fetch in the page is the host route: no absolute URL is fetched.
  assert.equal(/fetch\(\s*['"`]https?:/.test(source), false, 'the page must not fetch an absolute URL')
})

test('the switch is declared and documented', () => {
  const entry = switches.switches.find(candidate => candidate.key === 'mcpManager')
  assert.ok(entry !== undefined, 'mcpManager is missing from switches.json')
  assert.equal(entry.label, 'MCP servers')
  assert.equal(entry.defaultOn, true)
  assert.ok(entry.description.length > 20)
  const readme = read('../README.md')
  assert.ok(readme.includes('(`mcpManager`)'), 'the README must list the switch')
  assert.ok(readme.includes('docs/mcp-servers.md'), 'the README must link the page doc')
})
