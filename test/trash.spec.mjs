/**
 * The Session trash.
 *
 * The filesystem half is the risk surface here: it moves real session logs around
 * a real home, so every gate that protects them is pinned against a temp tree
 * shaped like the real one (`sessions/<encoded-cwd>/session-<uuid>/…`).
 *
 * @module test/trash
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

import {
  TRASH_ERRORS,
  TRASH_MANIFEST_VERSION,
  emptyTrash,
  emptyTrashManifest,
  findSessionFolder,
  folderBytes,
  homeRoot,
  listTrash,
  purgeSession,
  readTrashManifest,
  restoreSession,
  sourceFolder,
  trashManifestPath,
  trashRoot,
  trashSession,
  writeTrashManifest,
} from '../entries/trash-store.js'
import { answerTrashRequest } from '../entries/trash.js'

const ID_A = '004127e5-2342-4682-841f-5fa827fe43bc'
const ID_B = '061f259e-26dc-404a-aa92-fa0c9256a1f7'

const homes = []

/** Build a home shaped like the harness one: sessions/<encoded>/session-<id>/log. */
function makeHome(id, bytes = 2048) {
  const home = mkdtempSync(join(tmpdir(), 'polish-trash-'))
  homes.push(home)
  const folder = join(home, 'sessions', '--C-Users-KNPhu-Documents--', 'session-' + id)
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'session.v4.jsonl.zstd'), Buffer.alloc(bytes, 7))
  return { home, folder }
}

after(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true })
})

const isArchived = () => true
const isLive = () => false

describe('layout', () => {
  it('finds the session folder by id at the depth the real layout has', () => {
    const { home, folder } = makeHome(ID_A)
    assert.equal(findSessionFolder(join(home, 'sessions'), ID_A), folder)
  })

  it('answers null when the log is gone', () => {
    const { home } = makeHome(ID_A)
    assert.equal(findSessionFolder(join(home, 'sessions'), ID_B), null)
  })

  it('refuses an id that is not a uuid, so no request reaches the filesystem as a path', () => {
    const { home } = makeHome(ID_A)
    assert.throws(
      () => findSessionFolder(join(home, 'sessions'), '../../sessions'),
      (error) => error.code === TRASH_ERRORS.badId,
    )
  })

  it('names the trash under home, not under the sessions tree', () => {
    const { home } = makeHome(ID_A)
    assert.equal(trashRoot(home), join(home, 'polish-trash'))
    assert.equal(trashManifestPath(home), join(home, 'polish-trash', 'trash-manifest.json'))
  })

  it('resolves home from the explicit path before any environment value', () => {
    assert.equal(homeRoot('/tmp/explicit'), '/tmp/explicit')
  })

  it('reads the workspace folder back out of a recorded source path', () => {
    assert.equal(sourceFolder(join('sessions', '--C-Users-KNPhu-Documents--', 'session-' + ID_A)),
      'C\\Users\\KNPhu\\Documents')
  })
})

describe('trashing', () => {
  it('moves the folder and records where it came from', () => {
    const { home, folder } = makeHome(ID_A, 4096)
    const done = trashSession({ home, sessionId: ID_A, archived: true, title: 'Greeting', now: 1000 })
    assert.equal(done.bytes, 4096)
    assert.equal(statSync(join(trashRoot(home), 'sessions', ID_A)).isDirectory(), true)
    assert.throws(() => statSync(folder), 'the source folder no longer exists')
    const { manifest } = readTrashManifest(trashManifestPath(home))
    assert.equal(manifest.items.length, 1)
    assert.equal(manifest.items[0].id, ID_A)
    assert.equal(manifest.items[0].title, 'Greeting')
    assert.equal(manifest.items[0].trashedAt, 1000)
    assert.equal(manifest.version, TRASH_MANIFEST_VERSION)
  })

  it('refuses a session that is not archived', () => {
    const { home, folder } = makeHome(ID_A)
    assert.throws(
      () => trashSession({ home, sessionId: ID_A, archived: false }),
      (error) => error.code === TRASH_ERRORS.notArchived,
    )
    assert.equal(statSync(folder).isDirectory(), true)
  })

  it('refuses a session with no stored log, and writes no entry', () => {
    const { home } = makeHome(ID_A)
    assert.throws(
      () => trashSession({ home, sessionId: ID_B, archived: true }),
      (error) => error.code === TRASH_ERRORS.notFound,
    )
    const { manifest } = readTrashManifest(trashManifestPath(home))
    assert.equal(manifest.items.length, 0)
  })

  it('refuses to trash the same session twice', () => {
    const { home } = makeHome(ID_A)
    trashSession({ home, sessionId: ID_A, archived: true })
    assert.throws(
      () => trashSession({ home, sessionId: ID_A, archived: true }),
      (error) => error.code === TRASH_ERRORS.alreadyTrashed,
    )
  })

  it('keeps a corrupt manifest out of the way and answers empty', () => {
    const { home } = makeHome(ID_A)
    mkdirSync(trashRoot(home), { recursive: true })
    writeFileSync(trashManifestPath(home), '{ not json')
    const { manifest, recovered } = readTrashManifest(trashManifestPath(home))
    assert.equal(manifest.items.length, 0)
    assert.match(String(recovered), /trash-manifest\.json\.corrupt-\d+$/)
    assert.match(readFileSync(recovered, 'utf8'), /not json/)
  })

  it('writes the manifest atomically, leaving no temp file behind', () => {
    const { home } = makeHome(ID_A)
    trashSession({ home, sessionId: ID_A, archived: true })
    const body = readFileSync(trashManifestPath(home), 'utf8')
    assert.match(body, /"id"/)
    assert.equal(statSync(trashManifestPath(home)).isFile(), true)
    const strays = readdirSync(trashRoot(home)).filter(name => name.includes('.tmp-'))
    assert.deepEqual(strays, [])
  })
})

