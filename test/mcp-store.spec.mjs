/**
 * MCP server definitions: the validator, the paste importer and the store.
 *
 * These are the rules the page and the host both depend on, so they are tested
 * without a Host: a bad entry must fail before it can reach a child process.
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  SERVER_NAME_PATTERN,
  bridgeConfig,
  draftFromPaste,
  isServerName,
  newServerId,
  normalizeServer,
  sanitizeName,
  serverSummary,
  splitCommandLine,
} from '../mcp/validate.js'
import { emptyStore, isSecretKey, publicServer, readStore, storePath, writeStore } from '../mcp/store.js'

const existing = [
  { id: 'srv_a', serverName: 'github', label: 'GitHub' },
  { id: 'srv_b', serverName: 'files', label: 'Files' },
]

test('a stdio entry keeps the bridge shape and the bookkeeping', () => {
  const { server, errors } = normalizeServer({
    id: 'srv_x',
    serverName: 'memory',
    label: '',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: { TOKEN: 'secret', COUNT: 3, DROP: null },
    createdAt: 10,
  }, { existing, now: 99 })
  assert.deepEqual(errors, [])
  assert.equal(server.id, 'srv_x')
  assert.equal(server.label, 'memory', 'a blank label falls back to the name')
  assert.deepEqual(server.env, { TOKEN: 'secret', COUNT: '3' }, 'numbers stringify, nulls drop')
  assert.equal(server.createdAt, 10)
  assert.equal(server.updatedAt, 99)
  assert.equal(server.failOnStartupError, true)
  assert.deepEqual(server.reconnect, { enabled: true })

  assert.deepEqual(bridgeConfig(server), {
    transport: 'stdio',
    serverName: 'memory',
    toolCallTimeoutMs: 60000,
    failOnStartupError: true,
    reconnect: { enabled: true },
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: { TOKEN: 'secret', COUNT: '3' },
  })
})

test('an http entry carries the URL and headers only', () => {
  const { server, errors } = normalizeServer({
    serverName: 'remote',
    transport: 'streamable-http',
    url: 'https://mcp.example.com/mcp',
    headers: { Authorization: 'Bearer x' },
    command: 'should-be-dropped',
  }, { existing })
  assert.deepEqual(errors, [])
  assert.equal(server.command, '')
  assert.deepEqual(server.env, {})
  const config = bridgeConfig(server)
  assert.equal(config.url, 'https://mcp.example.com/mcp')
  assert.deepEqual(config.headers, { Authorization: 'Bearer x' })
  assert.equal(config.command, undefined)
})

test('names are checked against the bridge rule and the list', () => {
  const bad = normalizeServer({ serverName: 'has space', transport: 'stdio', command: 'x' }, { existing })
  assert.equal(bad.server, null)
  assert.equal(bad.errors[0].field, 'serverName')
  assert.equal(SERVER_NAME_PATTERN.test('ok_name-1'), true)
  assert.equal(isServerName('x'.repeat(33)), false)

  const clash = normalizeServer({ id: 'srv_c', serverName: 'github', transport: 'stdio', command: 'x' }, { existing })
  assert.equal(clash.server, null)
  assert.match(clash.errors[0].message, /already used by "GitHub"/)
})

test('required fields depend on the transport', () => {
  const noCommand = normalizeServer({ serverName: 'a', transport: 'stdio' }, { existing })
  assert.equal(noCommand.errors.some(error => error.field === 'command'), true)
  const noUrl = normalizeServer({ serverName: 'b', transport: 'streamable-http' }, { existing })
  assert.equal(noUrl.errors.some(error => error.field === 'url'), true)
  const badUrl = normalizeServer({ serverName: 'c', transport: 'streamable-http', url: 'ftp://x' }, { existing })
  assert.equal(badUrl.errors.some(error => error.field === 'url'), true)
})

test('every problem is collected, not just the first', () => {
  const { server, errors } = normalizeServer({ serverName: '!!', transport: 'carrier-pigeon' }, { existing })
  assert.equal(server, null)
  assert.ok(errors.length >= 2, 'name and transport are both reported')
})

test('ids are unique enough and prefixed', () => {
  const first = newServerId(1000, () => 0.5)
  const second = newServerId(1000, () => 0.6)
  assert.match(first, /^srv_[a-z0-9]+$/)
  assert.notEqual(first, second)
})

test('a command line splits on quotes and whitespace', () => {
  assert.deepEqual(splitCommandLine('npx -y "some package" a'), ['npx', '-y', 'some package', 'a'])
  assert.deepEqual(splitCommandLine("uvx 'mcp-server-git' --repository ."), ['uvx', 'mcp-server-git', '--repository', '.'])
})

test('paste understands a runner, a URL and JSON', () => {
  const command = draftFromPaste('npx -y @modelcontextprotocol/server-filesystem .')
  assert.equal(command.error, '')
  assert.equal(command.draft.transport, 'stdio')
  assert.equal(command.draft.command, 'npx')
  // The scope is stripped: a bridge server name has no @scope/ prefix.\n  assert.equal(command.draft.serverName, 'server-filesystem')
  assert.deepEqual(command.draft.args, ['-y', '@modelcontextprotocol/server-filesystem', '.'])

  const url = draftFromPaste('https://mcp.example.com/mcp')
  assert.equal(url.draft.transport, 'streamable-http')
  assert.equal(url.draft.url, 'https://mcp.example.com/mcp')

  const json = draftFromPaste(JSON.stringify({ serverName: 'one', transport: 'stdio', command: 'node' }))
  assert.equal(json.draft.serverName, 'one')

  const nonsense = draftFromPaste('hello there')
  assert.equal(nonsense.draft, null)
  assert.match(nonsense.error, /starts with npx/)
})

test('sanitizeName keeps the bridge pattern', () => {
  assert.equal(sanitizeName('@modelcontextprotocol/server-github'), 'server-github')
  assert.equal(sanitizeName('A B C'), 'A-B-C')
  assert.equal(sanitizeName('!!!'), 'mcp')
})

test('the summary is what the card prints', () => {
  assert.equal(serverSummary({ transport: 'stdio', command: 'npx', args: ['-y', 'pkg'] }), 'npx -y pkg')
  assert.equal(serverSummary({ transport: 'streamable-http', url: 'https://x/mcp' }), 'https://x/mcp')
})

test('the store round-trips and masks secrets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arya-mcp-'))
  try {
    const file = storePath(dir)
    assert.equal(file.endsWith('mcp-servers.json'), true)
    assert.deepEqual(readStore(file), { store: emptyStore(), recovered: null })

    const state = { version: 1, servers: [{ id: 'srv_a', serverName: 'github', env: { GITHUB_TOKEN: 't' }, headers: { Authorization: 'x', Accept: 'json' } }] }
    writeStore(file, state)
    const back = readStore(file)
    assert.deepEqual(back.store.servers, state.servers)
    assert.equal(back.recovered, null)

    const publicOne = publicServer(state.servers[0])
    assert.equal(publicOne.env.GITHUB_TOKEN, '********')
    assert.equal(publicOne.headers.Authorization, '********')
    assert.equal(publicOne.headers.Accept, 'json', 'non-secret headers stay readable')
    assert.deepEqual(publicOne.secretKeys.sort(), ['Authorization', 'GITHUB_TOKEN'])
    assert.equal(isSecretKey('BRAVE_API_KEY'), true)
    assert.equal(isSecretKey('Accept'), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a corrupt file is moved aside and an empty list returned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arya-mcp-'))
  try {
    const file = storePath(dir)
    writeFileSync(file, '{ not json', 'utf8')
    const { store, recovered } = readStore(file)
    assert.deepEqual(store, emptyStore())
    assert.notEqual(recovered, null)
    assert.equal(readFileSync(recovered, 'utf8'), '{ not json')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
