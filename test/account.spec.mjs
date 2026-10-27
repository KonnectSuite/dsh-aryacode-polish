/**
 * The balance read, driven without a Shell.
 *
 * `client/account.js` is inlined into the browser bundle, so these cases are the
 * ones the Shell runs: a ready view resolves to the wallet's view, and every
 * refusal — no service, a refused grant, a failed call, a throw — resolves to
 * undefined instead of rejecting into React.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { clientMetadata, makeBalanceReader } from '../client/account.js'

/** Run a `whenAccess` callback the way the Shell's effect runner does. */
function runEffect(callback) {
  const effect = callback()
  if (effect !== null && typeof effect === 'object' && typeof effect.next === 'function') {
    const first = effect.next()
    return typeof first.value === 'function' ? first.value : () => {}
  }
  return typeof effect === 'function' ? effect : () => {}
}

/**
 * A context whose account services behave as told.
 * @param options - `view` the Remote returns, or `refuse` to deny the grant.
 */
function context({ view, refuse = false, throwInCall = false, services = true } = {}) {
  const calls = []
  const grants = []
  const remote = {
    account: {
      async getBalance(metadata) {
        calls.push(metadata)
        if (throwInCall) throw new Error('account balance failed')
        return view === undefined ? { ok: false } : { ok: true, value: view }
      },
    },
  }
  const remoteAccess = {
    whenAccess(action, callback) {
      grants.push(action)
      if (refuse) return () => {}
      return runEffect(callback)
    },
  }
  const ctx = {
    get(name) {
      if (!services) return undefined
      if (name === 'remote') return remote
      if (name === 'remoteAccess') return remoteAccess
      return undefined
    },
  }
  return { ctx, calls, grants }
}

const ready = {
  status: 'ready',
  value: [{ currency: 'USD', balance: '17.33' }],
  bonusWallets: [],
}

test('a ready view is read inside the account grant', async () => {
  const { ctx, calls, grants } = context({ view: ready })
  const read = makeBalanceReader(ctx, '1.2.3', { timeoutMs: 50 })
  assert.deepEqual(await read(), ready)
  assert.deepEqual(grants, ['account/watch'], 'the read must run inside the account access grant')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].version, '1.2.3', 'the build stamps its own version when the shell inlines none')
  assert.equal(typeof calls[0].locale, 'string')
  assert.equal(typeof calls[0].timezoneOffsetSeconds, 'number')
})

test('a refused grant reads nothing and does not throw', async () => {
  const { ctx } = context({ view: ready, refuse: true })
  assert.equal(await makeBalanceReader(ctx, '1.2.3', { timeoutMs: 20 })(), undefined)
})

test('a grant that never arrives gives up instead of hanging', async () => {
  const { ctx } = context({ view: ready, refuse: true })
  const started = Date.now()
  assert.equal(await makeBalanceReader(ctx, '1.2.3', { timeoutMs: 20 })(), undefined)
  assert.ok(Date.now() - started < 2000, 'the read must settle on its own')
})

test('a failed Remote result reads nothing', async () => {
  const { ctx } = context({})
  assert.equal(await makeBalanceReader(ctx, '1.2.3', { timeoutMs: 20 })(), undefined)
})

test('a throwing Remote call reads nothing', async () => {
  const { ctx } = context({ view: ready, throwInCall: true })
  assert.equal(await makeBalanceReader(ctx, '1.2.3', { timeoutMs: 20 })(), undefined)
})

test('a failed balance status reads nothing', async () => {
  const { ctx } = context({ view: { status: 'failed' } })
  assert.equal(await makeBalanceReader(ctx, '1.2.3', { timeoutMs: 20 })(), undefined)
})

test('a Shell without the account services reads nothing', async () => {
  const { ctx, grants } = context({ view: ready, services: false })
  assert.equal(await makeBalanceReader(ctx, '1.2.3', { timeoutMs: 20 })(), undefined)
  assert.deepEqual(grants, [], 'no grant is even attempted without the services')
})

test('the client metadata carries the timezone as seconds east of UTC', () => {
  const metadata = clientMetadata('1.2.3')
  assert.equal(metadata.version, '1.2.3')
  assert.equal(metadata.timezoneOffsetSeconds, -new Date().getTimezoneOffset() * 60)
})
