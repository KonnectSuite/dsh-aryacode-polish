/**
 * Reading the account balance from a plugin face.
 *
 * The account Remote methods are gated, so the read runs inside a
 * `remoteAccess.whenAccess('account/watch', …)` grant and the grant is released
 * as soon as the read settles. Every failure — no service in this Shell, a
 * refused grant, a failed call — resolves to `undefined` instead of throwing: a
 * sidebar line is never worth breaking the shell over, and a line that stays
 * empty is honest about a number it never received.
 *
 * This module is inlined into `lib/client.js` by `scripts/build-client.mjs` and
 * imported directly by `test/account.spec.mjs`, so the tested source is the one
 * the browser runs.
 */

/**
 * Build the account request identity for one balance read.
 *
 * The shipped account bundle inlines `DSH_CLIENT_VERSION` at build time; a plugin
 * bundle has no such define, so the build stamps this package's own version and
 * prefers the shell's value when one is inlined.
 *
 * @param version - the version this build stamps.
 * @returns the metadata the account Remote methods carry.
 */
export function clientMetadata(version) {
  const stamped = typeof process !== 'undefined' && process.env !== undefined ? process.env.DSH_CLIENT_VERSION : undefined
  return {
    version: typeof stamped === 'string' && stamped !== '' ? stamped : version,
    locale: typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language !== ''
      ? navigator.language
      : 'en',
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
}

/**
 * Build the one-shot balance reader.
 *
 * @param ctx - the browser plugin context; `ctx.get` resolves an optional service.
 * @param version - the version this build stamps into the account metadata.
 * @returns a reader that resolves to the balance view, or undefined when unavailable.
 */
export function makeBalanceReader(ctx, version, { timeoutMs = 10000 } = {}) {
  const service = name => {
    try {
      return ctx.get(name)
    } catch {
      return undefined
    }
  }
  return async () => {
    const access = service('remoteAccess')
    const remote = service('remote')
    if (access === undefined || remote === undefined) return undefined
    const metadata = clientMetadata(version)
    return await new Promise(resolve => {
      let settled = false
      let stop
      const timer = setTimeout(() => finish(undefined), timeoutMs)
      const finish = value => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
        if (typeof stop === 'function') {
          try {
            stop()
          } catch {
            /* the grant may already have been released */
          }
        }
      }
      // The read starts before the yield so an effect runner that stops at the
      // first yielded disposer still performs the call.
      stop = access.whenAccess('account/watch', function* () {
        void (async () => {
          try {
            const result = await remote.account.getBalance(metadata)
            const value = result !== undefined && result.ok === true ? result.value : undefined
            finish(value !== undefined && value.status === 'ready' ? value : undefined)
          } catch {
            finish(undefined)
          }
        })()
        yield () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            resolve(undefined)
          }
        }
      })
    })
  }
}
