/**
 * The balance read, driven without a Shell.
 *
 * `client/account.js` is inlined into the browser bundle, so these cases are the
 * ones the Shell runs: a ready view resolves to the balance view, and every
 * refusal — no account namespace, a refused call, a failed call, a throw, a call
 * that never settles — resolves to undefined instead of rejecting into React.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { accountService, clientMetadata, readBalance } from '../client/account.js'

const ready = {
  status: 'ready',
  value: [{ currency: 'USD', balance: '17.33' }],
  bonusWallets: [],
}

/**
 * A context whose account namespace behaves as told.
 * @param options - `view` the Remote returns, or a failure mode.
 * @returns the context, the recorded calls, and the namespace.
 */
function context({ view, throwInCall = false, services = true, hang = false } = {}) {
  const calls = []
  const account = {
    async getBalance(metadata) {
      calls.push(metadata)
      if (hang) await new Promise(() => {})
      if (throwInCall) throw new Error('account balance failed')
      return view === undefined ? { ok: false } : { ok: true, value: view }
    },
  }
  const remote = { account }
  const ctx = {
    remote: services ? remote : undefined,
    get(name) {
      if (!services) return undefined
      return name === 'remote' ? remote : undefined
    },
  }
  return { ctx, calls, account }
}

test('a ready view resolves through the account Remote namespace', async () => {
  const { ctx, calls } = context({ view: ready })
  assert.deepEqual(await readBalance(ctx, '1.2.3', { timeoutMs: 50 }), ready)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].version, '1.2.3', 'the build stamps its own version when the shell inlines none')
  assert.equal(typeof calls[0].locale, 'string')
  assert.equal(typeof calls[0].timezoneOffsetSeconds, 'number')
})

test('a refused call reads nothing and does not throw', async () => {
  const { ctx } = context({})
  assert.equal(await readBalance(ctx, '1.2.3', { timeoutMs: 20 }), undefined)
})

test('a call that never settles gives up instead of hanging', async () => {
  const { ctx } = context({ view: ready, hang: true })
  const started = Date.now()
  assert.equal(await readBalance(ctx, '1.2.3', { timeoutMs: 30 }), undefined)
  assert.ok(Date.now() - started < 2000, 'the read must settle on its own')
})

test('a throwing Remote call reads nothing', async () => {
  const { ctx } = context({ view: ready, throwInCall: true })
  assert.equal(await readBalance(ctx, '1.2.3', { timeoutMs: 20 }), undefined)
})

test('a failed balance status reads nothing', async () => {
  const { ctx } = context({ view: { status: 'failed' } })
  assert.equal(await readBalance(ctx, '1.2.3', { timeoutMs: 20 }), undefined)
})

test('a Shell without an account namespace reads nothing and says so', async () => {
  const { ctx, calls } = context({ view: ready, services: false })
  assert.equal(accountService(ctx), undefined)
  assert.equal(await readBalance(ctx, '1.2.3', { timeoutMs: 20 }), undefined)
  assert.equal(calls.length, 0, 'no call is attempted without the namespace')
})

test('the namespace is found through ctx.remote even when ctx.get is absent', async () => {
  const { ctx, account } = context({ view: ready })
  const bare = { remote: { account } }
  assert.equal(accountService(bare), ctx.remote.account)
})

test('the client metadata carries the timezone as seconds east of UTC', () => {
  const metadata = clientMetadata('1.2.3')
  assert.equal(metadata.version, '1.2.3')
  assert.equal(metadata.timezoneOffsetSeconds, -new Date().getTimezoneOffset() * 60)
})
