/**
 * The bundled MCP catalog: a curated list of servers a user can install without
 * reading a README first.
 *
 * The data lives beside this module (`catalog.json`) and is read once. Entries
 * are metadata only; `draftFromCatalog()` turns one into the same draft shape the
 * manual form produces, so the install path and the manual path share every later
 * validation step.
 *
 * @module dsh-aryacode-polish-mcp-catalog
 */

import { readFileSync } from 'node:fs'

/** Every entry, frozen so a caller cannot edit the bundle's data. */
export const MCP_CATALOG = Object.freeze(JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8')))

/** The categories the page groups by, in display order. */
export const MCP_CATEGORIES = Object.freeze([
  { id: 'core', label: 'Core' },
  { id: 'dev', label: 'Developer tools' },
  { id: 'data', label: 'Data' },
  { id: 'search', label: 'Search' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'custom', label: 'Custom' },
])

/**
 * One catalog entry by id.
 * @param {string} id the entry id.
 * @returns {object | undefined} the entry.
 */
export function catalogEntry(id) {
  return MCP_CATALOG.find(entry => entry.id === id)
}

/**
 * Filter the catalog.
 * @param {string} query free text over name, publisher, description and tags.
 * @param {string} category a category id, or `all`.
 * @returns {ReadonlyArray<object>} the matching entries.
 */
export function searchCatalog(query, category = 'all') {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : ''
  return MCP_CATALOG.filter(entry => {
    if (category !== 'all' && entry.category !== category) return false
    if (needle === '') return true
    const haystack = [entry.name, entry.publisher, entry.description, ...(entry.tags ?? [])].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

/**
 * Turn a catalog entry into the draft the manual form edits.
 *
 * `env` values are left empty; the entry names which keys the server needs so the
 * form can ask for exactly those. A required key with no value keeps the draft
 * saveable — the user fills it in — but `test` will fail until it is present,
 * which is the honest signal.
 *
 * @param {object} entry a catalog entry.
 * @param {Record<string, string>} values values already typed for this entry.
 * @returns {object} a draft server.
 */
export function draftFromCatalog(entry, values = {}) {
  const env = {}
  for (const variable of entry.env ?? []) {
    const value = values[variable.key]
    if (typeof value === 'string' && value !== '') env[variable.key] = value
  }
  const draft = {
    serverName: entry.id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 32),
    label: entry.name,
    enabled: true,
    transport: entry.transport,
    category: entry.category,
    source: `catalog:${entry.id}`,
    note: entry.note ?? '',
  }
  if (entry.transport === 'stdio') {
    draft.command = entry.command
    draft.args = [...(entry.args ?? [])]
    draft.env = env
    draft.cwd = ''
  } else {
    draft.url = entry.url
    draft.headers = {}
  }
  return draft
}

/**
 * The variables a catalog entry needs the user to provide.
 * @param {object} entry a catalog entry.
 * @returns {{ key: string, label: string, secret: boolean, required: boolean }[]} the fields.
 */
export function catalogEnvFields(entry) {
  return Array.isArray(entry?.env) ? entry.env : []
}
