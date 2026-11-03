/**
 * Arya Claude's model-free context compression: the tool-result pruner that also
 * clears old tool output.
 *
 * Claude Code compresses in two levels: before it pays for a summarization call it
 * clears the bodies of old tool results and keeps the most recent ones verbatim.
 * This harness has the same seam. `compaction-basic` calls `toolResultPruner`
 * *before* it selects a summary range, then re-measures:
 *
 *     if (prune !== undefined) {
 *       prune.pruneSession(agent.session)
 *       measurement = meter.measure(agent.session, header)
 *     }
 *     if (measurement.totalTokens < spec.thresholdTokens) return null
 *
 * so a prune pass that frees enough tokens means the context fits again and the
 * summarization is skipped entirely — the microcompact outcome Claude Code has.
 * The shipped pruner only trims the middle of oversized results; this one trims,
 * then clears whole old results when the pass frees at least
 * `minMicroCompactTokens` (Claude Code's 20k threshold), keeping the most recent
 * `keepRecentToolResults` (12) untouched.
 *
 * The class provides the same service (`ctx.toolResultPruner`) and the same
 * three methods the shipped pruner has, so the base engine needs no change.
 *
 * Every replacement follows the base pruner's replay protocol: a
 * `compaction/prune` shadow-price event prices the node being shadowed, then the
 * `tool/result` replacement is appended with a `replace` surface op and the
 * shadowed seq, so pure replay consumers can subtract the old price.
 *
 * @module dsh-aryacode-polish-arya-claude-pruner
 */
import { Service } from '@deepseek-ai/cordis'
import { freezeMessage } from '@deepseek-ai/dsh-llm'
import { readClaudePolicy } from './policy.js'

/** The middle marker the trim pass inserts. */
export const PRUNE_MARKER = '\n\n[... middle of tool output trimmed to save context ...]\n\n'

/** The body one cleared tool result keeps. */
export const CLEARED_TOOL_RESULT_TEXT = '[Earlier tool output cleared to save context]'

/**
 * Shipped defaults for the trim pass, matching the row configuration this preset
 * mounts so a composition that drops the config still behaves the same.
 * @type {Readonly<{ thresholdChars: number, headChars: number, tailChars: number }>}
 */
export const PRUNER_DEFAULTS = Object.freeze({ thresholdChars: 8192, headChars: 4096, tailChars: 1024 })

/** The minimum a microcompact pass may free (Claude Code's 20k threshold). */
export const DEFAULT_MIN_MICROCOMPACT_TOKENS = 20000

/** How many recent tool results are never cleared (Claude Code's 12). */
export const DEFAULT_KEEP_RECENT_TOOL_RESULTS = 12

/**
 * Clamp one integer knob.
 * @param {unknown} value the raw value.
 * @param {number} fallback the declared default.
 * @param {number} min inclusive lower bound.
 * @param {number} max inclusive upper bound.
 * @returns {number} the clamped whole number.
 */
function clampInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/**
 * Validate a raw pruner row configuration.
 * @param {unknown} raw the row configuration.
 * @returns {{ thresholdChars: number, headChars: number, tailChars: number }} the validated budgets.
 */
export function resolvePrunerConfig(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const defaults = PRUNER_DEFAULTS
  const thresholdChars = clampInteger(source.thresholdChars, defaults.thresholdChars, 1, 1000000)
  return {
    thresholdChars,
    headChars: clampInteger(source.headChars, defaults.headChars, 0, thresholdChars),
    tailChars: clampInteger(source.tailChars, defaults.tailChars, 0, thresholdChars),
  }
}

/**
 * Count Unicode code points (not UTF-16 code units).
 * @param {string} text the text to measure.
 * @returns {number} the code-point length.
 */
export function codePointLength(text) {
  return Array.from(String(text)).length
}

/**
 * Measure text content in code points; non-text blocks cost zero.
 * @param {ReadonlyArray<unknown>} blocks tool-result content.
 * @returns {number} total code points across text blocks.
 */
export function measureContent(blocks) {
  if (!Array.isArray(blocks)) return 0
  let chars = 0
  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') chars += codePointLength(block.text)
  }
  return chars
}

/**
 * Whether content carries a block that is not plain text (an image, a file, a
 * provider-specific block). Those results are never cleared: replacing them would
 * silently drop data the model can still need.
 * @param {ReadonlyArray<unknown>} blocks tool-result content.
 * @returns {boolean} true when a rich block is present.
 */
export function hasRichBlocks(blocks) {
  if (!Array.isArray(blocks)) return false
  return blocks.some((block) => block?.type !== 'text')
}

