/**
 * The session trash on disk.
 *
 * AryaCode has no verb that removes a Session: the Host's own decision record
 * (`workspace-registration-deletion`) says a registration never deletes its
 * folder or its logs, and Session persistence sits outside that boundary. So the
 * removal lives here, and it stays inside the one boundary a plugin can prove it
 * owns - the Session's own storage folder:
 *
 *     <home>/sessions/<encoded-cwd>/session-<id>/session.v*.jsonl.zstd
 *
 * Trashing *moves* that folder under `<home>/polish-trash/sessions/<id>` and
 * records where it came from, so restoring puts it back exactly where the
 * persistence layer expects it. Nothing is overwritten and nothing is deleted
 * until the user asks for the permanent step.
 *
 * What trashing does not touch, on purpose:
 *
 * - The workspace folder and every file in it. That is the user's directory, not
 *   AryaCode's record, and the Host refuses to claim ownership of it.
 * - The attachment store (`<home>/attachments/`). Its objects are
 *   content-addressed and shared between Sessions, so removing them for one
 *   Session could break another, and no plugin can refcount them. They are
 *   harmless orphaned bytes, reclaimed by a Host-owned garbage collector if one
 *   ever ships.
 *
 * The manifest is written atomically and read defensively, exactly like
 * `mcp/store.js`: a corrupt file is moved aside rather than taking the feature
 * down, because this file is the only map back to the trashed logs.
 *
 * @module dsh-aryacode-polish-trash-store
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'

/** The folder under home that holds the trash and its manifest. */
export const TRASH_DIR = 'polish-trash'

/** The manifest file name inside {@link TRASH_DIR}. */
export const TRASH_MANIFEST_FILE = 'trash-manifest.json'

/** The shape version this module reads and writes. */
export const TRASH_MANIFEST_VERSION = 1

/** A Session id is a uuid: nothing with a path separator in it reaches the filesystem. */
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The stable failure codes the browser renders. A plugin must not hand the UI a
 * raw filesystem message: `ENOENT, EPERM, EACCES` say nothing about which of the
 * safety gates stopped the action.
 */
export const TRASH_ERRORS = {
  badId: 'trash_bad_id',
  notArchived: 'trash_not_archived',
  notFound: 'trash_not_found',
  alreadyTrashed: 'trash_already_trashed',
  busy: 'trash_busy',
  restoreTargetBusy: 'trash_restore_target_busy',
  missingEntry: 'trash_missing_entry',
}

/**
 * Build a named failure with a stable code.
 * @param {string} code one of {@link TRASH_ERRORS}.
 * @param {string} message the words for a log line.
 * @returns {Error} the failure.
 */
function fail(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/**
 * The uuid behind a Session id as the app names it.
 *
 * The tree lists a discovered Session by its folder name (`session-<uuid>`) and by
 * its bare uuid in the places the Host hands one over, and its archive set stores
 * the form the row carried. So every request is accepted in both spellings, and
 * the folder the store moves always carries the canonical one.
 *
 * @param {string} value the id as received.
 * @returns {string} the uuid.
 */
function sessionSlug(value) {
  const raw = String(value === null || value === undefined ? '' : value).trim()
  const slug = raw.indexOf('session-') === 0 ? raw.slice('session-'.length) : raw
  if (!SESSION_ID_PATTERN.test(slug)) throw fail(TRASH_ERRORS.badId, 'session id is not a uuid')
  return slug
}

/**
 * Where the harness home is. Mirrors `mcp/store.js`: an explicit home for tests,
 * then `DSH_HOME`, then the installed profile root.
 * @param {string | undefined} home an explicit home.
 * @returns {string} the absolute home path.
 */
export function homeRoot(home) {
  const base = home
    ?? (typeof process === 'object' && process.env !== undefined ? process.env.DSH_HOME : undefined)
    ?? join(homedir(), '.aryacode')
  return base
}

/**
 * The trash directory for a home.
 * @param {string | undefined} home an explicit home.
 * @returns {string} the absolute path.
 */
export function trashRoot(home) {
  return join(homeRoot(home), TRASH_DIR)
}

/**
 * The manifest path for a home.
 * @param {string | undefined} home an explicit home.
 * @returns {string} the absolute path.
 */
export function trashManifestPath(home) {
  return join(trashRoot(home), TRASH_MANIFEST_FILE)
}

/** An empty manifest. @returns {{version: number, items: object[]}} the manifest. */
export function emptyTrashManifest() {
  return { version: TRASH_MANIFEST_VERSION, items: [] }
}

/**
 * Read the trash manifest, recovering from a corrupt file.
 *
 * A file that cannot be parsed is moved to `<file>.corrupt-<timestamp>` so the
 * map is not lost, and an empty manifest answers. A missing file is not an error:
 * a machine with nothing trashed has no file at all.
 *
 * @param {string} file the manifest path.
 * @returns {{manifest: {version: number, items: object[]}, recovered: string | null}}
 *   the manifest, and the path a corrupt file was moved to.
 */
export function readTrashManifest(file) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { manifest: emptyTrashManifest(), recovered: null }
    throw error
  }
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      throw new Error('items must be an array')
    }
    const items = parsed.items.filter(entry => entry !== null && typeof entry === 'object'
      && typeof entry.id === 'string' && entry.id !== '' && typeof entry.source === 'string')
    return { manifest: { version: TRASH_MANIFEST_VERSION, items }, recovered: null }
  } catch {
    const target = `${file}.corrupt-${Date.now()}`
    try {
      renameSync(file, target)
    } catch {
      // Keep answering empty; the caller reports the path it moved to.
    }
    return { manifest: emptyTrashManifest(), recovered: target }
  }
}

