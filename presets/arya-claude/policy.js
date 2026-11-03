/**
 * Arya Claude's compaction policy.
 *
 * The engine row cannot carry these knobs: `compaction-basic` validates its
 * configuration against a closed key set and throws on anything outside it. The
 * preset therefore mounts this row beside the engine and publishes the validated
 * values as the `aryaClaudePolicy` service; the engine, the summarizer and the
 * microcompact pruner read it with `ctx.get(name, false)` and fall back to these
 * defaults when the row is absent.
 *
 * The defaults encode Claude Code's observed behaviour, not Arya Standard's:
 *
 *   - no post-turn or pre-warm trigger — Claude compacts at the step boundary
 *     before the request that needs the room, which is what the base engine's own
 *     pressure listener already does (`auto` on the engine row);
 *   - the user's messages are reproduced by the checkpoint prompt (`6. All User
 *     Messages`), so no verbatim appendix is budgeted (`keepUserTokens: 0`);
 *   - a summarizer overflow drops the oldest turn three times before it fails;
 *   - three consecutive automatic-compaction failures open a circuit breaker for
 *     the session instead of retrying on every later step;
 *   - old tool results are cleared (microcompact) rather than only trimmed.
 *
 * @module dsh-aryacode-polish-arya-claude-policy
 */

/** The service name the engine reads. */
export const ARYA_CLAUDE_POLICY_SERVICE = 'aryaClaudePolicy'

/** Upper bound for a token budget, so a hand-edited row cannot ask for gigabytes. */
const MAX_TOKENS = 2000000

/**
 * Declared defaults. The first eight keys mirror Arya Standard's policy shape so
 * the shared engine machinery can read either preset; the rest are Claude-only.
 * @type {Readonly<Record<string, number | string>>}
 */
export const ARYA_CLAUDE_POLICY_DEFAULTS = Object.freeze({
  keepUserTokens: 0,
  postTurnThresholdPercent: 0,
  preemptivePercent: 0,
  minFreedTokens: 0,
  autoCompactScope: 'thread',
  autoCompactTokenLimit: 0,
  compactPromptOverride: '',
  dropOldestRetries: 3,
  /** Consecutive automatic-compaction failures that open the circuit breaker. */
  autoCompactFailureLimit: 3,
  /** Tool results kept verbatim before the microcompact pass may clear older ones. */
  keepRecentToolResults: 12,
  /** Minimum new tokens a microcompact pass must free to be worth its log writes. */
  minMicroCompactTokens: 20000,
  /** Recently read files listed inside a checkpoint. */
  recentFileLimit: 5,
})

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
 * @returns {Readonly<Record<string, number | string>>} the validated policy.
 */
export function resolveClaudePolicy(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const defaults = ARYA_CLAUDE_POLICY_DEFAULTS
  return Object.freeze({
    keepUserTokens: clampInteger(source.keepUserTokens, defaults.keepUserTokens, 0, MAX_TOKENS),
    postTurnThresholdPercent: clampInteger(source.postTurnThresholdPercent, defaults.postTurnThresholdPercent, 0, 100),
    preemptivePercent: clampInteger(source.preemptivePercent, defaults.preemptivePercent, 0, 100),
    minFreedTokens: clampInteger(source.minFreedTokens, defaults.minFreedTokens, 0, MAX_TOKENS),
    autoCompactScope: source.autoCompactScope === 'turn' ? 'turn' : 'thread',
    autoCompactTokenLimit: clampInteger(source.autoCompactTokenLimit, defaults.autoCompactTokenLimit, 0, MAX_TOKENS),
    compactPromptOverride: typeof source.compactPromptOverride === 'string' ? source.compactPromptOverride.trim() : '',
    dropOldestRetries: clampInteger(source.dropOldestRetries, defaults.dropOldestRetries, 0, 5),
    autoCompactFailureLimit: clampInteger(source.autoCompactFailureLimit, defaults.autoCompactFailureLimit, 1, 10),
    keepRecentToolResults: clampInteger(source.keepRecentToolResults, defaults.keepRecentToolResults, 0, 100),
    minMicroCompactTokens: clampInteger(source.minMicroCompactTokens, defaults.minMicroCompactTokens, 0, MAX_TOKENS),
    recentFileLimit: clampInteger(source.recentFileLimit, defaults.recentFileLimit, 0, 20),
  })
}

/** The policy a composition without the policy row runs on. */
export const ARYA_CLAUDE_POLICY_FALLBACK = resolveClaudePolicy(undefined)

/**
 * Read the policy service, falling back to the defaults.
 *
 * Called from the summarizer, the engine and the pruner, any of which may run in
 * a host (or a test stub) that never mounted the policy row.
 *
 * @param {object | undefined} ctx the row's context.
 * @returns {ReturnType<typeof resolveClaudePolicy>} the policy in force.
 */
export function readClaudePolicy(ctx) {
  try {
    if (typeof ctx?.get !== 'function') return ARYA_CLAUDE_POLICY_FALLBACK
    const value = ctx.get(ARYA_CLAUDE_POLICY_SERVICE, false)
    if (value === null || typeof value !== 'object' || typeof value.autoCompactFailureLimit !== 'number') {
      return ARYA_CLAUDE_POLICY_FALLBACK
    }
    return value
  } catch {
    return ARYA_CLAUDE_POLICY_FALLBACK
  }
}

/**
 * The row plugin. `ctx.provide` owns the registration, so unmounting the preset
 * removes the service with it.
 */
export default {
  name: 'arya-claude-policy',
  /**
   * Publish the validated policy for the engine and pruner rows beside this one.
   * @param {object} ctx the row's cordis context.
   * @param {unknown} config the row configuration.
   * @returns {void} nothing.
   */
  apply(ctx, config) {
    ctx.provide(ARYA_CLAUDE_POLICY_SERVICE, resolveClaudePolicy(config))
  },
}