describe('restoring', () => {
  it('puts the folder back on the recorded path and clears the entry', () => {
    const { home, folder } = makeHome(ID_A)
    trashSession({ home, sessionId: ID_A, archived: true })
    const done = restoreSession({ home, sessionId: ID_A })
    assert.equal(done.target, folder)
    assert.equal(statSync(join(folder, 'session.v4.jsonl.zstd')).isFile(), true)
    const { manifest } = readTrashManifest(trashManifestPath(home))
    assert.equal(manifest.items.length, 0)
  })

  it('refuses to overwrite a session that is already back on disk', () => {
    const { home, folder } = makeHome(ID_A)
    trashSession({ home, sessionId: ID_A, archived: true })
    mkdirSync(folder, { recursive: true })
    assert.throws(
      () => restoreSession({ home, sessionId: ID_A }),
      (error) => error.code === TRASH_ERRORS.restoreTargetBusy,
    )
  })

  it('refuses an entry with no bytes behind it', () => {
    const { home } = makeHome(ID_A)
    trashSession({ home, sessionId: ID_A, archived: true })
    rmSync(join(trashRoot(home), 'sessions', ID_A), { recursive: true, force: true })
    assert.throws(
      () => restoreSession({ home, sessionId: ID_A }),
      (error) => error.code === TRASH_ERRORS.notFound,
    )
  })

  it('refuses a session that was never trashed', () => {
    const { home } = makeHome(ID_A)
    assert.throws(
      () => restoreSession({ home, sessionId: ID_A }),
      (error) => error.code === TRASH_ERRORS.missingEntry,
    )
  })
})

describe('deleting for good', () => {
  it('removes one transcript and reports the bytes it freed', () => {
    const { home } = makeHome(ID_A, 1024)
    const { home: homeB } = makeHome(ID_B, 2048)
    trashSession({ home, sessionId: ID_A, archived: true })
    const done = purgeSession({ home, sessionId: ID_A })
    assert.equal(done.bytes, 1024)
    assert.throws(() => statSync(join(trashRoot(home), 'sessions', ID_A)))
    const { manifest } = readTrashManifest(trashManifestPath(home))
    assert.equal(manifest.items.length, 0)
    assert.equal(statSync(join(homeB, 'sessions')).isDirectory(), true)
  })

  it('empties everything, including bytes with no entry behind them', () => {
    const { home } = makeHome(ID_A, 1024)
    trashSession({ home, sessionId: ID_A, archived: true })
    // Bytes the user moved in by hand: an entry-less folder in the trash.
    mkdirSync(join(trashRoot(home), 'sessions', 'hand-moved'), { recursive: true })
    const done = emptyTrash({ home })
    assert.equal(done.removed, 1)
    assert.equal(done.bytes, 1024)
    assert.equal(statSync(join(trashRoot(home), 'sessions')).isDirectory(), true)
    const entries = readFileSync(trashManifestPath(home), 'utf8')
    assert.match(entries, /"items": \[\]/)
  })

  it('tolerates an empty trash with nothing on disk at all', () => {
    const { home } = makeHome(ID_A)
    const done = emptyTrash({ home })
    assert.equal(done.removed, 0)
    assert.equal(done.bytes, 0)
  })
})

describe('listing', () => {
  it('reports newest first, with the bytes that add up', () => {
    const { home } = makeHome(ID_A, 1024)
    trashSession({ home, sessionId: ID_A, archived: true, title: 'First', now: 1000 })
    // A second session, in the same home and a different encoded workspace group.
    const folder = join(home, 'sessions', '--C-Users-KNPhu--', 'session-' + ID_B)
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'session.v4.jsonl.zstd'), Buffer.alloc(3072, 7))
    trashSession({ home, sessionId: ID_B, archived: true, title: 'Second', now: 2000 })
    const list = listTrash({ home })
    assert.deepEqual(list.items.map(entry => entry.title), ['Second', 'First'])
    assert.equal(list.bytes, 4096)
    assert.equal(list.recovered, null)
  })

  it('measures bytes from disk when an entry recorded none', () => {
    const { home } = makeHome(ID_A, 512)
    const file = trashManifestPath(home)
    mkdirSync(trashRoot(home), { recursive: true })
    mkdirSync(join(trashRoot(home), 'sessions', ID_A), { recursive: true })
    writeFileSync(join(trashRoot(home), 'sessions', ID_A, 'session.v4.jsonl.zstd'), Buffer.alloc(512, 7))
    writeTrashManifest(file, { items: [{ id: ID_A, title: 'Old', source: join('sessions', 'x', 'session-' + ID_A), trashedAt: 1 }] })
    const list = listTrash({ home })
    assert.equal(list.items[0].bytes, 512)
  })

  it('answers an empty list when nothing is trashed', () => {
    const { home } = makeHome(ID_A)
    const list = listTrash({ home })
    assert.deepEqual(list.items, [])
    assert.equal(list.bytes, 0)
  })
})