/**
 * Write the trash manifest atomically, mode 0600 where the platform honours it.
 * @param {string} file the manifest path.
 * @param {{items: object[]}} manifest the manifest.
 * @returns {void} nothing.
 */
export function writeTrashManifest(file, manifest) {
  mkdirSync(dirname(file), { recursive: true })
  const body = JSON.stringify({ version: TRASH_MANIFEST_VERSION, items: manifest.items }, null, 2) + '\n'
  const temporary = `${file}.tmp-${process.pid}`
  writeFileSync(temporary, body, 'utf8')
  try {
    chmodSync(temporary, 0o600)
  } catch {
    // POSIX-only nicety; Windows ignores the mode.
  }
  renameSync(temporary, file)
}

/**
 * Find the Session's own storage folder.
 *
 * The folder's parent is a lossy encoding of the Session's working directory (the
 * separators become dashes and Windows short names show through), so the only
 * shape worth relying on is `sessions/<any>/session-<id>`. A scan two levels deep
 * is the whole of it.
 *
 * @param {string} sessionsRoot the `<home>/sessions` directory.
 * @param {string} sessionId the Session id.
 * @returns {string | null} the absolute folder, or null when it is not there.
 */
export function findSessionFolder(sessionsRoot, sessionId) {
  const slug = sessionSlug(sessionId)
  let groups
  try {
    groups = readdirSync(sessionsRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  const wanted = 'session-' + slug
  for (const group of groups) {
    if (!group.isDirectory()) continue
    const candidate = join(sessionsRoot, group.name, wanted)
    try {
      if (statSync(candidate).isDirectory()) return candidate
    } catch {
      // Not in this group; keep looking.
    }
  }
  return null
}

/**
 * Every folder in the trash for a Session.
 * @param {string | undefined} home an explicit home.
 * @param {string} sessionId the Session id.
 * @returns {string} the absolute trash folder path.
 */
export function trashedFolder(home, sessionId) {
  return join(trashRoot(home), 'sessions', sessionId)
}

/**
 * The bytes a folder holds, for the "how much did this cost me" line.
 * @param {string} folder the folder.
 * @returns {number} the total size of its files.
 */
export function folderBytes(folder) {
  let total = 0
  let entries
  try {
    entries = readdirSync(folder, { withFileTypes: true })
  } catch {
    return total
  }
  for (const entry of entries) {
    const at = join(folder, entry.name)
    if (entry.isDirectory()) total += folderBytes(at)
    else {
      try {
        total += statSync(at).size
      } catch {
        // Racing removal: that file counts for nothing.
      }
    }
  }
  return total
}

/**
 * Trash one Session folder.
 *
 * @param {object} options the request.
 * @param {string} [options.home] the harness home.
 * @param {string} options.sessionId the Session id.
 * @param {boolean} options.archived is that Session archived? Host-confirmed.
 * @param {string} [options.title] the row's display title, for the trash list.
 * @param {number} [options.now] the timestamp to record.
 * @returns {{id: string, source: string, bytes: number}} the new manifest entry.
 */
export function trashSession(options) {
  const home = homeRoot(options.home)
  const slug = sessionSlug(options.sessionId)
  // The archive is the safety gate the Host already built: archiving stopped the
  // Session's turn, its subagents, its jobs and its schedules, and its gate keeps
  // it from running a model step. A live Session is not ours to remove.
  if (options.archived !== true) throw fail(TRASH_ERRORS.notArchived, 'only an archived session can be trashed')
  const manifestFile = trashManifestPath(home)
  const { manifest } = readTrashManifest(manifestFile)
  if (manifest.items.some(entry => entry.id === slug)) {
    throw fail(TRASH_ERRORS.alreadyTrashed, 'that session is already in the trash')
  }
  const folder = findSessionFolder(join(home, 'sessions'), slug)
  if (folder === null) throw fail(TRASH_ERRORS.notFound, 'that session has no stored log')
  const target = trashedFolder(home, slug)
  const bytes = folderBytes(folder)
  const source = relative(home, folder)
  // Move the log out first, then record the move. A manifest naming a folder that
  // did not move would promise a restore of a log that is still live.
  mkdirSync(dirname(target), { recursive: true })
  renameSync(folder, target)
  manifest.items.push({
    id: slug,
    title: typeof options.title === 'string' ? options.title : '',
    source,
    trashedAt: Number(options.now) || Date.now(),
    bytes,
  })
  writeTrashManifest(manifestFile, manifest)
  return { id: slug, source, bytes }
}

/**
 * Put one trashed Session back where its log belongs.
 * @param {object} options the request.
 * @param {string} [options.home] the harness home.
 * @param {string} options.sessionId the Session id.
 * @returns {{id: string, target: string}} where it landed.
 */
export function restoreSession(options) {
  const home = homeRoot(options.home)
  const slug = sessionSlug(options.sessionId)
  const manifestFile = trashManifestPath(home)
  const { manifest } = readTrashManifest(manifestFile)
  const entry = manifest.items.find(item => item.id === slug)
  if (entry === undefined) throw fail(TRASH_ERRORS.missingEntry, 'that session is not in the trash')
  const folder = trashedFolder(home, slug)
  if (!existsSync(folder)) throw fail(TRASH_ERRORS.notFound, 'that trash entry has no stored log')
  const target = join(home, entry.source)
  if (existsSync(target)) throw fail(TRASH_ERRORS.restoreTargetBusy, 'that session is back on disk already')
  mkdirSync(dirname(target), { recursive: true })
  renameSync(folder, target)
  writeTrashManifest(manifestFile, { items: manifest.items.filter(item => item.id !== slug) })
  return { id: slug, target }
}

/**
 * Delete one trashed Session's log for good.
 * @param {object} options the request.
 * @param {string} [options.home] the harness home.
 * @param {string} options.sessionId the Session id.
 * @returns {{id: string, bytes: number}} what went.
 */
export function purgeSession(options) {
  const home = homeRoot(options.home)
  const slug = sessionSlug(options.sessionId)
  const manifestFile = trashManifestPath(home)
  const { manifest } = readTrashManifest(manifestFile)
  const entry = manifest.items.find(item => item.id === slug)
  if (entry === undefined) throw fail(TRASH_ERRORS.missingEntry, 'that session is not in the trash')
  const folder = trashedFolder(home, slug)
  const bytes = entry.bytes ?? folderBytes(folder)
  rmSync(folder, { recursive: true, force: true })
  writeTrashManifest(manifestFile, { items: manifest.items.filter(item => item.id !== slug) })
  return { id: slug, bytes }
}

/**
 * Empty the trash: every logged folder goes, permanently.
 *
 * Manifest entries and filesystem truth are reconciled here, because a manual
 * deletion in the file browser leaves an entry with no bytes behind - and an
 * empty trash must be empty on disk, not merely empty on paper.
 *
 * @param {object} options the request.
 * @param {string} [options.home] the harness home.
 * @returns {{removed: number, bytes: number}} what went.
 */
export function emptyTrash(options) {
  const home = homeRoot(options.home)
  const manifestFile = trashManifestPath(home)
  const { manifest } = readTrashManifest(manifestFile)
  let bytes = 0
  for (const entry of manifest.items) {
    bytes += entry.bytes ?? 0
    rmSync(trashedFolder(home, entry.id), { recursive: true, force: true })
  }
  writeTrashManifest(manifestFile, emptyTrashManifest())
  // Anything in the trash folder with no manifest entry (a folder the user moved
  // there by hand) is part of an "empty the trash" request too.
  const sessionsRoot = join(trashRoot(home), 'sessions')
  try {
    for (const entry of readdirSync(sessionsRoot)) {
      rmSync(join(sessionsRoot, entry), { recursive: true, force: true })
    }
  } catch {
    // No trash folder at all: the trash was already empty.
  }
  return { removed: manifest.items.length, bytes }
}

/**
 * List the trash, newest first, with the bytes each entry costs.
 *
 * Sizes are read from disk when an entry has no recorded number, so a manifest
 * written by an older version still tells the truth about the space it names.
 *
 * @param {object} options the request.
 * @param {string} [options.home] the harness home.
 * @returns {{items: object[], bytes: number, recovered: string | null}} the list.
 */
export function listTrash(options) {
  const home = homeRoot(options.home)
  const { manifest, recovered } = readTrashManifest(trashManifestPath(home))
  const items = manifest.items.map(entry => ({
    id: entry.id,
    title: typeof entry.title === 'string' ? entry.title : '',
    source: entry.source,
    trashedAt: Number(entry.trashedAt) || 0,
    bytes: typeof entry.bytes === 'number' ? entry.bytes : folderBytes(trashedFolder(home, entry.id)),
    folder: basename(trashedFolder(home, entry.id)),
  })).sort((a, b) => b.trashedAt - a.trashedAt)
  return { items, bytes: items.reduce((total, entry) => total + (entry.bytes || 0), 0), recovered }
}

/**
 * The workspace folder a trash entry names, for the confirm line that promises
 * the user their files are safe.
 * @param {string} source the manifest's recorded source path.
 * @returns {string} the working directory whose Session this was.
 */
export function sourceFolder(source) {
  const parts = String(source || '').split(/[\\/]+/)
  // sessions/<encoded-cwd>/session-<id> -> the encoded cwd, the readable part.
  const encoded = parts.length >= 2 ? parts[parts.length - 2] : ''
  return encoded.replace(/^--?/, '').replace(/-+$/, '').replace(/-/g, '\\')
}
