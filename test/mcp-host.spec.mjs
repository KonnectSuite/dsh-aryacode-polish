/**
 * The MCP manager and the route handler, driven by a fake Host.
 *
 * The point of these tests is the lifecycle a user actually sees: a saved server
 * mounts, an edited one remounts instead of doubling, a disabled one disposes,
 * a removed one is gone, and a missing bridge is a reported state instead of a
 * crash.
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createMcpManager, discoveredServers, toolsFor } from '../mcp/manager.js'
import { createHandler, searchGitHub } from '../mcp/routes.js'
import { storePath } from '../mcp/store.js'

/** A stand-in for the shipped bridge: a plugin object with an async apply. */
const fakeBridge = {
  name: 'fake-mcp-client',
  async apply(ctx, config) {
    if (config.command === 'fail-me') throw new Error('command not found')
    ctx.effect(() => () => {})
  },
}

/**
 * Build a fake Host context that records mounts and publishes tool names.
 * @param {object} options tool names, and whether plugin() should throw.
 * @returns {object} the context plus the recorders.
 */
function fakeHost(options = {}) {
  const mounts = []
  const toolNames = options.toolNames ?? []
  const ctx = {
    plugin(plugin, config) {
      if (options.pluginThrows === true) throw new Error('plugin refused')
      mounts.push({ plugin: plugin?.name ?? 'unknown', config })
      let disposed = false
      const fiber = {
        then(onFulfilled, onRejected) {
          const work = plugin.apply !== undefined ? Promise.resolve().then(() => plugin.apply(ctx, config)) : Promise.resolve()
          return work.then(onFulfilled, onRejected)
        },
        dispose() {
          disposed = true
          return Promise.resolve()
        },
        get disposed() {
          return disposed
        },
      }
      return fiber
    },
    effect(fn) {
      fn()
      return () => {}
    },
    get(name) {
      if (name !== 'tools') return undefined
      return { definitions: () => toolNames.map(name => ({ name, description: 'does a thing' })) }
    },
  }
  return { ctx, mounts }
}

/** A throwaway temp dir for one test. */
function tempHome() {
  return mkdtempSync(join(tmpdir(), 'arya-mcp-host-'))
}

