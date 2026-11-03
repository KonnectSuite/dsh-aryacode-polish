/**
 * The row configurations Arya Claude mounts.
 *
 * Two different rule sets meet here:
 *
 *   - the **engine row** is `compaction-basic`'s closed configuration and may
 *     contain only its documented keys;
 *   - the **policy row** carries this preset's own knobs because the engine's
 *     closed set cannot hold them.
 *
 * The engine row's two threshold numbers are fixed on purpose. Claude Code prices
 * its trigger as `usable window − 13k`, where the usable window is the model
 * window minus the reserved output. `compaction-basic` derives the same number as
 * `min(window × thresholdRatio, window − reserved − headroomTokens)`, so a
 * threshold ratio near 1 with a 13k headroom reproduces Claude Code's late
 * trigger on the same window. The remaining knobs still follow the shared
 * Settings group, so the retenion tail, checkpoint budget, retries and summarizer
 * route stay editable.
 *
 * @module dsh-aryacode-polish-arya-claude-settings
 */
import {
  engineConfig as standardEngineConfig,
  policyConfig as standardPolicyConfig,
  readSettings,
} from '../arya-standard/settings.js'
import { ARYA_CLAUDE_POLICY_DEFAULTS } from './policy.js'

export { readSettings }

/**
 * The window fraction the Claude preset pins. High enough that the absolute
 * clause below (`window − reserved − headroom`) is the one that binds, which is
 * what Claude Code's arithmetic does.
 * @type {number}
 */
export const CLAUDE_THRESHOLD_RATIO = 0.99

/**
 * Tokens held back below the usable window. Claude Code's trigger buffer is
 * 13,000 tokens below `window − min(maxOutput, 20k)`; the base engine subtracts
 * the routed output reservation itself, so this is the extra buffer.
 * @type {number}
 */
export const CLAUDE_HEADROOM_TOKENS = 13000

/**
 * The pruner row configuration: how much of a single oversized tool result is kept
 * verbatim before its middle is trimmed.
 * @type {Readonly<{ thresholdChars: number, headChars: number, tailChars: number }>}
 */
export const CLAUDE_PRUNER_CONFIG = Object.freeze({
  thresholdChars: 8192,
  headChars: 4096,
  tailChars: 1024,
})

/**
 * The engine row configuration.
 *
 * `compaction-basic` rejects a key outside its own closed set, so this is
 * Arya Standard's engine configuration with the two threshold values replaced.
 * A user who wants to tune them can mount Arya Standard instead; the Claude
 * preset's identity is that arithmetic.
 *
 * @param {{ [key: string]: boolean | number | string }} settings validated settings.
 * @returns {Record<string, number | boolean | string>} the engine row configuration.
 */
export function engineConfig(settings) {
  return {
    ...standardEngineConfig(settings),
    thresholdRatio: CLAUDE_THRESHOLD_RATIO,
    headroomTokens: CLAUDE_HEADROOM_TOKENS,
  }
}

/**
 * The policy row configuration.
 *
 * The shared Settings group still supplies the overflow and summary retry counts
 * and a checkpoint-instruction override, because those are preferences rather
 * than Claude Code behaviour. Everything that defines the Claude pipeline is
 * pinned: no extra post-turn/pre-warm triggers (the base engine's step-boundary
 * check is the trigger), no verbatim user appendix (the checkpoint prompt writes
 * section 6), and Claude Code's three overflow drops.
 *
 * @param {{ [key: string]: boolean | number | string }} settings validated settings.
 * @returns {Record<string, number | string>} the policy row configuration.
 */
export function policyConfig(settings) {
  const base = standardPolicyConfig(settings)
  const defaults = ARYA_CLAUDE_POLICY_DEFAULTS
  return {
    ...base,
    keepUserTokens: defaults.keepUserTokens,
    postTurnThresholdPercent: defaults.postTurnThresholdPercent,
    preemptivePercent: defaults.preemptivePercent,
    minFreedTokens: defaults.minFreedTokens,
    autoCompactScope: defaults.autoCompactScope,
    autoCompactTokenLimit: defaults.autoCompactTokenLimit,
    dropOldestRetries: defaults.dropOldestRetries,
    autoCompactFailureLimit: defaults.autoCompactFailureLimit,
    keepRecentToolResults: defaults.keepRecentToolResults,
    minMicroCompactTokens: defaults.minMicroCompactTokens,
    recentFileLimit: defaults.recentFileLimit,
  }
}

/**
 * The pruner row configuration.
 * @returns {Record<string, number>} the pruner row configuration.
 */
export function prunerConfig() {
  return { ...CLAUDE_PRUNER_CONFIG }
}
