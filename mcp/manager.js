/**
 * The MCP server runtime: one mounted `@deepseek-ai/dsh-mcp-client` fiber per
 * enabled server, plus the list on disk.
 *
 * Why fibers instead of profile rows: the bridge's `Config` has no volatile
 * fields, so `configForms` refuses to write it, and a plugin cannot create a
 * loader row at all. Mounting the shipped bridge as a child plugin is the seam
 * this harness already uses for features (see `entries/polish.js`), it keeps the
 * bridge's own tool naming and resource registration, and it makes add, remove
 * and disable take effect without a restart.
 *
 * @module dsh-aryacode-polish-mcp-manager
 */

import { bridgeConfig, normalizeServer, serverSummary } from './validate.js'
import { publicServer, readStore, storePath, writeStore } from './store.js'

/** How long a "test" waits for a server's first tool sync. */
export const TEST_TIMEOUT_MS = 20000

/**
 * Read the mounted tool names for one bridge server namespace.
 * @param {object} ctx the host context.
 * @param {string} serverName the bridge server name.
 * @returns {Array<{ name: string, description: string }>} the tools.
 */
export function toolsFor(ctx, serverName) {
  const registry = typeof ctx?.get === 'function' ? ctx.get('tools') : undefined
  const definitions = typeof registry?.definitions === 'function' ? registry.definitions() : []
  const prefix = `mcp__${serverName}__`
  return definitions
    .filter(definition => typeof definition?.name === 'string' && definition.name.startsWith(prefix))
    .map(definition => ({ name: definition.name, description: String(definition.description ?? '') }))
}

/**
 * Every bridge-managed tool namespace visible right now, including servers
 * mounted by another plugin.
 * @param {object} ctx the host context.
 * @returns {Map<string, number>} server name -> tool count.
 */
export function discoveredServers(ctx) {
  const registry = typeof ctx?.get === 'function' ? ctx.get('tools') : undefined
  const definitions = typeof registry?.definitions === 'function' ? registry.definitions() : []
  const found = new Map()
  for (const definition of definitions) {
    const name = typeof definition?.name === 'string' ? definition.name : ''
    if (!name.startsWith('mcp__')) continue
    const rest = name.slice('mcp__'.length)
    const split = rest.indexOf('__')
    if (split <= 0) continue
    const server = rest.slice(0, split)
    found.set(server, (found.get(server) ?? 0) + 1)
  }
  return found
}

/** The module name every in-box MCP bridge row carries. */
export const MCP_BRIDGE_MODULE = '@deepseek-ai/dsh-mcp-client'

/**
 * Whether a profile row mounts an MCP server rather than an ordinary plugin.
 *
 * Two shapes exist in a real profile: the in-box bridge named by module
 * (`comfy` here) and an adapter package whose row id says so
 * (`mcp-dsh-computer-use-win`, which mounts the Windows computer-use server
 * through the same bridge). Both are switchable through the plugin manager;
 * anything else is left alone, because disabling an unrelated plugin from an
 * MCP list would be a surprise.
 *
 * @param {{ entryId?: string, moduleName?: string }} row one inventory row.
 * @returns {boolean} true when the row is an MCP server.
 */
export function isMcpProfileRow(row) {
  const id = typeof row?.entryId === 'string' ? row.entryId : ''
  // The inventory names an entry by its include parent (`include:mcp-comfy`), so
  // the row's own id is the part after the last colon.
  const local = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id
  const module = typeof row?.moduleName === 'string' ? row.moduleName : ''
  const bridge = module === MCP_BRIDGE_MODULE || /(^|\/)dsh-mcp-client$/.test(module)
  return bridge || /^mcp[-_:]/i.test(local)
}

/**
 * The profile's own MCP rows, with their live switch state.
 *
 * These are not this manager's servers: another patch layer mounted them, so
 * `toggle()` cannot reach them. They are switched through `pluginManager`,
 * which persists the choice and applies it to the running Host — the same
 * mechanism the Plugins page uses, without a restart.
 *
 * @param {object} ctx the host context.
 * @returns {Promise<object>} `{ ok, supported, servers }`, or `{ ok: false, error }`.
 */
