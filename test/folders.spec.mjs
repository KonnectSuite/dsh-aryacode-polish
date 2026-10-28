/**
 * The folder list behind "On this PC".
 *
 * These cases exist because the flow must behave the same in the app and in the
 * browser: the listing is this bundle's own route, so its shape — roots, a
 * parent for going back, directories only, no hidden or system directories — is
 * a contract the dialog depends on.
 */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { folderRoots, handleFolders, listFolders } from '../entries/folders.js'

test('the roots start at home and offer the system drive', () => {
  const roots = folderRoots('C:\\Users\\someone')
  assert.equal(roots[0].label, 'Home')
  assert.equal(roots[0].path, 'C:\\Users\\someone')
  assert.ok(roots.some(root => /^[A-Za-z]:\\$/.test(root.path)), 'a drive root must be reachable')
})

test('the default home is the profile directory', () => {
  assert.deepEqual(folderRoots(), folderRoots(homedir()))
})

test('a listing keeps directories, drops files, hidden entries and system entries', async t => {
  const root = await mkdtemp(join(tmpdir(), 'polish-folders-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'alpha'))
  await mkdir(join(root, 'Beta'))
  await mkdir(join(root, '.hidden'))
  await mkdir(join(root, '$Recycle.Bin'))
  await writeFile(join(root, 'notes.txt'), 'not a folder')

  const listing = await listFolders(root)
  assert.deepEqual(listing.entries.map(entry => entry.name), ['alpha', 'Beta'])
  assert.equal(listing.entries[0].path, join(root, 'alpha'))
  assert.equal(listing.path, root)
})

test('a nested folder reports its parent so the dialog can go back', async t => {
  const root = await mkdtemp(join(tmpdir(), 'polish-folders-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const child = join(root, 'child')
  await mkdir(child)

  const listing = await listFolders(child)
  assert.equal(listing.parent, root)
  assert.deepEqual(listing.entries, [])
})

test('a drive root has no parent', async () => {
  const listing = await listFolders('C:\\')
  assert.equal(listing.parent, null)
})

test('a missing folder is an error, not an empty listing', async () => {
  await assert.rejects(() => listFolders(join(tmpdir(), 'polish-does-not-exist-9f8a')), /ENOENT/)
})

test('an empty path is refused', async () => {
  await assert.rejects(() => listFolders(''), /a folder path is required/)
})

test('the route answers roots, listings and unknown actions', async () => {
  const roots = await (await handleFolders({ action: 'roots' })).json()
  assert.ok(Array.isArray(roots.roots) && roots.roots.length > 0)

  const listing = await (await handleFolders({ action: 'ls', path: 'C:\\' })).json()
  assert.equal(typeof listing.path, 'string')
  assert.ok(Array.isArray(listing.entries))

  const refused = await handleFolders({ action: 'ls', path: join(tmpdir(), 'polish-does-not-exist-9f8a') })
  assert.equal(refused.status, 400)
  assert.match((await refused.json()).error, /ENOENT|no such file/i)

  const unknown = await handleFolders({ action: 'nope' })
  assert.equal(unknown.status, 400)
  assert.match((await unknown.json()).error, /unknown action/)
})