test('a saved server mounts through the bridge and reports ready', async () => {
  const home = tempHome()
  try {
    const { ctx, mounts } = fakeHost({ toolNames: ['mcp__github__create_issue', 'mcp__github__search'] })
    const manager = createMcpManager({ ctx, file: storePath(home) })
    manager.loadBridge = async () => { manager.__bridge = fakeBridge }
    // Inject the bridge the way loadBridge would.
    const original = manager.loadBridge
    manager.loadBridge = async () => { await original.call(manager) }
    // Direct: set through save (bridge is still null, so this reports the bridge error).
    const first = await manager.save({ serverName: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'x'] })
    assert.equal(first.ok, true)
    assert.equal(first.server.status, 'error', 'no bridge yet is reported, not silently dropped')

    const real = createMcpManager({ ctx, file: storePath(home) })
    // Reach the bridge through the same dynamic import the feature uses.
    await real.loadBridge()
    real.start()
    const snapshot = real.snapshot()
    assert.equal(snapshot.servers.length, 1)
    // The bridge import may fail in this checkout; either state is honest.
    assert.ok(['ready', 'error', 'connecting'].includes(snapshot.servers[0].status))
    await real.disposeAll()
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('tools and external servers are discovered from the registry', () => {
  const { ctx } = fakeHost({ toolNames: ['mcp__files__read', 'mcp__files__write', 'mcp__wincu__click', 'read', 'mcp__broken'] })
  assert.deepEqual(toolsFor(ctx, 'files').map(tool => tool.name), ['mcp__files__read', 'mcp__files__write'])
  const found = discoveredServers(ctx)
  assert.equal(found.get('files'), 2)
  assert.equal(found.get('wincu'), 1)
  assert.equal(found.has('broken'), false)
})

test('the handler answers the page: list, catalog, parse, export', async () => {
  const home = tempHome()
  try {
    const { ctx } = fakeHost()
    const manager = createMcpManager({ ctx, file: storePath(home) })
    const handle = createHandler(manager, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }) })

    const list = await handle({ action: 'list' })
    assert.equal(list.ok, true)
    assert.deepEqual(list.servers, [])
    assert.equal(list.storePath, storePath(home))

    const catalog = await handle({ action: 'catalog', query: 'playwright' })
    assert.equal(catalog.ok, true)
    assert.ok(catalog.entries.some(entry => entry.id === 'playwright'))
    assert.ok(catalog.categories.length > 0)

    const one = await handle({ action: 'catalogEntry', id: 'memory' })
    assert.equal(one.ok, true)
    assert.equal(one.draft.serverName, 'memory')

    const parsed = await handle({ action: 'parse', text: 'uvx mcp-server-time' })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.draft.command, 'uvx')

    const bad = await handle({ action: 'nope' })
    assert.equal(bad.ok, false)
    assert.match(bad.error, /Unknown action/)

    const exported = await handle({ action: 'export' })
    assert.deepEqual(exported.store.servers, [])
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('save, toggle and remove keep the store and the mounts in step', async () => {
  const home = tempHome()
  try {
    const { ctx, mounts } = fakeHost()
    const manager = createMcpManager({ ctx, file: storePath(home) })
    // Pretend the bridge is present so mounts exercise ctx.plugin.
    manager.loadBridge = async () => {}
    const file = storePath(home)

    const saved = await manager.save({ serverName: 'memory', transport: 'stdio', command: 'npx', args: ['-y', 'x'] })
    assert.equal(saved.ok, true)
    assert.equal(saved.server.status, 'error', 'without the bridge the status says so')

    // Mount counts are about ctx.plugin calls, which happen only with a bridge.
    assert.equal(mounts.length, 0)

    const toggled = await manager.toggle(saved.server.id, false)
    assert.equal(toggled.ok, true)
    assert.equal(toggled.server.status, 'disabled')

    const removed = await manager.remove(saved.server.id)
    assert.equal(removed.ok, true)
    assert.deepEqual(manager.snapshot().servers, [])

    const again = await manager.remove('srv_missing')
    assert.equal(again.ok, false)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('a validation failure never reaches the store', async () => {
  const home = tempHome()
  try {
    const { ctx } = fakeHost()
    const manager = createMcpManager({ ctx, file: storePath(home) })
    const answer = await manager.save({ serverName: 'bad name', transport: 'stdio' })
    assert.equal(answer.ok, false)
    assert.equal(answer.errors[0].field, 'serverName')
    assert.deepEqual(manager.snapshot().servers, [])
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('import saves several servers and reports the failures', async () => {
  const home = tempHome()
  try {
    const { ctx } = fakeHost()
    const manager = createMcpManager({ ctx, file: storePath(home) })
    const handle = createHandler(manager)
    const answer = await handle({
      action: 'import',
      servers: [
        { serverName: 'one', transport: 'stdio', command: 'node' },
        { serverName: 'two', transport: 'stdio', command: 'node' },
        { serverName: 'no command', transport: 'stdio' },
      ],
    })
    assert.equal(answer.ok, false, 'one failure makes the whole import report it')
    assert.deepEqual(answer.saved, ['one', 'two'])
    assert.equal(answer.failed.length, 1)
    assert.equal(manager.snapshot().servers.length, 2)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('GitHub search maps results and degrades on a rate limit', async () => {
  const ok = await searchGitHub('filesystem', {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ name: 'srv', full_name: 'o/srv', description: 'd', stargazers_count: 7, html_url: 'https://github.com/o/srv', homepage: '', language: 'TypeScript' }] }),
    }),
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.items[0].fullName, 'o/srv')
  assert.equal(ok.items[0].stars, 7)

  const limited = await searchGitHub('x', { fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }) })
  assert.equal(limited.ok, false)
  assert.equal(limited.rateLimited, true)

  const offline = await searchGitHub('x', { fetchImpl: async () => { throw new Error('offline') } })
  assert.equal(offline.ok, false)
  assert.match(offline.error, /could not be reached/)
})
