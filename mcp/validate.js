/**
 * AryaCode MCP servers: one validator, shared by the store, the routes and the
 * catalog.
 *
 * The bridge's own `Config` is the authority for what an MCP server entry means,
 * so this module keeps the same field names and only adds the bookkeeping a
 * management UI needs (an id, a label, a category, timestamps). Everything the
 * bridge does not know about is stripped in `bridgeConfig()`, which is the only
 * shape ever handed to `@deepseek-ai/dsh-mcp-client`.
 *
 * @module dsh-aryacode-polish-mcp-validate
 */

/** The bridge's server-name rule, mirrored so the form can reject early. */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** The transports the shipped bridge speaks. */
export const TRANSPORTS = ['stdio', 'streamable-http']

/** Values used when an entry leaves a field out. */
export const SERVER_DEFAULTS = Object.freeze({
  toolCallTimeoutMs: 60000,
  failOnStartupError: true,
  reconnect: true,
})

/** Bookkeeping fields the bridge must never see. */
const META_FIELDS = ['id', 'label', 'enabled', 'category', 'source', 'createdAt', 'updatedAt', 'note']

/**
 * A short, stable-enough id for a saved server.
 * @param {number} now the clock, injected so tests are deterministic.
 * @param {() => number} random the random source.
 * @returns {string} an id such as `srv_lk3f9a`.
 */
export function newServerId(now = Date.now(), random = Math.random) {
  const noise = Math.floor(random() * 0xffffff).toString(36).padStart(4, '0')
  return 'srv_' + Math.floor(now / 1000).toString(36) + noise
}

/**
 * Whether a string is a valid bridge server name.
 * @param {unknown} value the candidate.
 * @returns {boolean} true when the bridge would accept it.
 */
export function isServerName(value) {
  return typeof value === 'string' && SERVER_NAME_PATTERN.test(value)
}

/**
 * Normalize one server entry, collecting every problem rather than throwing on
 * the first, so the form can mark each field.
 *
 * @param {object} input the raw entry from the form, an import or the store.
 * @param {{ existing?: ReadonlyArray<object>, now?: number }} options the servers
 *   already saved (for the unique-name rule) and the clock.
 * @returns {{ server: object | null, errors: Array<{ field: string, message: string }> }}
 *   the cleaned entry, or null with the list of problems.
 */
