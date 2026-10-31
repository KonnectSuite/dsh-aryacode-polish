/**
 * The Arya Standard surfaces in the browser.
 *
 * The bundle is generated, so these tests read the generated text: they pin that
 * the two slots exist with the ids and orders the Compaction tab and the Settings
 * page are addressed by, that the settings form writes the right path, and that
 * nothing in this face reaches for a network or a nested document — the data the
 * tab shows is already a projection on the client.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ARYA_STANDARD_FIELDS } from '../presets/arya-standard/fields.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const bundle = read('../lib/client.js')
const source = read('../client/arya.js')
const switches = JSON.parse(read('../client/switches.json'))

test('the bundle carries the field descriptors the host validates', () => {
  assert.ok(bundle.includes('const ARYA_FIELDS = ['))
  for (const field of ARYA_STANDARD_FIELDS) {
    assert.ok(bundle.includes(`"key": "${field.key}"`), `${field.key} is missing from the bundle`)
    assert.ok(bundle.includes(`"label": ${JSON.stringify(field.label)}`), `${field.key}'s label is missing`)
  }
})

test('the Settings page is registered on the shipped settings list', () => {
  assert.ok(bundle.includes("name: 'settings.section'"))
  assert.ok(bundle.includes("id: 'arya-standard'"))
  assert.ok(bundle.includes("label: () => 'Arya Standard'"))
  assert.ok(bundle.includes('AryaStandardSettingsPage'))
})

test('the Compaction tab is a conversation view with its own id and order', () => {
  assert.ok(bundle.includes("name: 'conversation.view'"))
  assert.ok(bundle.includes("id: 'arya-standard-compaction'"))
  assert.ok(bundle.includes("label: () => 'Compaction'"))
  assert.ok(bundle.includes('AryaCompactionView'))
  // The shipped views sit at 0 and 10, billion-context's at 30; ours follows them.
  assert.ok(/name: 'conversation\.view',\s*\n\s*id: 'arya-standard-compaction',\s*\n\s*order: 40,/.test(bundle))
})

test('the settings form writes the switch and reads the policy', () => {
  assert.ok(bundle.includes("const ARYA_GROUP = 'aryaStandardOptions'"))
  // The Host refuses a write to the non-volatile policy group from configForms,
  // so the panel shows the policy read-only and patches only the volatile switch.
  assert.ok(bundle.includes('path: [ARYA_SWITCH]'))
  assert.equal(bundle.includes('path: [ARYA_GROUP]'), false, 'the policy group must not be written from the form')
  assert.ok(bundle.includes('.getSnapshot()'))
  assert.ok(bundle.includes('.mutate('))
})

test('the tab reads projections and the session command surface, nothing else', () => {
  assert.ok(bundle.includes("props.useProjection('aryaStandard')"))
  assert.ok(bundle.includes("props.useProjection('contextPressure')"))
  assert.ok(bundle.includes("session.command('/compact')"))
})

test('the tab is a dashboard, not one gauge and a list', () => {
  // Five tabs, so the view carries the settings editor and the log beside the charts.
  for (const tab of ['Overview', 'Trajectory', 'Checkpoints', 'Logs', 'Settings']) {
    assert.ok(bundle.includes(`'${tab}'`), `the ${tab} tab is missing`)
  }
  // The trajectory is drawn from the folded series, against the window and threshold.
  assert.ok(bundle.includes('function AryaTrajectory'))
  assert.ok(bundle.includes('function AryaStat'))
  assert.ok(bundle.includes('function AryaCacheStrip'))
  assert.ok(bundle.includes('polyline'))
  assert.ok(bundle.includes("vectorEffect: 'non-scaling-stroke'"))
  assert.ok(bundle.includes('contextWindow'))
  // And the stat tiles are fed by the folded totals, not by a second meter.
  assert.ok(bundle.includes('totals.input'))
  assert.ok(bundle.includes('cacheHitRatio'))
  assert.ok(bundle.includes('savedTokens'))
})

test('the new fragment adds no module request and no nested document', () => {
  assert.equal(source.includes('require('), false, 'the fragment must use the factory’s React binding')
  for (const forbidden of ['iframe', 'fetch(', 'XMLHttpRequest', 'http://', 'https://', '<script']) {
    assert.equal(source.includes(forbidden), false, `client/arya.js must not contain ${forbidden}`)
  }
})

test('the switch is declared once and matches the registry entry', () => {
  const keys = switches.switches.map((entry) => entry.key)
  assert.ok(keys.includes('aryaStandard'))
  assert.equal(new Set(keys).size, keys.length)
  const entry = switches.switches.find((candidate) => candidate.key === 'aryaStandard')
  assert.equal(entry.label, 'Arya Standard preset')
  assert.equal(entry.defaultOn, true)
  assert.ok(entry.description.length > 20)
  // Every declared switch key reaches the bundle as a rendered string.
  for (const candidate of switches.switches) {
    assert.ok(bundle.includes(`"key": "${candidate.key}"`), `${candidate.key} is missing from the bundle`)
  }
})