export async function profileServers(ctx) {
  const manager = typeof ctx?.get === 'function' ? ctx.get('pluginManager') : undefined
  if (manager === undefined || typeof manager.listPlugins !== 'function') {
    return { ok: false, supported: false, error: 'This build has no plugin manager, so profile MCP rows cannot be switched here.', servers: [] }
  }
  let rows
  try {
    rows = await manager.listPlugins()
  } catch (error) {
    return { ok: false, supported: true, error: messageOf(error), servers: [] }
  }
  const entries = new Map()
  try {
    for (const entry of ctx.loader.entries()) {
      // The loader keys an entry either by its composed id (`include:mcp-comfy`)
      // or by the row id it was declared with; accept both so a config lookup
      // does not depend on which one this build reports.
      if (typeof entry.id === 'string' && entry.id !== '') entries.set(entry.id, entry)
      const declaredId = entry.options?.id
      if (typeof declaredId === 'string' && declaredId !== '') entries.set(declaredId, entry)
    }
  } catch {
    // The loader is not reachable from every context; names then come from the row id.
  }
  const servers = []
  const declaredIds = new Set()
  for (const row of rows) {
    if (!isMcpProfileRow(row)) continue
    const entry = entries.get(row.entryId)
    const config = entry?.options?.config
    const declared = typeof config?.serverName === 'string' ? config.serverName : ''
    const rowId = String(row.entryId).includes(':') ? String(row.entryId).slice(String(row.entryId).lastIndexOf(':') + 1) : String(row.entryId)
    const serverName = declared !== '' ? declared : rowId.replace(/^mcp[-_:]/i, '')
    const title = typeof row.meta?.title === 'string' && row.meta.title !== '' ? row.meta.title : ''
    const tools = declared !== '' ? toolsFor(ctx, declared) : []
    if (declared !== '') declaredIds.add('profile:' + String(row.entryId))
    servers.push({
      id: 'profile:' + String(row.entryId),
      entryId: row.entryId,
      serverName,
      label: title !== '' ? title : serverName,
      moduleName: row.moduleName,
      transport: 'profile',
      summary: row.moduleName,
      enabled: row.enabled === true,
      status: row.enabled === true ? String(row.fiberPhase ?? 'ready') : 'disabled',
      readOnlyReason: typeof row.readOnlyReason === 'string' ? row.readOnlyReason : '',
      error: typeof row.diagnostic === 'string' ? row.diagnostic : '',
      tools: [],
      toolCount: tools.length,
      builtin: false,
      origin: 'profile',
    })
  }
  return { ok: true, supported: true, servers: adoptLooseNames(ctx, servers, declaredIds) }
}

/**
 * Give an unnamed adapter row the one server namespace nothing else claims.
 *
 * The Windows computer-use row mounts the in-box bridge through its own package,
 * so its `serverName` is internal to that package: the row says `dsh-computer-
 * use-win`, while the tools it registers are `mcp__wincu__*`. When exactly one
 * row went unnamed and exactly one namespace went unclaimed, the pairing is not
 * a guess; with any ambiguity the row keeps its module name and no tool count.
 *
 * @param {object} ctx the host context.
 * @param {object[]} servers the rows built so far.
 * @param {Set<string>} declaredIds ids of rows that carried a `serverName`.
 * @returns {object[]} the same rows, possibly renamed.
 */
function adoptLooseNames(ctx, servers, declaredIds) {
  const claimed = new Set(servers.filter(server => declaredIds.has(server.id)).map(server => server.serverName))
  const loose = servers.filter(server => !declaredIds.has(server.id))
  const unclaimed = [...discoveredServers(ctx).keys()].filter(name => !claimed.has(name))
  if (loose.length !== 1 || unclaimed.length !== 1) return servers
  const adopted = loose[0]
  adopted.serverName = unclaimed[0]
  adopted.label = unclaimed[0]
  adopted.toolCount = toolsFor(ctx, adopted.serverName).length
  return servers
}

/**
 * Switch one profile MCP row, persisted and applied to the running Host.
 *
 * @param {object} ctx the host context.
 * @param {string} entryId the row's loader entry id.
 * @param {boolean} enabled the wanted state.
 * @returns {Promise<object>} `{ ok, changed, application, restartReason, error }`.
 */
export async function setProfileServer(ctx, entryId, enabled) {
  const manager = typeof ctx?.get === 'function' ? ctx.get('pluginManager') : undefined
  if (manager === undefined || typeof manager.setPluginEnabled !== 'function') {
    return { ok: false, error: 'This build has no plugin manager, so profile MCP rows cannot be switched here.' }
  }
  if (typeof entryId !== 'string' || entryId === '') return { ok: false, error: 'No such server.' }
  try {
    const result = await manager.setPluginEnabled(entryId, enabled === true)
    if (result?.error !== undefined) {
      return { ok: false, error: String(result.error?.code ?? 'The switch failed.'), detail: result.error }
    }
    return {
      ok: true,
      changed: result?.changed === true,
      application: String(result?.application ?? 'applied'),
      restartReason: typeof result?.restartReason === 'string' ? result.restartReason : '',
    }
  } catch (error) {
    return { ok: false, error: messageOf(error) }
  }
}

/**
 * Create the manager.
 *
 * @param {{ ctx: object, file?: string, now?: () => number, log?: (line: string) => void }} options
 *   the host context, the store path, a clock and a logger.
 * @returns {object} the manager.
 */