/**
 * Whether content is already the cleared placeholder.
 * @param {ReadonlyArray<unknown>} blocks tool-result content.
 * @returns {boolean} true when the result was already cleared.
 */
export function isClearedContent(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return false
  return blocks.every((block) => block?.type === 'text' && typeof block.text === 'string' && block.text === CLEARED_TOOL_RESULT_TEXT)
}

/**
 * Trim the middle of one oversized result, preserving its head, tail and order of
 * rich blocks. Returns null when the content is within budget.
 *
 * @param {ReadonlyArray<unknown>} blocks the original content.
 * @param {{ thresholdChars: number, headChars: number, tailChars: number }} config the budgets.
 * @returns {Array<object> | null} pruned content, or null.
 */
export function pruneContent(blocks, config) {
  if (!Array.isArray(blocks)) return null
  const totalChars = measureContent(blocks)
  if (totalChars <= config.thresholdChars) return null
  const removedStart = config.headChars
  const removedEnd = totalChars - config.tailChars
  const pruned = []
  let consumed = 0
  let markerInserted = false
  for (const block of blocks) {
    if (block?.type !== 'text' || typeof block.text !== 'string') {
      pruned.push(block)
      continue
    }
    const points = Array.from(block.text)
    const blockStart = consumed
    const blockEnd = blockStart + points.length
    const headEnd = Math.min(points.length, Math.max(0, removedStart - blockStart))
    const tailStart = Math.min(points.length, Math.max(0, removedEnd - blockStart))
    const intersectsRemoved = blockStart < removedEnd && blockEnd > removedStart
    const marker = intersectsRemoved && !markerInserted ? PRUNE_MARKER : ''
    if (marker.length > 0) markerInserted = true
    const text = points.slice(0, headEnd).join('') + marker + points.slice(tailStart).join('')
    if (text.length > 0) pruned.push({ ...block, text })
    consumed = blockEnd
  }
  if (!markerInserted) return null
  return pruned
}

/**
 * Decide which tool results a microcompact pass clears.
 *
 * Pure: entries are the whole tool-result surface in order, oldest first. The most
 * recent `keepRecent` entries are never cleared, already-cleared entries are
 * skipped, and a pass that would free less than `minTokens` clears nothing (the
 * model-free pass must pay for itself in freed context).
 *
 * @param {ReadonlyArray<{ seq: number, tokens: number, clearable: boolean, cleared: boolean }>} entries the surface.
 * @param {{ keepRecent?: number, minTokens?: number }} [options] the budgets.
 * @returns {{ clearSeqs: number[], savedTokens: number }} the plan.
 */
export function planMicrocompact(entries, options = {}) {
  const keepRecent = clampInteger(options.keepRecent, DEFAULT_KEEP_RECENT_TOOL_RESULTS, 0, 1000)
  const minTokens = clampInteger(options.minTokens, DEFAULT_MIN_MICROCOMPACT_TOKENS, 0, 2000000)
  if (!Array.isArray(entries) || entries.length === 0) return { clearSeqs: [], savedTokens: 0 }
  const cutoff = entries.length - keepRecent
  const candidates = []
  let savedTokens = 0
  for (let index = 0; index < entries.length; index += 1) {
    if (index >= cutoff) break
    const entry = entries[index]
    if (entry?.cleared === true || entry?.clearable !== true) continue
    const tokens = Number(entry.tokens)
    if (!Number.isFinite(tokens) || tokens <= 0) continue
    candidates.push(entry.seq)
    savedTokens += tokens
  }
  if (savedTokens < minTokens) return { clearSeqs: [], savedTokens: 0 }
  return { clearSeqs: candidates, savedTokens }
}

/**
 * The model-free compression service the preset mounts as `toolResultPruner`.
 */
export class AryaClaudeMicrocompactPruner extends Service {
  /** The token meter prices each shadowed node for its `compaction/prune` event. */
  static inject = ['tokenMeter']

  /**
   * @param {object} ctx the row's cordis context.
   * @param {unknown} [config] the row configuration.
   */
  constructor(ctx, config) {
    super(ctx, 'toolResultPruner')
    /** @type {{ thresholdChars: number, headChars: number, tailChars: number }} */
    this.config = resolvePrunerConfig(config)
  }

  /**
   * Measure text content in code points.
   * @param {ReadonlyArray<unknown>} blocks tool-result content.
   * @returns {number} the code-point length.
   */
  measureContent(blocks) {
    return measureContent(blocks)
  }

  /**
   * Trim one oversized result's middle.
   * @param {ReadonlyArray<unknown>} blocks the original content.
   * @returns {Array<object> | null} pruned content, or null.
   */
  pruneContent(blocks) {
    return pruneContent(blocks, this.config)
  }

