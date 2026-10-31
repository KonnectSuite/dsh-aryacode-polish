/**
 * AryaSearch settings: the small document the provider reads and the Plugins card
 * edits.
 *
 * It is a JSON file in the harness home rather than fields on the polish row,
 * for two reasons: the provider must read the current base URL and token on every
 * search (a row edit would remount every feature), and the card needs a place to
 * stage values before saving. The file is written atomically and read
 * defensively, and the browser never receives a token: `publicSettings()` masks
 * it the same way the MCP page masks env values.
 *
 * @module dsh-aryacode-polish-aryasearch-settings
 */

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** The file name inside the harness home. */
export const ARYASEARCH_STORE_FILE = 'web-search.json'

/** Shape version this module reads and writes. */
export const ARYASEARCH_STORE_VERSION = 1

/** The modes in which the feature manages the web-search provider selection. */
export const ARYASEARCH_MODES = ['auto', 'always', 'off']

/** The authentication kinds the provider understands. */
export const ARYASEARCH_AUTH = ['none', 'bearer', 'basic', 'header']

/** Defaults for a fresh install. */
export function defaultSettings() {
  return {
    mode: 'auto',
    baseURL: '',
    auth: 'none',
    tokenRef: '',
    token: '',
    basicUser: '',
    basicPass: '',
    headers: {},
    language: '',
    safesearch: '',
    categories: '',
    timeRange: '',
    timeoutMs: 20000,
  }
}

/**
 * Where the settings live.
 * @param {string | undefined} home an explicit home, for tests.
 * @returns {string} the absolute file path.
 */
export function settingsPath(home) {
  const base = home ?? (typeof process === 'object' && process.env !== undefined ? process.env.DSH_HOME : undefined) ?? join(homedir(), '.aryacode')
  return join(base, ARYASEARCH_STORE_FILE)
}

/**
 * Read the settings, recovering from a corrupt file.
 * @param {string} file the file path.
 * @returns {{ settings: object, recovered: string | null }} the settings and the
 *   path a corrupt file was moved to.
 */
export function readSettings(file) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { settings: defaultSettings(), recovered: null }
    throw error
  }
  try {
    const parsed = JSON.parse(text)
    const settings = parsed?.settings !== null && typeof parsed?.settings === 'object' ? parsed.settings : parsed
    return { settings: { ...defaultSettings(), ...normalizeSettings(settings).settings }, recovered: null }
  } catch {
    const target = `${file}.corrupt-${Date.now()}`
    try {
      renameSync(file, target)
    } catch {
      // The caller can still report the path.
    }
    return { settings: defaultSettings(), recovered: target }
  }
}

/**
 * Write the settings atomically.
 * @param {string} file the file path.
 * @param {object} settings the normalized settings.
 * @returns {void} nothing.
 */
export function writeSettings(file, settings) {
  mkdirSync(dirname(file), { recursive: true })
  const body = JSON.stringify({ version: ARYASEARCH_STORE_VERSION, settings }, null, 2) + '\n'
  const temporary = `${file}.tmp-${process.pid}`
  writeFileSync(temporary, body, 'utf8')
  try {
    chmodSync(temporary, 0o600)
  } catch {
    // Windows ignores POSIX modes; the write still happened.
  }
  renameSync(temporary, file)
}

/**
 * Validate and clean one settings object.
 * @param {object} input the raw settings.
 * @returns {{ settings: object, errors: Array<{ field: string, message: string }> }} the
 *   cleaned settings, or the empty base with a list of problems.
 */