export function createMcpManager(options) {
  const ctx = options.ctx
  const file = options.file ?? storePath()
  const now = options.now ?? (() => Date.now())
  const log = options.log ?? (() => {})

  const loaded = readStore(file)
  let store = loaded.store
  const recovered = loaded.recovered
  /** id -> { fiber, status, error, startedAt } */
  let runtime = new Map()
  let bridge = null
  let bridgeError = ''

  /**
   * Mount one saved server and track its status.
   * @param {object} server the saved server.
   * @returns {void} nothing; status is published asynchronously.
   */
  function mount(server) {
    if (!server.enabled) return
    if (bridge === null) {
      runtime.set(server.id, { fiber: null, status: 'error', error: bridgeError || 'The MCP bridge is not available in this build.', startedAt: now() })
      return
    }
    const entry = { fiber: null, status: 'connecting', error: '', startedAt: now() }
    runtime.set(server.id, entry)
    let fiber
    try {
      fiber = ctx.plugin(bridge, bridgeConfig(server))
    } catch (error) {
      entry.status = 'error'
      entry.error = messageOf(error)
      return
    }
    entry.fiber = fiber
    Promise.resolve(fiber).then(
      () => {
        if (runtime.get(server.id) !== entry) return
        entry.status = 'ready'
        entry.error = ''
        log(`mcp: ${server.serverName} ready`)
      },
      error => {
        if (runtime.get(server.id) !== entry) return
        entry.status = 'error'
        entry.error = messageOf(error)
        log(`mcp: ${server.serverName} failed: ${entry.error}`)
      },
    )
  }

  /**
   * Dispose one server's fiber and forget its status.
   * @param {object} server the saved server.
   * @returns {Promise<void>} settles when the fiber is gone.
   */
  async function unmount(server) {
    const entry = runtime.get(server.id)
    if (entry === undefined) return
    runtime.delete(server.id)
    const fiber = entry.fiber
    if (fiber !== null && typeof fiber?.dispose === 'function') {
      try {
        await fiber.dispose()
      } catch (error) {
        log(`mcp: ${server.serverName} dispose failed: ${messageOf(error)}`)
      }
    }
  }

  /**
   * Persist the current list.
   * @returns {void} nothing.
   */
  function persist() {
    writeStore(file, store)
  }

  /**
   * The browser view: saved servers with their live status, plus servers another
   * plugin mounted.
   * @returns {object} the snapshot.
   */
  function snapshot() {
    const discovered = discoveredServers(ctx)
    const managed = store.servers.map(server => {
      const entry = runtime.get(server.id)
      const status = !server.enabled ? 'disabled' : entry?.status ?? 'disabled'
      return {
        ...publicServer(server),
        summary: serverSummary(server),
        status,
        error: entry?.error ?? '',
        tools: toolsFor(ctx, server.serverName),
        startedAt: entry?.startedAt ?? 0,
        builtin: false,
      }
    })
    for (const [serverName, count] of discovered) {
      if (store.servers.some(server => server.serverName === serverName)) continue
      managed.push({
        id: `external:${serverName}`,
        serverName,
        label: serverName,
        enabled: true,
        transport: 'external',
        summary: `${count} tool${count === 1 ? '' : 's'} provided by an installed plugin`,
        status: 'external',
        error: '',
        tools: [],
        toolCount: count,
        secretKeys: [],
        builtin: true,
      })
    }
    return {
      ok: true,
      bridge: bridge !== null,
      bridgeError,
      storePath: file,
      recovered,
      servers: managed,
    }
  }

  const manager = {
    /**
     * Import the bridge, if this build has it.
     * @returns {Promise<void>} settles when the attempt is done.
     */
    async loadBridge() {
      try {
        bridge = await import('@deepseek-ai/dsh-mcp-client')
        bridgeError = ''
      } catch (error) {
        bridge = null
        bridgeError = `The MCP bridge is not available in this build (${messageOf(error)}).`
        log(bridgeError)
      }
    },

    /** Mount every enabled saved server. */
    start() {
      for (const server of store.servers) mount(server)
    },

    /**
     * Save a server, mounting or remounting it in place.
     * @param {object} input the draft from the form.
     * @returns {Promise<object>} `{ ok, server }` or `{ ok: false, errors }`.
     */
    async save(input) {
      const { server, errors } = normalizeServer(input, { existing: store.servers, now: now() })
      if (server === null) return { ok: false, errors }
      const index = store.servers.findIndex(entry => entry.id === server.id)
      const previous = index >= 0 ? store.servers[index] : undefined
      if (previous !== undefined) await unmount(previous)
      const next = [...store.servers]
      if (index >= 0) next[index] = server
      else next.push(server)
      store = { version: store.version, servers: next }
      persist()
      mount(server)
      return { ok: true, server: snapshot().servers.find(entry => entry.id === server.id) }
    },

    /**
     * Remove one server and dispose it.
     * @param {string} id the server id.
     * @returns {Promise<object>} `{ ok, removed }`.
     */
    async remove(id) {
      const server = store.servers.find(entry => entry.id === id)
      if (server === undefined) return { ok: false, error: 'No such server.' }
      await unmount(server)
      store = { version: store.version, servers: store.servers.filter(entry => entry.id !== id) }
      persist()
      return { ok: true, removed: server.serverName }
    },

    /**
     * Enable or disable one server.
     * @param {string} id the server id.
     * @param {boolean} enabled the wanted state.
     * @returns {Promise<object>} `{ ok, server }`.
     */
    async toggle(id, enabled) {
      const server = store.servers.find(entry => entry.id === id)
      if (server === undefined) return { ok: false, error: 'No such server.' }
      const next = { ...server, enabled: enabled === true, updatedAt: now() }
      store = { version: store.version, servers: store.servers.map(entry => (entry.id === id ? next : entry)) }
      persist()
      await unmount(server)
      mount(next)
      return { ok: true, server: snapshot().servers.find(entry => entry.id === id) }
    },

    /**
     * Remount one server without changing its config.
     * @param {string} id the server id.
     * @returns {Promise<object>} `{ ok }`.
     */
    async restart(id) {
      const server = store.servers.find(entry => entry.id === id)
      if (server === undefined) return { ok: false, error: 'No such server.' }
      await unmount(server)
      mount(server)
      return { ok: true }
    },

    /**
     * Try a draft without saving it: mount, wait for the first tool sync, report,
     * dispose, and put the saved server back if the draft is an edit of one.
     * @param {object} input the draft.
     * @returns {Promise<object>} `{ ok, ms, tools, error }`.
     */
    async test(input) {
      const { server, errors } = normalizeServer(input, {
        existing: store.servers.filter(entry => entry.id !== input?.id),
        now: now(),
      })
      if (server === null) return { ok: false, errors }
      if (bridge === null) return { ok: false, error: bridgeError || 'The MCP bridge is not available in this build.' }
      const live = store.servers.find(entry => entry.serverName === server.serverName)
      if (live !== undefined) await unmount(live)
      const started = Date.now()
      let fiber
      try {
        fiber = ctx.plugin(bridge, bridgeConfig(server))
      } catch (error) {
        if (live !== undefined) mount(live)
        return { ok: false, error: messageOf(error) }
      }
      const outcome = await withTimeout(Promise.resolve(fiber), TEST_TIMEOUT_MS)
      const tools = toolsFor(ctx, server.serverName)
      if (typeof fiber?.dispose === 'function') {
        try {
          await fiber.dispose()
        } catch {
          // A failed dispose after a failed start is not worth reporting.
        }
      }
      if (live !== undefined) mount(live)
      if (outcome.timedOut) return { ok: false, ms: Date.now() - started, error: `No tool sync within ${TEST_TIMEOUT_MS / 1000}s.` }
      if (outcome.error !== undefined) return { ok: false, ms: Date.now() - started, error: messageOf(outcome.error) }
      return { ok: true, ms: Date.now() - started, tools, toolCount: tools.length }
    },

    /** The profile's own MCP rows, which this manager did not mount. */
    listProfileServers: () => profileServers(ctx),

    /**
     * Switch one of those rows through the plugin manager.
     * @param {string} entryId the row's loader entry id.
     * @param {boolean} enabled the wanted state.
     * @returns {Promise<object>} the outcome.
     */
    setProfileEnabled: (entryId, enabled) => setProfileServer(ctx, entryId, enabled),

    /** The browser view. */
    snapshot,

    /**
     * The raw list, secrets included, for export.
     * @returns {object} the store.
     */
    exportStore() {
      return { version: store.version, servers: store.servers }
    },

    /** Dispose every mounted server; the feature's effect calls this. */
    async disposeAll() {
      const servers = store.servers
      for (const server of servers) await unmount(server)
    },

    /**
     * The path this manager reads, for the page's footer note.
     * @returns {string} the absolute file path.
     */
    file() {
      return file
    },
  }

  return manager
}

/**
 * Read an error's message.
 * @param {unknown} error the thrown value.
 * @returns {string} a message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Race a promise against a timer.
 * @param {Promise<unknown>} promise the work.
 * @param {number} ms the budget.
 * @returns {Promise<{ timedOut: boolean, error?: unknown }>} the outcome.
 */
function withTimeout(promise, ms) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ timedOut: true }), ms)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve({ timedOut: false })
      },
      error => {
        clearTimeout(timer)
        resolve({ timedOut: false, error })
      },
    )
  })
}
