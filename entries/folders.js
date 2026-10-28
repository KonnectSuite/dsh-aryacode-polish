/**
 * The folder list behind "On this PC".
 *
 * Why this exists at all: the add-a-workspace flow is driven by the
 * `sidebar.workspaces.directoryFlow` slot, whose single occupant is a directory
 * picker. A picker serves exactly one capability — `browse` (`list`,
 * `createDirectory`) or `native` (`pick`) — and the browser build composes the
 * one without a chooser to show, so `pick` there waits for a dialog that never
 * opens. Owning the listing instead of borrowing it keeps the row behaving the
 * same in the app and in the browser, and keeps the plugin free of a dependency
 * on which picker a profile happens to mount.
 *
 * The route is the same documented shape the GitHub half uses: a registered
 * `connection.fetch` path, answering JSON, with the browser addressing the
 * document-relative form.
 */
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { json } from './github.js'

/** Absolute path the Host registers; the browser uses {@link FOLDERS_ROUTE}. */
export const FOLDERS_PATH = '/api/polish.folders'

/** Document-relative form the bundle calls with `fetch`. */
export const FOLDERS_ROUTE = FOLDERS_PATH.slice(1)

/**
 * Places a folder browser can start from.
 *
 * @returns labelled roots, the profile's home first.
 */
export function folderRoots(home = homedir()) {
  const roots = [{ label: 'Home', path: home }]
  const drive = process.env.SystemDrive ?? 'C:'
  if (drive !== '') roots.push({ label: `${drive}\\`, path: `${drive}\\` })
  return roots
}

/**
 * List the subdirectories of one directory.
 *
 * @param input - a directory path; the client passes what the previous listing
 *   returned, and never a path it composed itself.
 * @returns the resolved path, its parent (null at a drive root) and the child
 *   folders sorted by name, hidden entries excluded.
 */
export async function listFolders(input) {
  if (typeof input !== 'string' || input === '') {
    throw new Error('a folder path is required')
  }
  const path = resolve(input)
  const entries = []
  for (const entry of await fs.readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue
    if (entry.isDirectory() === false) continue
    entries.push({ name: entry.name, path: join(path, entry.name) })
  }
  entries.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
  const parent = dirname(path)
  return { path, parent: parent === path ? null : parent, entries }
}

/**
 * Answer one request from the browser.
 *
 * @param body - `{ action: 'roots' }` or `{ action: 'ls', path }`.
 * @returns a Response with a JSON body.
 */
export async function handleFolders(body) {
  const action = body?.action
  if (action === 'roots') return json({ roots: folderRoots() })
  if (action === 'ls') {
    try {
      return json(await listFolders(body.path))
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'cannot list that folder' }, 400)
    }
  }
  return json({ error: `unknown action ${String(action)}` }, 400)
}

/** The host half mounted by the `workspaceSources` feature. */
export const foldersFeature = {
  name: 'polish-folders',
  inject: ['connection'],
  apply(ctx) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: FOLDERS_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async request => {
        if (request.method !== 'POST') return json({ error: 'POST required' }, 405)
        let body
        try {
          body = await request.json()
        } catch {
          return json({ error: 'a JSON body is required' }, 400)
        }
        return handleFolders(body)
      },
    }))
  },
}

/**
 * Mount the folder route for one configuration.
 *
 * @param ctx - the row's context.
 * @param config - the row's resolved configuration accessor.
 * @returns the mounted plugin fiber.
 */
export function mountFolders(ctx, config) {
  return ctx.plugin({ ...foldersFeature, config })
}
