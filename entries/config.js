/**
 * Resolve one value from a plugin row's config.
 *
 * A field marked `.volatile()` in the `Config` schema arrives as a live
 * reference ({ get() }) rather than as the value itself: schemastery wraps it
 * with `createVolatile`, so `config.spellcheck` is the reference, not `true`.
 * Reading the value directly made every switch look off to `apply()` — the row
 * switched its feature off however the settings page was set.
 *
 * Keep this tolerance in one place so every feature resolves its switch the same
 * way, and so a plain value (tests, older hosts) still works.
 *
 * @module dsh-aryacode-polish-config
 */

/**
 * Read a config field that may be a volatile reference.
 *
 * @param input - the raw field, a reference, or undefined.
 * @param fallback - value to use when the field is absent.
 * @returns the current value, or the fallback.
 */
export function resolve(input, fallback) {
  const current = input && typeof input.get === 'function' ? input.get() : input
  return current === undefined ? fallback : current
}

/**
 * Read a boolean switch.
 *
 * @param input - the raw field, a reference, or undefined.
 * @param fallback - value to use when the field is absent or not a boolean.
 * @returns the boolean value.
 */
export function flag(input, fallback = false) {
  const current = resolve(input, fallback)
  return typeof current === 'boolean' ? current : fallback
}

/**
 * Read a string-list field.
 *
 * @param input - the raw field, a reference, or undefined.
 * @returns the list, or an empty list.
 */
export function list(input) {
  const current = resolve(input, [])
  return Array.isArray(current) ? current : []
}

/**
 * Read a string field.
 *
 * @param input - the raw field, a reference, or undefined.
 * @param fallback - value to use when the field is absent or not a string.
 * @returns the string value.
 */
export function text(input, fallback = '') {
  const current = resolve(input, fallback)
  return typeof current === 'string' ? current : fallback
}
