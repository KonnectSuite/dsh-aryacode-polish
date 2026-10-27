/**
 * The balance line's two pure decisions.
 *
 * `client/money.js` is inlined into the browser bundle, so these cases are the
 * ones the Shell actually runs: which wallet is shown, and what the money looks
 * like. The refusal cases matter most — a line that guesses a number is worse
 * than a line that says nothing.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { formatBalance, walletOf } from '../client/money.js'

test('a ready view yields its first wallet', () => {
  const wallet = { currency: 'USD', balance: '17.33' }
  assert.equal(walletOf({ status: 'ready', value: [wallet] }), wallet)
})

test('a view with no wallet yields nothing', () => {
  assert.equal(walletOf(undefined), undefined)
  assert.equal(walletOf(null), undefined)
  assert.equal(walletOf({ status: 'failed' }), undefined)
  assert.equal(walletOf({ status: 'ready', value: [] }), undefined)
  assert.equal(walletOf({ status: 'ready' }), undefined)
})

test('a malformed wallet is skipped rather than rendered', () => {
  assert.equal(walletOf({ status: 'ready', value: [{ currency: 'USD' }] }), undefined)
  assert.equal(walletOf({ status: 'ready', value: [null, 'nope'] }), undefined)
  const good = { currency: 'CNY', balance: '0.00' }
  assert.equal(walletOf({ status: 'ready', value: [null, good] }), good)
})

test('dollars render at two decimals', () => {
  assert.equal(formatBalance({ currency: 'USD', balance: '17.33' }), '$17.33')
  assert.equal(formatBalance({ currency: 'USD', balance: '7.5' }), '$7.50')
  assert.equal(formatBalance({ currency: 'USD', balance: '0' }), '$0.00')
})

test('yuan renders with the yuan symbol', () => {
  assert.equal(formatBalance({ currency: 'CNY', balance: '126.40' }), '\u00A5126.40')
})

test('an unparseable balance is shown as the Host sent it', () => {
  assert.equal(formatBalance({ currency: 'USD', balance: 'n/a' }), '$n/a')
})