describe('the route answers', () => {
  it('refuses a live session with the code the tree can name', async () => {
    const { home } = makeHome(ID_A)
    const answer = await answerTrashRequest({ home, action: 'trash', sessionId: ID_A, isArchived: isLive })
    assert.equal(answer.ok, false)
    assert.equal(answer.code, TRASH_ERRORS.notArchived)
    assert.match(answer.message, /archived/)
  })

  it('refuses when the archive gate cannot be read at all', async () => {
    const { home } = makeHome(ID_A)
    const answer = await answerTrashRequest({ home, action: 'trash', sessionId: ID_A, isArchived: () => null })
    assert.equal(answer.ok, false)
    assert.equal(answer.code, 'trash_registry_unavailable')
  })

  it('trashes, lists and restores through the route', async () => {
    const { home, folder } = makeHome(ID_A)
    const trashed = await answerTrashRequest({ home, action: 'trash', sessionId: ID_A, title: 'Greeting', isArchived })
    assert.equal(trashed.ok, true)
    const list = await answerTrashRequest({ home, action: 'list' })
    assert.equal(list.ok, true)
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].title, 'Greeting')
    const restored = await answerTrashRequest({ home, action: 'restore', sessionId: ID_A })
    assert.equal(restored.ok, true)
    assert.equal(statSync(join(folder, 'session.v4.jsonl.zstd')).isFile(), true)
  })

  it('purges and empties through the route', async () => {
    const { home } = makeHome(ID_A, 2048)
    await answerTrashRequest({ home, action: 'trash', sessionId: ID_A, isArchived })
    const purged = await answerTrashRequest({ home, action: 'purge', sessionId: ID_A })
    assert.equal(purged.ok, true)
    assert.equal(purged.bytes, 2048)
    const emptied = await answerTrashRequest({ home, action: 'empty' })
    assert.equal(emptied.ok, true)
    assert.equal(emptied.removed, 0)
  })

  it('names an unknown action instead of guessing', async () => {
    const { home } = makeHome(ID_A)
    const answer = await answerTrashRequest({ home, action: 'burn', sessionId: ID_A })
    assert.equal(answer.ok, false)
    assert.equal(answer.code, 'trash_unknown_action')
  })

  it('defaults to a list when no action arrives', async () => {
    const { home } = makeHome(ID_A)
    const answer = await answerTrashRequest({ home })
    assert.equal(answer.ok, true)
    assert.deepEqual(answer.items, [])
  })
})

describe('the tree folder-form id', () => {
  it('accepts the prefixed id the tree lists a discovered session by', () => {
    const { home, folder } = makeHome(ID_A, 1024)
    const done = trashSession({ home, sessionId: 'session-' + ID_A, archived: true, title: 'Folder form', now: 5 })
    assert.equal(done.id, ID_A, 'the entry is recorded under the uuid')
    assert.equal(statSync(join(trashRoot(home), 'sessions', ID_A)).isDirectory(), true)
    const restored = restoreSession({ home, sessionId: 'session-' + ID_A })
    assert.equal(restored.target, folder)
  })

  it('finds the folder by either spelling', () => {
    const { home, folder } = makeHome(ID_A)
    assert.equal(findSessionFolder(join(home, 'sessions'), 'session-' + ID_A), folder)
    assert.equal(findSessionFolder(join(home, 'sessions'), ID_A), folder)
  })

  it('refuses a prefixed id that hides something else', () => {
    const { home } = makeHome(ID_A)
    assert.throws(
      () => trashSession({ home, sessionId: 'session-../../x', archived: true }),
      (error) => error.code === TRASH_ERRORS.badId,
    )
    assert.throws(
      () => trashSession({ home, sessionId: '', archived: true }),
      (error) => error.code === TRASH_ERRORS.badId,
    )
  })
})

describe('byte accounting', () => {
  it('sums a folder recursively', () => {
    const { home, folder } = makeHome(ID_A, 1000)
    mkdirSync(join(folder, 'nested'), { recursive: true })
    writeFileSync(join(folder, 'nested', 'extra.bin'), Buffer.alloc(250, 7))
    assert.equal(folderBytes(folder), 1250)
  })

  it('answers zero for a folder that is not there', () => {
    assert.equal(folderBytes(join(tmpdir(), 'polish-trash-nope-' + Date.now())), 0)
  })

  it('has a helper for the manifest default, so an empty trash is a shape and not a null', () => {
    const blank = emptyTrashManifest()
    assert.equal(blank.version, TRASH_MANIFEST_VERSION)
    assert.deepEqual(blank.items, [])
  })
})
