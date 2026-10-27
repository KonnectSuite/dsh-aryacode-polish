/**
 * Reading the account balance from a plugin face.
 *
 * The account Remote methods are the same ones the shipped account row uses. An
 * earlier version waited for the host account bundle's own access grant before
 * reading, on the theory that the grant proves the call is allowed. It does not:
 * that grant belongs to the bundle that owns the account stream, and a plugin
 * that waits for it can wait forever — the sidebar line then stays empty with no
 * error anywhere, which is exactly what a user reports as "I don't see the
 * balance".
 *
 * So this reads directly. The Host still decides: an unauthorised call comes back
 * `{ ok: false }` (or throws) and this resolves to `undefined`. Every failure — no
 * account namespace in this Shell, a refused call, a failed call — resolves to
 * `undefined` instead of throwing, because a sidebar line is never worth breaking
 * the shell over.
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
 * The account Remote namespace, or undefined when this Shell has none.
 *
 * @param ctx - the browser plugin context; the balance surface is registered
 *   inside `ctx.inject(['remote', 'remote.account'], …)` so this normally resolves.
 * @returns the namespace, or undefined.
 */
export function accountService(ctx) {
  try {
    const remote = ctx.remote !== undefined ? ctx.remote : ctx.get('remote')
    const account = remote !== undefined && remote !== null ? remote.account : undefined
    return account !== undefined && account !== null && typeof account.getBalance === 'function' ? account : undefined
  } catch {
    return undefined
  }
}

/**
 * Read the balance once.
 *
 * @param ctx - the browser plugin context.
 * @param version - the version this build stamps into the account metadata.
 * @param options - `timeoutMs` bounds a call that never settles.
 * @returns the ready balance view, or undefined when there is no number to show.
 */
export async function readBalance(ctx, version, { timeoutMs = 15000 } = {}) {
  const account = accountService(ctx)
  if (account === undefined) return undefined
  const call = (async () => {
    const result = await account.getBalance(clientMetadata(version))
    if (result === undefined || result === null || result.ok !== true) return undefined
    const value = result.value
    return value !== undefined && value !== null && value.status === 'ready' ? value : undefined
  })().catch(() => undefined)
  let timer
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(undefined), timeoutMs)
    // A pending balance read must not keep a Node process alive during tests.
    if (typeof timer === 'object' && timer !== null && typeof timer.unref === 'function') timer.unref()
  })
  try {
    return await Promise.race([call, timeout])
  } finally {
    clearTimeout(timer)
  }
}