export function normalizeServer(input, options = {}) {
  const existing = Array.isArray(options.existing) ? options.existing : []
  const now = typeof options.now === 'number' ? options.now : Date.now()
  const errors = []
  const raw = input !== null && typeof input === 'object' ? input : {}

  const serverName = typeof raw.serverName === 'string' ? raw.serverName.trim() : ''
  if (serverName === '') errors.push({ field: 'serverName', message: 'A server name is required.' })
  else if (!isServerName(serverName)) {
    errors.push({ field: 'serverName', message: 'Use 1-32 letters, digits, "_" or "-" only.' })
  } else {
    const clash = existing.find(server => server.serverName === serverName && server.id !== raw.id)
    if (clash !== undefined) {
      errors.push({ field: 'serverName', message: `"${serverName}" is already used by "${clash.label ?? clash.serverName}".` })
    }
  }

  const transport = TRANSPORTS.includes(raw.transport) ? raw.transport : ''
  if (transport === '') errors.push({ field: 'transport', message: 'Pick stdio or streamable HTTP.' })

  const command = typeof raw.command === 'string' ? raw.command.trim() : ''
  const url = typeof raw.url === 'string' ? raw.url.trim() : ''
  if (transport === 'stdio' && command === '') errors.push({ field: 'command', message: 'A command is required.' })
  if (transport === 'streamable-http') {
    if (url === '') errors.push({ field: 'url', message: 'A URL is required.' })
    else if (!/^https?:\/\//i.test(url)) errors.push({ field: 'url', message: 'The URL must start with http:// or https://.' })
  }

  const label = typeof raw.label === 'string' && raw.label.trim() !== '' ? raw.label.trim() : serverName
  const args = Array.isArray(raw.args)
    ? raw.args.filter(value => typeof value === 'string' && value !== '')
    : typeof raw.args === 'string' && raw.args.trim() !== ''
      ? splitCommandLine(raw.args)
      : []
  const env = stringMap(raw.env)
  const headers = stringMap(raw.headers)
  const toolCallTimeoutMs = clampInteger(raw.toolCallTimeoutMs, 1000, 600000, SERVER_DEFAULTS.toolCallTimeoutMs)
  const category = typeof raw.category === 'string' && raw.category !== '' ? raw.category : 'custom'
  const createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : now

  if (errors.length > 0) return { server: null, errors }

  return {
    server: {
      id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : newServerId(now),
      serverName,
      label,
      enabled: raw.enabled !== false,
      transport,
      command: transport === 'stdio' ? command : '',
      args: transport === 'stdio' ? args : [],
      env: transport === 'stdio' ? env : {},
      cwd: transport === 'stdio' && typeof raw.cwd === 'string' ? raw.cwd.trim() : '',
      url: transport === 'streamable-http' ? url : '',
      headers: transport === 'streamable-http' ? headers : {},
      toolCallTimeoutMs,
      failOnStartupError: raw.failOnStartupError !== false,
      reconnect: { enabled: raw.reconnect?.enabled !== false },
      category,
      source: typeof raw.source === 'string' ? raw.source : 'manual',
      note: typeof raw.note === 'string' ? raw.note : '',
      createdAt,
      updatedAt: now,
    },
    errors: [],
  }
}

/**
 * The exact object `@deepseek-ai/dsh-mcp-client` accepts for this server.
 * @param {object} server a normalized server.
 * @returns {object} the bridge config.
 */
export function bridgeConfig(server) {
  const base = {
    transport: server.transport,
    serverName: server.serverName,
    toolCallTimeoutMs: server.toolCallTimeoutMs,
    failOnStartupError: server.failOnStartupError === true,
    reconnect: { enabled: server.reconnect?.enabled !== false },
  }
  if (server.transport === 'stdio') {
    base.command = server.command
    base.args = Array.isArray(server.args) ? server.args : []
    base.env = { ...(server.env ?? {}) }
    if (typeof server.cwd === 'string' && server.cwd !== '') base.cwd = server.cwd
    return base
  }
  base.url = server.url
  base.headers = { ...(server.headers ?? {}) }
  return base
}

/**
 * A one-line description of what a saved server will run, for a card.
 * @param {object} server the server.
 * @returns {string} the command line, or the URL.
 */
export function serverSummary(server) {
  if (server === null || server === undefined) return ''
  if (server.transport === 'streamable-http') return server.url
  const args = Array.isArray(server.args) ? server.args : []
  return [server.command, ...args].join(' ')
}

/**
 * Split a pasted command line into argv, honouring single and double quotes.
 * @param {string} line the command line.
 * @returns {string[]} the tokens.
 */
export function splitCommandLine(line) {
  const tokens = []
  let current = ''
  let quote = ''
  for (const character of String(line)) {
    if (quote !== '') {
      if (character === quote) quote = ''
      else current += character
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (/\s/.test(character)) {
      if (current !== '') {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += character
  }
  if (current !== '') tokens.push(current)
  return tokens
}

/**
 * Parse the shapes a user is likely to paste into one field.
 *
 * Accepts a JSON object, a bare URL, or a command line starting with a known
 * runner (`npx`, `uvx`, `docker`, `bunx`, `node`, `python`, `uv`).
 *
 * @param {string} text the pasted text.
 * @returns {{ draft: object | null, error: string }} a draft server, or why not.
 */
export function draftFromPaste(text) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (value === '') return { draft: null, error: 'Nothing to import.' }
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value)
      const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.servers) ? parsed.servers : [parsed]
      const { server, errors } = normalizeServer(candidates[0] ?? {})
      if (server === null) return { draft: null, error: errors[0]?.message ?? 'That JSON is not a server.' }
      return { draft: server, error: '' }
    } catch {
      return { draft: null, error: 'That JSON could not be read.' }
    }
  }
  if (/^https?:\/\//i.test(value)) {
    const name = value.replace(/^https?:\/\//i, '').split(/[/:?#]/).filter(Boolean)[0] ?? 'remote'
    return {
      draft: { serverName: sanitizeName(name), label: name, transport: 'streamable-http', url: value, enabled: true },
      error: '',
    }
  }
  const tokens = splitCommandLine(value)
  const runners = new Set(['npx', 'uvx', 'bunx', 'docker', 'node', 'python', 'python3', 'uv', 'deno', 'pnpm'])
  if (tokens.length === 0 || !runners.has(tokens[0])) {
    return { draft: null, error: 'Paste a command that starts with npx, uvx, bunx, docker, node, python or uv - or a URL, or JSON.' }
  }
  const packageName = tokens.find(token => token.includes('server') || token.includes('mcp')) ?? tokens[1] ?? 'server'
  return {
    draft: {
      serverName: sanitizeName(packageName),
      label: tokens.slice(0, 3).join(' '),
      transport: 'stdio',
      command: tokens[0],
      args: tokens.slice(1),
      enabled: true,
    },
    error: '',
  }
}

/**
 * Turn any string into something the bridge accepts as a server name.
 * @param {string} value the source text.
 * @returns {string} a 1-32 character name.
 */
export function sanitizeName(value) {
  const cleaned = String(value)
    .replace(/^(?:@[^/]+\/)?/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return cleaned === '' ? 'mcp' : cleaned
}

/**
 * Read a `Record<string, string>` from loose input, dropping empty keys.
 * @param {unknown} value the raw value.
 * @returns {Record<string, string>} the cleaned map.
 */
function stringMap(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const map = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== 'string' || key === '') continue
    if (typeof entry === 'string') map[key] = entry
    else if (typeof entry === 'number' || typeof entry === 'boolean') map[key] = String(entry)
  }
  return map
}

/**
 * Clamp an integer into a range, falling back when it is not a number.
 * @param {unknown} value the raw value.
 * @param {number} min lower bound.
 * @param {number} max upper bound.
 * @param {number} fallback value for unusable input.
 * @returns {number} the clamped integer.
 */
function clampInteger(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}
