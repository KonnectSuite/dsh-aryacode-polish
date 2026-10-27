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
  assert.deepEqual(required, ['react', 'react-dom'], 'the frozen module table answers react and react-dom; anything else must be inlined')
})

test('the cost pill wears the composer stat skin instead of a widget of its own', () => {
  assert.ok(bundle.includes("'data-composer-stat': 'polish-cost'"), 'the pill is addressable as a composer stat')
  assert.ok(bundle.includes('whiteSpace: \'nowrap\''), 'the label never wraps')
  assert.ok(bundle.includes('var(--dsw-alias-label-tertiary'), 'it takes the row\'s tertiary label colour')
  assert.ok(bundle.includes('tabular-nums'), 'digits keep the row\'s alignment')
  assert.ok(bundle.includes("React.createElement('dl'"), 'the card readings are a definition list like the native dialog')
  assert.ok(bundle.includes('ReactDOM.createPortal'), 'the card escapes the composer\'s clipping')
  assert.ok(bundle.includes('--dsw-elevation-prominent'), 'the card takes the harness dialog elevation')
})

test('every switch has a label and a description', () => {
  for (const entry of declaration.switches) {
    assert.equal(typeof entry.key, 'string')
    assert.match(entry.key, /^[a-z][A-Za-z0-9]*$/)
    assert.ok(entry.label.length > 0, `${entry.key} needs a label`)
    assert.ok(entry.description.length > 0, `${entry.key} needs a description`)
  }
})

test('the face registers every surface it ships, each under its own key', () => {
  for (const slot of ['plugins.row.config', 'conversation.composer.dock', 'sidebar.footer.action']) {
    assert.ok(bundle.includes(`'${slot}'`), `the face must register ${slot}`)
  }
  assert.match(bundle, /id: 'polish-cost'/)
  assert.match(bundle, /id: 'polish-balance'/)
})

test('the balance line registers only where the account namespace exists', () => {
  assert.ok(
    bundle.includes("inject(['remote', 'remote.account']"),
    'the balance surface must wait for the account namespace instead of reading through ctx.get',
  )
  assert.ok(bundle.includes('getBalance('), 'the balance comes from the account Remote method')
  assert.ok(bundle.includes('CLIENT_VERSION'), 'the account call needs a client version the build stamps')
  assert.ok(
    !bundle.includes("whenAccess('account/watch'"),
    'the balance read must not wait for a grant a plugin is not given',
  )
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
