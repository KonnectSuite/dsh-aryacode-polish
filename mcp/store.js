/**
 * The MCP server list on disk.
 *
 * One JSON file in the harness home, written atomically and read defensively: a
 * corrupt file is moved aside rather than crashing the feature, because the list
 * is user data and a partial write must never take the app down. Secrets live in
 * this file in plain text (mode 0600 where the platform honours it) and are
 * masked by `publicServer()` before they reach the browser.
 *
 * @module dsh-aryacode-polish-mcp-store
 */

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** The file name inside the harness home. */
export const STORE_FILE = 'mcp-servers.json'

/** The shape version this module reads and writes. */
export const STORE_VERSION = 1

/** Keys whose values are treated as secrets in the browser view. */
const SECRET_PATTERN = /key|token|secret|password|passwd|auth|cookie/i

/**
 * Where the list lives.
 * @param {string | undefined} home an explicit home, for tests.
 * @returns {string} the absolute file path.
 */
export function storePath(home) {
  const base = home ?? (typeof process === 'object' && process.env !== undefined ? process.env.DSH_HOME : undefined) ?? join(homedir(), '.aryacode')
  return join(base, STORE_FILE)
}

/**
 * An empty list.
 * @returns {{ version: number, servers: object[] }} the store.
 */
export function emptyStore() {
  return { version: STORE_VERSION, servers: [] }
}

/**
 * Read the list, recovering from a corrupt file.
 *
 * A file that cannot be parsed is renamed to `<file>.corrupt-<timestamp>` so the
 * user keeps it, and an empty list is returned. A missing file is not an error.
 *
 * @param {string} file the file path.
 * @returns {{ store: { version: number, servers: object[] }, recovered: string | null }} the
 *   list, and the path a corrupt file was moved to.
 */
export function readStore(file) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { store: emptyStore(), recovered: null }
    throw error
  }
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.servers)) {
      throw new Error('servers must be an array')
    }
    return { store: { version: STORE_VERSION, servers: parsed.servers.filter(entry => entry !== null && typeof entry === 'object') }, recovered: null }
  } catch {
    const target = `${file}.corrupt-${Date.now()}`
    try {
      renameSync(file, target)
    } catch {
      // If the move fails, still return an empty list: the UI can report the path.
    }
    return { store: emptyStore(), recovered: target }
  }
}

/**
 * Write the list atomically.
 *
 * @param {string} file the file path.
 * @param {{ version: number, servers: object[] }} store the list.
 * @returns {void} nothing.
 */
export function writeStore(file, store) {
  mkdirSync(dirname(file), { recursive: true })
  const body = JSON.stringify({ version: STORE_VERSION, servers: store.servers }, null, 2) + '\n'
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
 * The browser-safe view of one server: secrets replaced, keys named.
 * @param {object} server the saved server.
 * @returns {object} a copy with `env` and `headers` masked.
 */
export function publicServer(server) {
  const secretKeys = []
  const mask = (map) => {
    const masked = {}
    for (const [key, value] of Object.entries(map ?? {})) {
      if (SECRET_PATTERN.test(key) && typeof value === 'string' && value !== '') {
        secretKeys.push(key)
        masked[key] = '********'
      } else {
        masked[key] = value
      }
    }
    return masked
  }
  return {
    ...server,
    env: mask(server.env),
    headers: mask(server.headers),
    secretKeys: [...new Set(secretKeys)],
  }
}

/**
 * Whether a map key is treated as a secret.
 * @param {string} key the key.
 * @returns {boolean} true when the value is masked in the browser view.
 */
export function isSecretKey(key) {
  return typeof key === 'string' && SECRET_PATTERN.test(key)
}
