/**
 * The browser face is what makes every feature switchable, so these checks hold
 * it to the two facts the Shell depends on: the bundle registers itself under
 * the package name, and the Configure page it registers is keyed to this
 * bundle's row. The switch list must also agree with the host registry — a
 * switch with no feature would toggle nothing, and a feature with no switch
 * could never be turned off.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { features } from '../entries/registry.js'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const manifest = JSON.parse(read('package.json'))
const declaration = JSON.parse(read('client/switches.json'))
const bundle = read('lib/client.js')

test('the manifest declares a browser face the Shell can find', () => {
  assert.equal(manifest.dsh.client?.platform, 'web')
  assert.equal(manifest.exports?.['./client'], './lib/client.js')
  assert.ok(existsSync(new URL('lib/client.js', root)), 'lib/client.js must be committed; the Shell loads it at runtime')
  assert.deepEqual(manifest.files.filter(entry => entry === 'client/**/*'), ['client/**/*'], 'the face source ships with the package')
})

test('the emitted bundle is loaded under the package name', () => {
  assert.match(bundle, /window\.__ModuleLoader__\.load\(/)
  assert.ok(bundle.includes(`id: ${JSON.stringify(manifest.name)}`), 'the module id must equal the package name')
  assert.ok(bundle.includes('plugins.row.config'), 'the face must register the row configuration slot')
})

test('the row configuration entry is keyed to this bundle row', () => {
  assert.ok(bundle.includes(`${JSON.stringify(manifest.name)} + '#' + ROW_ID`), 'the key is built from the package name and the row id')
  assert.ok(bundle.includes(`const ROW_ID = ${JSON.stringify(declaration.row)}`))
  assert.equal(declaration.row, 'polish', 'the row id must match cordis.patch.yml')
})

test('the face requires only modules the Shell answers', () => {
  const required = [...bundle.matchAll(/require\('([^']+)'\)/g)].map(match => match[1])
  assert.deepEqual(required, ['react'], 'the frozen module table answers react; anything else must be inlined')
})

test('every switch has a label and a description', () => {
  for (const entry of declaration.switches) {
    assert.equal(typeof entry.key, 'string')
    assert.match(entry.key, /^[a-z][A-Za-z0-9]*$/)
    assert.ok(entry.label.length > 0, `${entry.key} needs a label`)
    assert.ok(entry.description.length > 0, `${entry.key} needs a description`)
  }
})

test('the switch list and the feature registry agree', () => {
  const declared = declaration.switches.map(entry => entry.key).sort()
  const registered = features.map(feature => feature.id).sort()
  assert.deepEqual(declared, registered, 'client/switches.json and entries/registry.js must name the same features')
})

test('the emitted bundle lists exactly the declared switches', () => {
  for (const entry of declaration.switches) {
    assert.ok(bundle.includes(`"key": ${JSON.stringify(entry.key)}`), `${entry.key} is missing from lib/client.js; run pnpm build:client`)
  }
})
