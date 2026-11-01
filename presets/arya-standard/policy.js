/**
 * Arya Standard's Codex-only compaction policy.
 *
 * The engine row cannot carry these knobs. `compaction-basic` validates its
 * configuration against a closed key set (`BasicCompactionConfig`) and throws on
 * anything outside it, so a key such as `keepUserTokens` on the engine row would
 * fail the mount instead of reaching the summarizer. Arya Standard therefore
 * mounts this small row beside the engine and publishes the validated values as
 * the `aryaStandardPolicy` service. The engine reads that service with
 * `ctx.get(name, false)` and falls back to these defaults when the row is absent,
 * so a composition without it keeps the base engine's behaviour rather than
 * failing to load.
 *
 * @module dsh-aryacode-polish-arya-standard-policy
 */

/** The service name the engine reads. */
export const ARYA_STANDARD_POLICY_SERVICE = 'aryaStandardPolicy'

/**
 * Declared defaults, matching the Settings page descriptors in `fields.js`.
 * @type {Readonly<Record<string, number | string>>}
 */
export const ARYA_STANDARD_POLICY_DEFAULTS = Object.freeze({
  keepUserTokens: 20000,
  postTurnThresholdPercent: 90,
  autoCompactTokenLimit: 0,
  compactPromptOverride: '',
  dropOldestRetries: 2,
})

/** Upper bound for a token budget, so a hand-edited row cannot ask for gigabytes. */
const MAX_TOKENS = 2000000

/**
 * Clamp one numeric knob.
 * @param {unknown} value the raw value.
 * @param {number} fallback the declared default.
 * @param {number} min inclusive lower bound.
 * @param {number} max inclusive upper bound.
 * @returns {number} a whole number inside the bounds.
 */
function clampInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/**
 * Validate a raw policy group.
 *
 * A hand-edited `cordis.yml` can carry anything; everything is clamped rather
 * than rejected, because a bad knob must not stop a session from compacting.
 *
 * @param {unknown} raw the row configuration.
 * @returns {Readonly<{ keepUserTokens: number, postTurnThresholdPercent: number, autoCompactTokenLimit: number, compactPromptOverride: string, dropOldestRetries: number }>}
 *   the validated policy.
 */
export function resolvePolicy(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const defaults = ARYA_STANDARD_POLICY_DEFAULTS
  return Object.freeze({
    keepUserTokens: clampInteger(source.keepUserTokens, defaults.keepUserTokens, 0, MAX_TOKENS),
    postTurnThresholdPercent: clampInteger(source.postTurnThresholdPercent, defaults.postTurnThresholdPercent, 0, 100),
    autoCompactTokenLimit: clampInteger(source.autoCompactTokenLimit, defaults.autoCompactTokenLimit, 0, MAX_TOKENS),
    compactPromptOverride: typeof source.compactPromptOverride === 'string' ? source.compactPromptOverride.trim() : '',
    dropOldestRetries: clampInteger(source.dropOldestRetries, defaults.dropOldestRetries, 0, 5),
  })
}

/** The policy a composition without the policy row runs on. */
export const ARYA_STANDARD_POLICY_FALLBACK = resolvePolicy(undefined)

/**
 * Read the policy service, falling back to the defaults.
 *
 * Called from the summarizer and from the trigger registration, both of which may
 * run in a host (or a test stub) that never mounted the policy row.
 *
 * @param {object | undefined} ctx the engine's context.
 * @returns {ReturnType<typeof resolvePolicy>} the policy in force.
 */
export function readPolicy(ctx) {
  try {
    if (typeof ctx?.get !== 'function') return ARYA_STANDARD_POLICY_FALLBACK
    const value = ctx.get(ARYA_STANDARD_POLICY_SERVICE, false)
    if (value === null || typeof value !== 'object' || typeof value.keepUserTokens !== 'number') {
      return ARYA_STANDARD_POLICY_FALLBACK
    }
    return value
  } catch {
    return ARYA_STANDARD_POLICY_FALLBACK
  }
}

/**
 * Resolve the token level at which a finished turn should be compacted.
 *
 * This is Codex's `model_post_turn_compact_threshold_percent` and
 * `model_auto_compact_token_limit` together: a share of the window, capped by an
 * absolute limit when one is set. Zero means the trigger is off.
 *
 * @param {{ totalTokens?: number, contextWindow?: number } | undefined} measurement
 *   the token meter's reading for the session.
 * @param {ReturnType<typeof resolvePolicy>} policy the policy in force.
 * @returns {number} the token level, or 0 when this trigger is disabled.
 */
export function postTurnThresholdTokens(measurement, policy) {
  const window = Number(measurement?.contextWindow)
  const absolute = policy.autoCompactTokenLimit > 0 ? policy.autoCompactTokenLimit : Number.POSITIVE_INFINITY
  if (policy.postTurnThresholdPercent <= 0) return absolute === Number.POSITIVE_INFINITY ? 0 : absolute
  if (!Number.isFinite(window) || window <= 0) return absolute === Number.POSITIVE_INFINITY ? 0 : absolute
  return Math.min(Math.floor(window * (policy.postTurnThresholdPercent / 100)), absolute)
}

/**
 * The row plugin. `ctx.provide` owns the registration, so unmounting the preset
 * removes the service with it.
 */
export default {
  name: 'arya-standard-policy',
  /**
   * Publish the validated policy for the engine row beside this one.
   * @param {object} ctx the row's cordis context.
   * @param {unknown} config the row configuration.
   * @returns {void} nothing.
   */
  apply(ctx, config) {
    ctx.provide(ARYA_STANDARD_POLICY_SERVICE, resolvePolicy(config))
  },
}
