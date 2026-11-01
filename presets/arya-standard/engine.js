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
import { BlockAssembler, CONTEXT_WINDOW_EXCEEDED_CODE, LlmError, contentHasImage } from '@deepseek-ai/dsh-llm'
import { deepFreeze } from '@deepseek-ai/dsh-util-values'
import { codexCheckpointPrompt, codexSummaryPrefix } from './files.js'
import { createAryaStandardCompaction } from './compaction.js'
import { postTurnThresholdTokens, readPolicy } from './policy.js'

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

/**
 * The base engine with the observable seams and this preset's own triggers.
 *
 * Exported so the trigger registration can be driven without a Host; the preset
 * row mounts the subclass produced at the bottom of this module.
 */
export class ObservableCompactionEngine extends BasicCompactionEngine {
  /**
   * Register the base engine's automatic hooks, then this preset's post-turn
   * trigger. The base still decides whether automatic compaction runs at all.
   * @returns {void} nothing.
   */
  _registerAutomaticCompaction() {
    report('registerAutomaticCompaction')
    super._registerAutomaticCompaction()
    this._registerAryaStandardTriggers()
  }

  /**
   * Compact once a finished turn leaves the session above Codex's post-turn
   * threshold.
   *
   * Codex compacts after a turn, at a share of the window or an absolute token
   * limit, whichever is lower. The base engine only compacts before a step and on
   * provider overflow, so this listens for the idle transition and calls
   * `compactNow`, the base's idle-reserving maintenance path. A compaction failure
   * here is a missed optimisation, never a failed session, so nothing is thrown
   * into the loop.
   * @returns {void} nothing.
   */
  _registerAryaStandardTriggers() {
    const policy = readPolicy(this.ctx)
    if (policy.postTurnThresholdPercent <= 0 && policy.autoCompactTokenLimit <= 0) return
    const inFlight = new WeakSet()
    this.ctx.on('agent/status', ({ agent, status }) => {
      if (status !== 'idle' || inFlight.has(agent)) return
      inFlight.add(agent)
      this._compactAfterTurn(agent, inFlight).catch(() => {})
    })
  }

  /**
   * Measure a now-idle session and compact it when it is over the threshold.
   * @param {object} agent the idle agent.
   * @param {WeakSet<object>} inFlight agents whose trigger is already running.
   * @returns {Promise<void>} resolves once the attempt settled.
   */
  async _compactAfterTurn(agent, inFlight) {
    const controller = new AbortController()
    let dispose
    try {
      const policy = readPolicy(this.ctx)
      const measured = this.ctx.tokenMeter.measure(agent.session)
      const threshold = postTurnThresholdTokens(measured, policy)
      if (threshold <= 0 || !(Number(measured?.totalTokens) >= threshold)) return
      report(`post-turn compaction total=${measured.totalTokens} threshold=${threshold}`)
      dispose = this.ctx.on('agent/disposed', ({ agent: disposed }) => {
        if (disposed === agent) controller.abort()
      })
      await this.compactNow(agent, controller.signal, undefined)
    } catch (error) {
      report(`post-turn compaction skipped: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      if (typeof dispose === 'function') dispose()
      inFlight.delete(agent)
    }
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
  contextWindowExceededCode: CONTEXT_WINDOW_EXCEEDED_CODE,
})
