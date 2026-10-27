/**
 * The bundle's composition patch.
 *
 * A patch that targets a row another bundle owns makes composition fail when
 * that bundle is absent ("patch: entry ... not found"), which is why this patch
 * is one insert of its own row and nothing else. The row names the bare package
 * specifier: the Shell classifies a client row by `exactPackageSpecifier`, so a
 * subpath would mount the host half and silently drop the browser face.
 */
import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { load } from 'js-yaml'

const patch = load(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8'))

test('the patch is exactly one insert block', () => {
  assert.ok(Array.isArray(patch), 'patch must be a YAML sequence')
  assert.equal(patch.length, 1, 'a bundle patch carries one operation')
  assert.deepEqual(Object.keys(patch[0]), ['insert'], 'the only operation is insert')
  assert.ok(Array.isArray(patch[0].insert), 'insert carries a list of rows')
})

test('the bundle inserts exactly one row', () => {
  assert.equal(patch[0].insert.length, 1)
})

test('the row is the polish row with a bare package specifier', () => {
  const [row] = patch[0].insert
  assert.equal(row.id, 'polish')
  assert.equal(row.name, '@aryacode/dsh-aryacode-polish')
  assert.ok(!row.name.includes('/polish'), 'a subpath would drop the client face')
})

test('the row does not disable or pre-configure itself', () => {
  const [row] = patch[0].insert
  for (const key of ['disabled', 'config']) {
    assert.equal(row[key], undefined, `the patch must not carry "${key}"`)
  }
})
