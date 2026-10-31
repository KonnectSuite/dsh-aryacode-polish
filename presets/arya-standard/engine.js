/**
 * The engine row the Arya Standard preset mounts.
 *
 * A preset row is loaded like any other bundle entry, so this module's default
 * export is the compaction service itself: DSH's base engine with Codex's summary
 * hung on the documented `summarize()` hook. Importing the real base class here —
 * rather than in `compaction.js` — keeps that file pure, so the summary logic is
 * testable without a Host.
 *
 * `@deepseek-ai/dsh-llm` supplies `BlockAssembler`, `LlmError` and
 * `contentHasImage`; reusing them means chunk assembly, finish classification and
 * image refusal behave exactly as the base engine does.
 *
 * The base engine's pre-step hook swallows a compaction error and only warns on the
 * Host logger, so a policy the engine rejects (a headroom larger than the pressure
 * budget, say) turns automatic compaction off without saying so anywhere the desktop
 * build shows. With `ARYA_STANDARD_DEBUG=1`, `compactIfNeeded` reports what it
 * measured, what the engine answered, and the error it would otherwise hide.
 *
 * @module dsh-aryacode-polish-arya-standard
 */
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import { BlockAssembler, LlmError, contentHasImage } from '@deepseek-ai/dsh-llm'
import { deepFreeze } from '@deepseek-ai/dsh-util-values'
import { codexCheckpointPrompt, codexSummaryPrefix } from './files.js'
import { createAryaStandardCompaction } from './compaction.js'

export { createAryaStandardCompaction }

/** Whether the diagnostic channel is on. */
const DEBUG = typeof process === 'object' && process !== null
  && process.env !== undefined && process.env.ARYA_STANDARD_DEBUG === '1'

/**
 * Report one compaction decision on stderr when the diagnostic channel is on.
 * @param {string} message the line to write.
 * @returns {void} nothing.
 */
function report(message) {
  if (DEBUG) process.stderr.write(`[arya-standard] ${message}\n`)
}

/** The base engine with one observable seam over `compactIfNeeded`. */
class ObservableCompactionEngine extends BasicCompactionEngine {
  /**
   * Measure, delegate, and say what happened — including the error the base
   * engine's pre-step hook would otherwise swallow.
   * @param {object} agent the agent asking to compact.
   * @param {string} trigger which trigger fired.
   * @param {AbortSignal} signal the turn's signal.
   * @returns {Promise<object | null>} the compaction result, if any.
   */
  /**
   * Say that the automatic hook was registered, so a missing registration and a
   * missing call stay distinguishable.
   * @returns {void} nothing.
   */
  _registerAutomaticCompaction() {
    report('registerAutomaticCompaction')
    return super._registerAutomaticCompaction()
  }

  /**
   * Report the manual path too, which is served by the command row.
   * @param {object} agent the agent asking to compact.
   * @param {AbortSignal} signal the command's signal.
   * @param {string} sourceCommandId the command that asked.
   * @returns {Promise<object | null>} the compaction result.
   */
  async compactNow(agent, signal, sourceCommandId) {
    report(`compactNow source=${sourceCommandId ?? '-'}`)
    return super.compactNow(agent, signal, sourceCommandId)
  }

  async compactIfNeeded(agent, trigger, signal) {
    if (DEBUG) {
      try {
        const measured = this.ctx.tokenMeter.measure(agent.session)
        report(`compactIfNeeded trigger=${trigger} total=${measured.totalTokens} window=${measured.contextWindow}`)
      } catch (error) {
        report(`measure failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    try {
      const result = await super.compactIfNeeded(agent, trigger, signal)
      if (DEBUG) report(`compactIfNeeded trigger=${trigger} result=${result === null ? 'null' : 'compacted'}`)
      return result
    } catch (error) {
      report(`compactIfNeeded trigger=${trigger} error=${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
}

export default createAryaStandardCompaction(ObservableCompactionEngine, {
  BlockAssembler,
  LlmError,
  contentHasImage,
  deepFreeze,
  checkpointPrompt: codexCheckpointPrompt(),
  summaryPrefix: codexSummaryPrefix(),
})
