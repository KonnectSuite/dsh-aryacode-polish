/**
 * The MCP management API: one POST route, an `action` field, JSON in and out.
 *
 * The browser half never runs a command, never reads a file and never sees a
 * secret unmasked; it posts an action and renders the answer. GitHub search runs
 * here too, so a rate limit or an offline machine is a normal JSON answer rather
 * than a broken page.
 *
 * @module dsh-aryacode-polish-mcp-routes
 */

import { MCP_CATEGORIES, catalogEntry, draftFromCatalog, searchCatalog } from './catalog.js'
import { draftFromPaste } from './validate.js'

/** The path the Host registers; the browser addresses `api/polish.mcp`. */
export const MCP_ROUTE = '/api/polish.mcp'

/** How many GitHub results one search returns. */
export const GITHUB_PAGE_SIZE = 12

/**
 * Search GitHub for MCP servers.
 *
 * Unauthenticated search is rate limited hard (10 requests a minute), so a token
 * is used when the machine has one - `GITHUB_TOKEN` first, then the GitHub CLI's
 * own session, which this plugin already knows how to read.
 *
 * @param {string} query what the user typed.
 * @param {{ fetchImpl?: typeof fetch, resolveToken?: () => Promise<string | undefined> }} deps
 *   injection points for tests.
 * @returns {Promise<object>} `{ ok, items }` or `{ ok: false, rateLimited? , error }`.
 */
export async function searchGitHub(query, deps = {}) {
  const needle = typeof query === 'string' ? query.trim() : ''
  if (needle === '') return { ok: true, items: [] }
  const fetchImpl = deps.fetchImpl ?? fetch
  const token = typeof deps.resolveToken === 'function' ? await deps.resolveToken().catch(() => undefined) : undefined
  const text = `${needle} mcp server`
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(text)}&sort=stars&order=desc&per_page=${GITHUB_PAGE_SIZE}`
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'aryacode-mcp-page' }
  if (typeof token === 'string' && token !== '') headers.authorization = `Bearer ${token}`
  let response
  try {
    response = await fetchImpl(url, { headers })
  } catch (error) {
    return { ok: false, error: `GitHub could not be reached (${error instanceof Error ? error.message : String(error)}).` }
  }
  if (response.status === 403 || response.status === 429) {
    return { ok: false, rateLimited: true, error: 'GitHub rate limit reached. The bundled catalog still works.' }
  }
  if (!response.ok) {
    return { ok: false, error: `GitHub answered ${response.status}.` }
  }
  let body
  try {
    body = await response.json()
  } catch {
    return { ok: false, error: 'GitHub answered with something that is not JSON.' }
  }
  const items = (Array.isArray(body?.items) ? body.items : []).map(item => ({
    name: typeof item.name === 'string' ? item.name : '',
    fullName: typeof item.full_name === 'string' ? item.full_name : '',
    description: typeof item.description === 'string' ? item.description : '',
    stars: Number(item.stargazers_count) || 0,
    url: typeof item.html_url === 'string' ? item.html_url : '',
    homepage: typeof item.homepage === 'string' ? item.homepage : '',
    language: typeof item.language === 'string' ? item.language : '',
  }))
  return { ok: true, items, authenticated: typeof token === 'string' && token !== '' }
}

/**
 * Build the route handler.
 *
 * @param {object} manager the MCP manager (`mcp/manager.js`).
 * @param {{ fetchImpl?: typeof fetch, resolveToken?: () => Promise<string | undefined> }} deps
 *   injection points for tests.
 * @returns {(body: object) => Promise<object>} the dispatcher.
 */
export function createHandler(manager, deps = {}) {
  return async function handle(body) {
    const action = typeof body?.action === 'string' ? body.action : ''
    try {
      switch (action) {
        case 'list':
          return manager.snapshot()
        case 'catalog':
          return {
            ok: true,
            categories: MCP_CATEGORIES,
            entries: searchCatalog(String(body.query ?? ''), String(body.category ?? 'all')),
          }
        case 'catalogEntry': {
          const entry = catalogEntry(String(body.id ?? ''))
          if (entry === undefined) return { ok: false, error: 'No such catalog entry.' }
          return { ok: true, entry, draft: draftFromCatalog(entry, body.values ?? {}) }
        }
        case 'search':
          return await searchGitHub(String(body.query ?? ''), deps)
        case 'parse':
          return body.text !== undefined ? { ok: true, ...draftFromPaste(String(body.text)) } : { ok: false, error: 'Nothing to parse.' }
        case 'save':
          return await manager.save(body.server)
        case 'remove':
          return await manager.remove(String(body.id ?? ''))
        case 'toggle':
          return await manager.toggle(String(body.id ?? ''), body.enabled === true)
        case 'profileList':
          return await manager.listProfileServers()
        case 'profileToggle':
          return await manager.setProfileEnabled(String(body.entryId ?? ''), body.enabled === true)
        case 'restart':
          return await manager.restart(String(body.id ?? ''))
        case 'test':
          return await manager.test(body.server)
        case 'export':
          return { ok: true, store: manager.exportStore() }
        case 'import':
          return await importServers(manager, body)
        default:
          return { ok: false, error: `Unknown action "${action}".` }
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

/**
 * Import one or many servers from a paste or a JSON store.
 * @param {object} manager the manager.
 * @param {{ text?: string, servers?: object[] }} body the import payload.
 * @returns {Promise<object>} `{ ok, saved, failed }`.
 */
async function importServers(manager, body) {
  let candidates = []
  if (Array.isArray(body?.servers)) {
    candidates = body.servers
  } else if (typeof body?.text === 'string' && body.text.trim() !== '') {
    const text = body.text.trim()
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text)
        candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.servers) ? parsed.servers : [parsed]
      } catch {
        return { ok: false, error: 'That JSON could not be read.' }
      }
    } else {
      const parsed = draftFromPaste(text)
      if (parsed.draft === null) return { ok: false, error: parsed.error }
      candidates = [parsed.draft]
    }
  }
  if (candidates.length === 0) return { ok: false, error: 'Nothing to import.' }
  const saved = []
  const failed = []
  for (const candidate of candidates) {
    // An imported id may collide with a local one; the store decides freshness.
    const result = await manager.save({ ...candidate, id: undefined })
    if (result.ok) saved.push(result.server?.serverName ?? candidate.serverName)
    else failed.push({ serverName: candidate.serverName ?? '', errors: result.errors ?? [{ field: '', message: String(result.error ?? '') }] })
  }
  return { ok: failed.length === 0, saved, failed }
}
