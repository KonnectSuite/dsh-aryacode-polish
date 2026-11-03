/**
 * The engine row Arya Claude mounts.
 *
 * The trigger logic, retention maths and transaction work are Arya Standard's —
 * imported, not copied, so a fix reaches every preset. What differs is the kit and
 * one policy wrapper:
 *
 *   - an authored checkpoint instruction asking for an `<analysis>` scratchpad and
 *     a nine-section `<summary>` envelope, in Claude Code's shape;
 *   - a continuation frame before the body and a resume trailer after it;
 *   - a recently-read-files section derived from the replaced span, which is the
 *     pointer Claude Code's post-compact file restoration gives the next model;
 *   - a session-scoped circuit breaker: three consecutive automatic-compaction
 *     failures stop retrying until the session ends, as Claude Code does, instead
 *     of paying a failing summarization call on every later step.
 *
 * The policy comes from `aryaClaudePolicy`; the trigger thresholds are pinned in
 * `settings.js`, where the window arithmetic is explained.
 *
 * @module dsh-aryacode-polish-arya-claude
 */
import { BlockAssembler, CONTEXT_WINDOW_EXCEEDED_CODE, LlmError, contentHasImage } from '@deepseek-ai/dsh-llm'
import { deepFreeze } from '@deepseek-ai/dsh-util-values'
import { ObservableCompactionEngine } from '../arya-standard/engine.js'
import { createAryaStandardCompaction } from '../arya-standard/compaction.js'
import { claudeCheckpointPrompt, claudeSummaryPrefix, claudeSummarySuffix } from './files.js'
import { ARYA_CLAUDE_POLICY_SERVICE, readClaudePolicy } from './policy.js'
import { recentFilesSection } from './recent.js'

/** Whether the diagnostic channel is on. */
const DEBUG = typeof process === 'object' && process !== null
  && process.env !== undefined && process.env.ARYA_CLAUDE_DEBUG === '1'

/**
 * Report one engine decision on stderr when the diagnostic channel is on.
 * @param {string} message the line to write.
 * @returns {void} nothing.
 */
function report(message) {
  if (DEBUG) process.stderr.write(`[arya-claude] ${message}\n`)
}

/** Fallback number of recently read files when the policy is unavailable. */
const DEFAULT_RECENT_FILES = 5

/** Fallback number of consecutive failures before the breaker opens. */
const DEFAULT_FAILURE_LIMIT = 3

/**
 * The automatic-compaction circuit breaker, as a small testable unit.
 *
 * Claude Code stops *automatic* compaction for the rest of a session after three
 * consecutive failures instead of paying another failing summarization call on
 * every later step; manual compaction and provider-overflow recovery are not
 * gated by it. The unit is kept out of the class so its state machine can be
 * driven without a Host.
 *
 * @param {{ limit?: () => number }} [options] `limit` is read on every failure, so a
 *   policy change takes effect without a new breaker.
 * @returns {{
 *   isOpen: (agent: object) => boolean,
 *   failureCount: (agent: object) => number,
 *   reset: (agent: object) => void,
 *   run: (agent: object, task: () => Promise<object | null>) => Promise<object | null>,
 * }} the breaker.
 */
export function createAutoCompactBreaker(options = {}) {
  const readLimit = typeof options.limit === 'function' ? options.limit : () => DEFAULT_FAILURE_LIMIT
  /** @type {WeakMap<object, number>} */
  const failures = new WeakMap()
  /** @type {WeakSet<object>} */
  const open = new WeakSet()
  return {
    isOpen(agent) {
      return open.has(agent)
    },
    failureCount(agent) {
      return failures.get(agent) ?? 0
    },
    reset(agent) {
      failures.delete(agent)
      open.delete(agent)
    },
    async run(agent, task) {
      if (open.has(agent)) {
        report('automatic compaction skipped: circuit breaker is open for this session')
        return null
      }
      try {
        const result = await task()
        if (result !== null) failures.delete(agent)
        return result
      } catch (error) {
        const limit = Math.max(1, Math.round(Number(readLimit()) || DEFAULT_FAILURE_LIMIT))
        const count = (failures.get(agent) ?? 0) + 1
        failures.set(agent, count)
        if (count >= limit) {
          open.add(agent)
          report(`circuit breaker open after ${count} consecutive automatic-compaction failures`)
        } else {
          report(`automatic compaction failed (${count}/${limit})`)
        }
        throw error
      }
    },
  }
}

/**
 * The kit both the live row and the tests read, so its shape stays checkable.
 * @type {Readonly<Record<string, unknown>>}
 */