  /**
   * Prune one stable current-surface snapshot: trim oversized results, then clear
   * old ones when the pass frees enough.
   *
   * @param {object} session the session whose surface is rewritten.
   * @returns {{ pruned: object[], charsRemoved: number, microcompact: { cleared: number, tokensSaved: number } }} the landed work.
   */
  pruneSession(session) {
    const pruned = []
    let charsRemoved = 0
    for (const { seq, event } of this.#snapshot(session)) {
      const original = session.deriveEventMessage(event)
      const content = pruneContent(original.content, this.config)
      if (content === null) continue
      const charsBefore = measureContent(original.content)
      const charsAfter = measureContent(content)
      this.#replace(session, seq, event, original, content)
      pruned.push(this.#entry(seq, original, charsBefore, charsAfter, session))
      charsRemoved += charsBefore - charsAfter
    }

    const policy = readClaudePolicy(this.ctx)
    const entries = []
    let microcompactChars = 0
    for (const { seq, event } of this.#snapshot(session)) {
      const message = session.deriveEventMessage(event)
      entries.push({
        seq,
        event,
        message,
        tokens: this.#price(message),
        clearable: !hasRichBlocks(message.content),
        cleared: isClearedContent(message.content),
      })
    }
    const plan = planMicrocompact(entries, {
      keepRecent: Number(policy?.keepRecentToolResults),
      minTokens: Number(policy?.minMicroCompactTokens),
    })
    const clearSet = new Set(plan.clearSeqs)
    for (const entry of entries) {
      if (!clearSet.has(entry.seq)) continue
      const charsBefore = measureContent(entry.message.content)
      const content = [{ type: 'text', text: CLEARED_TOOL_RESULT_TEXT }]
      this.#replace(session, entry.seq, entry.event, entry.message, content)
      const charsAfter = measureContent(content)
      pruned.push(this.#entry(entry.seq, entry.message, charsBefore, charsAfter, session))
      microcompactChars += charsBefore - charsAfter
    }
    return {
      pruned,
      charsRemoved: charsRemoved + microcompactChars,
      microcompact: { cleared: plan.clearSeqs.length, tokensSaved: plan.savedTokens },
    }
  }

  /**
   * Snapshot the current tool-result surface nodes.
   * @param {object} session the session.
   * @returns {Array<{ seq: number, event: object }>} surface tool results, oldest first.
   */
  #snapshot(session) {
    const nodes = []
    let seqs
    try {
      seqs = [...session.surface.nodes]
    } catch {
      return nodes
    }
    for (const seq of seqs) {
      let event
      try {
        event = session.eventAt(seq)
      } catch {
        continue
      }
      if (event?.type === 'tool/result') nodes.push({ seq, event })
    }
    return nodes
  }

  /**
   * Price one message through the injected token meter.
   * @param {object} message the derived message.
   * @returns {number} estimated tokens, or 0 when the meter cannot price it.
   */
  #price(message) {
    try {
      const value = Number(this.ctx.tokenMeter.estimateMessage(message))
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      return 0
    }
  }

  /**
   * Append the replacment pair: the shadow-price event, then the surface replacement.
   * @param {object} session the session.
   * @param {number} seq the sequencer of the node being shadowed.
   * @param {object} event the original `tool/result` event.
   * @param {object} original the derived original message.
   * @param {ReadonlyArray<object>} content the replacement content.
   * @returns {void} nothing.
   */
  #replace(session, seq, event, original, content) {
    const message = freezeMessage({ ...original, content })
    session.append('compaction/prune', {
      shadowedRange: { start: seq, end: seq },
      shadowedSeqs: [seq],
      shadowedTokenCount: this.#price(original),
    })
    session.append('tool/result', { ...event.data, message }, {
      surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq },
      sourceEventSeqs: [seq],
    })
  }

  /**
   * Build one `PrunedEntry` record.
   * @param {number} seq the shadowed sequencer.
   * @param {object} original the derived original message.
   * @param {number} charsBefore content length before the replacement.
   * @param {number} charsAfter content length after the replacement.
   * @param {object} session the session (for the replacement sequencer).
   * @returns {{ originalSeq: number, replacementSeq: number | null, callId: unknown, charsBefore: number, charsAfter: number }} the entry.
   */
  #entry(seq, original, charsBefore, charsAfter, session) {
    void session
    return {
      originalSeq: seq,
      replacementSeq: null,
      callId: original?.source?.callId,
      charsBefore,
      charsAfter,
    }
  }
}

export default AryaClaudeMicrocompactPruner
