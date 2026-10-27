/**
 * The feature seam.
 *
 * The value of this bundle is that a feature is declared once: one registry entry
 * yields one volatile switch and one mount/unmount decision. These tests pin the
 * derivation with a stub schemastery factory, so the seam is verified while the
 * real feature list is still empty.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { configSchema, features } from '../entries/registry.js'
import { Config, apply, inject, name } from '../entries/polish.js'

/**
 * A stub schemastery factory that records the calls the derivation makes.
 * @returns {{ z: { boolean: () => object }, calls: Array<unknown[]> }}
 */
function stubZ() {
  const calls = []
  const boolean = () => {
    const field = {
      _default: undefined,
      _volatile: false,
      _description: undefined,
      default(value) {
        field._default = value
        calls.push(['default', value])
        return field
      },
      volatile() {
        field._volatile = true
        calls.push(['volatile'])
        return field
      },
      description(text) {
        field._description = text
        calls.push(['description', text])
        return field
      },
    }
    return field
  }
  return { z: { boolean }, calls }
}

const synthetic = [
  { id: 'alpha', label: 'Alpha', description: 'the first feature', defaultOn: true },
  { id: 'beta', label: 'Beta', description: 'the second feature', defaultOn: false },
]

test('one registry entry yields one config field', () => {
  const { z } = stubZ()
  assert.deepEqual(Object.keys(configSchema(z, synthetic)), ['alpha', 'beta'])
})

test('every derived field is volatile, so a switch applies without a remount', () => {
  const { z } = stubZ()
  const shape = configSchema(z, synthetic)
  assert.equal(shape.alpha._volatile, true)
  assert.equal(shape.beta._volatile, true)
})

test('a derived field defaults to the feature default and carries its description', () => {
  const { z } = stubZ()
  const shape = configSchema(z, synthetic)
  assert.equal(shape.alpha._default, true)
  assert.equal(shape.beta._default, false, 'defaultOn false must default the switch off')
  assert.equal(shape.alpha._description, 'the first feature')
})

test('a feature without defaultOn defaults to on', () => {
  const { z } = stubZ()
  const shape = configSchema(z, [{ id: 'gamma', label: 'Gamma', description: 'g' }])
  assert.equal(shape.gamma._default, true)
})

test('the real registry holds well-formed entries', () => {
  assert.ok(Array.isArray(features), 'features must be an array')
  const ids = features.map((feature) => feature.id)
  assert.equal(new Set(ids).size, ids.length, 'feature ids must be unique')
  for (const feature of features) {
    assert.match(feature.id, /^[a-z][a-zA-Z0-9]*$/, `${feature.id} must be a config-safe id`)
    assert.equal(typeof feature.label, 'string')
    assert.equal(typeof feature.description, 'string')
    if ('defaultOn' in feature) assert.equal(typeof feature.defaultOn, 'boolean')
    if ('mount' in feature) assert.equal(typeof feature.mount, 'function')
  }
})

test('the row exports the entry contract', () => {
  assert.equal(name, 'aryacode-polish')
  assert.ok(Array.isArray(inject))
  assert.equal(typeof apply, 'function')
  assert.ok(Config !== undefined, 'the row must declare a Config schema')
})

test('apply follows the switches and survives a volatile-only update', () => {
  const events = []
  const plugins = []
  const ctx = {
    plugin(plugin) {
      const fiber = { dispose() {}, plugin }
      plugins.push(plugin)
      return fiber
    },
    on(event, handler) {
      events.push([event, handler])
      return () => {}
    },
  }
  assert.doesNotThrow(() => apply(ctx, {}))
  assert.deepEqual(events.map(([event]) => event), ['loader/volatile-update'])
  // The real registry is empty today: nothing is mounted, and the row still runs.
  assert.deepEqual(plugins, [])
})