export const ARYA_CLAUDE_KIT = Object.freeze({
  BlockAssembler,
  LlmError,
  contentHasImage,
  deepFreeze,
  checkpointPrompt: claudeCheckpointPrompt(),
  summaryPrefix: claudeSummaryPrefix(),
  summarySuffix: claudeSummarySuffix(),
  // The drafting pass is for the model, not the transcript.
  stripAnalysis: true,
  // Keep the envelope's inner text when the model wraps its answer.
  envelope: /<summary>([\s\S]*?)<\/summary>/i,
  checkpointMarker: '<summary>',
  // The nine sections cannot be cut at the end without losing the next step; below
  // this much room the fold is skipped and the session keeps its history.
  minBodyTokens: 600,
  // Namespace the two observation waterfalls for this preset.
  hookPrefix: 'arya-claude',
  label: 'arya-claude',
  contextWindowExceededCode: CONTEXT_WINDOW_EXCEEDED_CODE,
  /**
   * Append the recently touched files to the checkpoint body.
   *
   * @param {{ messages: ReadonlyArray<unknown>, policy: object }} info the span being replaced.
   * @returns {string[]} zero or one section.
   */
  extraSections({ messages, policy }) {
    const limit = Number(policy?.recentFileLimit)
    const section = recentFilesSection(messages, Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_RECENT_FILES)
    return section.length > 0 ? [section] : []
  },
})

/** The Arya Standard engine pointed at this preset's policy service. */
export class AryaClaudeBaseEngine extends ObservableCompactionEngine {
  /**
   * The policy service this engine reads.
   * @returns {string} the service name.
   */
  get policyService() {
    return ARYA_CLAUDE_POLICY_SERVICE
  }
}

/** The factory output before the breaker wrapper: the summarize hook plus framing. */
const FramedClaudeEngine = createAryaStandardCompaction(AryaClaudeBaseEngine, ARYA_CLAUDE_KIT)

/**
 * The live row: the framed engine with Claude Code's automatic-compaction circuit
 * breaker on top.
 *
 * `compactIfNeeded` is the automatic entry point (the base's pre-step pressure
 * listener and its overflow recovery call it); `compactNow` is the manual
 * `/compact` path and is never gated. A failure of the pressure path counts toward
 * the breaker; three in a row (Claude Code's limit) stop further attempts for that
 * session. Overflow recovery still runs, because it answers a provider refusal
 * after the history was already too large to send.
 */
export class AryaClaudeCompactionEngine extends FramedClaudeEngine {
  /**
   * The breaker reads the policy's limit on every failure, so a settings change
   * takes effect without a new engine.
   * @type {ReturnType<typeof createAutoCompactBreaker>}
   */
  #breaker = createAutoCompactBreaker({ limit: () => this.#failureLimit() })

  /**
   * Consider automatic compaction, tripping the breaker after repeated failures.
   *
   * @param {object} agent the agent whose session is measured.
   * @param {'pressure' | 'context-overflow'} trigger the automatic trigger.
   * @param {AbortSignal} signal cancellation for this attempt.
   * @returns {Promise<object | null>} the compaction result, or null.
   */
  async compactIfNeeded(agent, trigger, signal) {
    // The breaker gates the automatic pressure path only: an overflow recovery
    // answers a provider refusal after the request was already too large, so the
    // session needs it even after a broken automatic path.
    if (trigger !== 'pressure') return super.compactIfNeeded(agent, trigger, signal)
    return this.#breaker.run(agent, () => super.compactIfNeeded(agent, trigger, signal))
  }

  /**
   * How many consecutive automatic-compaction failures this agent has had.
   * @param {object} agent the agent.
   * @returns {number} the count (0 when the breaker is closed and healthy).
   */
  autoCompactFailureCount(agent) {
    return this.#breaker.failureCount(agent)
  }

  /**
   * Whether automatic compaction is gated off for this agent.
   * @param {object} agent the agent.
   * @returns {boolean} true once the breaker has opened.
   */
  isAutoCompactBreakerOpen(agent) {
    return this.#breaker.isOpen(agent)
  }

  /**
   * Reset the breaker for one agent (the session keeps its history).
   * @param {object} agent the agent.
   * @returns {void} nothing.
   */
  resetAutoCompactBreaker(agent) {
    this.#breaker.reset(agent)
  }

  /**
   * Read the policy's failure limit without letting a missing row break the loop.
   * @returns {number} the limit, at least one.
   */
  #failureLimit() {
    const policy = readClaudePolicy(this.ctx)
    const limit = Number(policy?.autoCompactFailureLimit)
    return Number.isFinite(limit) && limit >= 1 ? limit : DEFAULT_FAILURE_LIMIT
  }
}

export default AryaClaudeCompactionEngine