export function normalizeSettings(input) {
  const errors = []
  const raw = input !== null && typeof input === 'object' ? input : {}
  const base = defaultSettings()

  const mode = ARYASEARCH_MODES.includes(raw.mode) ? raw.mode : base.mode
  if (raw.mode !== undefined && !ARYASEARCH_MODES.includes(raw.mode)) {
    errors.push({ field: 'mode', message: 'Mode must be auto, always or off.' })
  }

  const auth = ARYASEARCH_AUTH.includes(raw.auth) ? raw.auth : base.auth
  if (raw.auth !== undefined && !ARYASEARCH_AUTH.includes(raw.auth)) {
    errors.push({ field: 'auth', message: 'Authentication must be none, bearer, basic or header.' })
  }

  const baseURL = typeof raw.baseURL === 'string' ? raw.baseURL.trim().replace(/\/+$/, '') : ''
  if (baseURL !== '') {
    let parsed
    try {
      parsed = new URL(baseURL)
    } catch {
      parsed = undefined
    }
    if (parsed === undefined || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      errors.push({ field: 'baseURL', message: 'The base URL must start with http:// or https://.' })
    }
  }

  const timeoutMs = clampInteger(raw.timeoutMs, 2000, 60000, base.timeoutMs)
  const safesearch = ['', '0', '1', '2'].includes(String(raw.safesearch ?? '')) ? String(raw.safesearch ?? '') : ''
  if (raw.safesearch !== undefined && !['', '0', '1', '2'].includes(String(raw.safesearch))) {
    errors.push({ field: 'safesearch', message: 'Safe search must be off, moderate or strict.' })
  }

  const settings = {
    mode,
    baseURL,
    auth,
    tokenRef: typeof raw.tokenRef === 'string' ? raw.tokenRef.trim() : '',
    token: typeof raw.token === 'string' ? raw.token.trim() : '',
    basicUser: typeof raw.basicUser === 'string' ? raw.basicUser.trim() : '',
    basicPass: typeof raw.basicPass === 'string' ? raw.basicPass : '',
    headers: stringMap(raw.headers),
    language: typeof raw.language === 'string' ? raw.language.trim() : '',
    safesearch,
    categories: typeof raw.categories === 'string' ? raw.categories.trim() : '',
    timeRange: ['', 'day', 'week', 'month', 'year'].includes(String(raw.timeRange ?? '')) ? String(raw.timeRange ?? '') : '',
    timeoutMs,
  }

  if (auth === 'bearer' && settings.tokenRef === '' && settings.token === '') {
    errors.push({ field: 'tokenRef', message: 'Bearer authentication needs a credential reference or a token.' })
  }
  if (auth === 'basic' && (settings.basicUser === '' || settings.basicPass === '')) {
    errors.push({ field: 'basicUser', message: 'Basic authentication needs a user and a password.' })
  }
  if (auth === 'header' && Object.keys(settings.headers).length === 0) {
    errors.push({ field: 'headers', message: 'Header authentication needs at least one header.' })
  }

  if (errors.length > 0) return { settings: defaultSettings(), errors }
  return { settings, errors: [] }
}

/**
 * The browser-safe view: secrets replaced, with the keys that were hidden.
 * @param {object} settings the saved settings.
 * @returns {object} a copy with `token` and `basicPass` masked.
 */
export function publicSettings(settings) {
  const secretKeys = []
  const mask = (key, value) => {
    if (value === '') return ''
    secretKeys.push(key)
    return '********'
  }
  return {
    ...settings,
    headers: { ...(settings.headers ?? {}) },
    token: mask('token', settings.token),
    basicPass: mask('basicPass', settings.basicPass),
    secretKeys,
  }
}

/**
 * Whether the settings are enough to search.
 * @param {object} settings the settings.
 * @returns {boolean} true when a base URL is set and valid.
 */
export function isConfigured(settings) {
  if (settings === null || typeof settings !== 'object') return false
  if (typeof settings.baseURL !== 'string' || settings.baseURL === '') return false
  try {
    const parsed = new URL(settings.baseURL)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Read a `Record<string, string>` from loose input, dropping empty keys. */
function stringMap(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const map = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof key !== 'string' || key.trim() === '') continue
    if (typeof entry === 'string') map[key.trim()] = entry
    else if (typeof entry === 'number' || typeof entry === 'boolean') map[key.trim()] = String(entry)
  }
  return map
}

/** Clamp an integer into a range, falling back when it is not a number. */
function clampInteger(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}
