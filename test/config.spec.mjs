/**
 * The volatile-reference accessors.
 *
 * A `.volatile()` field arrives as a live reference (`{ get() }`), not as its
 * value. Reading it directly makes every switch look falsy, which silently
 * disables features that the settings page has switched on.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { flag, list, resolve, text } from '../entries/config.js'

const ref = (value) => ({ get: () => value })

test('resolve unwraps a volatile reference', () => {
  assert.equal(resolve(ref(true), false), true)
  assert.equal(resolve(ref('a'), ''), 'a')
})

test('resolve passes a plain value through', () => {
  assert.equal(resolve(true, false), true)
  assert.equal(resolve('x', ''), 'x')
})

test('resolve falls back when the value is undefined', () => {
  assert.equal(resolve(undefined, 'fallback'), 'fallback')
  assert.equal(resolve(ref(undefined), 7), 7)
})

test('flag reads booleans through a reference and rejects non-booleans', () => {
  assert.equal(flag(ref(true)), true)
  assert.equal(flag(ref(false), true), false)
  assert.equal(flag(ref('yes'), false), false, 'a string is not a switch')
  assert.equal(flag(undefined), false)
  assert.equal(flag(undefined, true), true)
})

test('list returns an array or an empty list', () => {
  assert.deepEqual(list(ref(['a', 'b'])), ['a', 'b'])
  assert.deepEqual(list(ref('a')), [])
  assert.deepEqual(list(undefined), [])
})

test('text returns a string or the fallback', () => {
  assert.equal(text(ref('v')), 'v')
  assert.equal(text(ref(3), 'd'), 'd')
  assert.equal(text(undefined, 'd'), 'd')
})
