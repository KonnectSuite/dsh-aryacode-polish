/**
 * Arya Standard's post-turn trigger.
 *
 * The base engine compacts before a step and on provider overflow. Codex also
 * compacts once a finished turn leaves the session above a share of the window or
 * above an absolute token limit, so this preset adds that third trigger on the
 * idle transition. These tests drive the registration directly: a real Host is not
 * needed to see when the trigger fires and when it stays quiet.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ObservableCompactionEngine } from '../presets/arya-standard/engine.js'
import { postTurnThresholdTokens, resolvePolicy } from '../presets/arya-standard/policy.js'

const WINDOW = 1_000_000

/**
 * Build an engine whose context records listeners and serves a token reading.
 * @param {{ totalTokens?: number, contextWindow?: number, policy?: object }} state
 *   the token reading and the policy the service returns.
 * @returns {{ engine: object, listeners: Map<string, Function[]>, compactions: object[] }} the harness.
 */
function harness(state = {}) {
  const listeners = new Map()
  const compactions = []
  const measurement = {
    totalTokens: state.totalTokens ?? 0,
    contextWindow: state.contextWindow ?? WINDOW,
  }
  const ctx = {
    on(name, listener) {
      const list = listeners.get(name) ?? []
      list.push(listener)
      listeners.set(name, list)
      return () => {}
    },
    get(name) {
      return name === 'aryaStandardPolicy' ? (state.policy ?? resolvePolicy(undefined)) : undefined
    },
    logger: { info() {}, warn() {}, debug() {}, error() {} },
    tokenMeter: { measure: () => measurement },
  }
  // `compaction-basic` extends cordis's Service, so a real construction needs a
  // live context. The trigger only touches `this.ctx` and `this.compactNow`, so it
  // runs against this stand-in with the prototype's own method.
  const engine = {
    ctx,
    compactNow: async (agent, signal, sourceCommandId) => {
      compactions.push({ agent, signal, sourceCommandId })
      return null
    },
    _compactAfterTurn: ObservableCompactionEngine.prototype._compactAfterTurn,
    _scopedPressure: ObservableCompactionEngine.prototype._scopedPressure,
  }
  return { engine, listeners, compactions }
}

/** Run one idle transition and let the fire-and-forget trigger settle. */
async function idle(harnessed, agent = { session: {} }) {
  ObservableCompactionEngine.prototype._registerAryaStandardTriggers.call(harnessed.engine)
  const listener = harnessed.listeners.get('agent/status')?.[0]
  assert.equal(typeof listener, 'function', 'the idle listener must be registered')
  listener({ agent, status: 'idle' })
  await new Promise((resolve) => setImmediate(resolve))
  return agent
}

test('a synchronous trigger is registered ahead of the first idle transition', () => {
  const harnessed = harness({ totalTokens: WINDOW * 0.95 })
  ObservableCompactionEngine.prototype._registerAryaStandardTriggers.call(harnessed.engine)
  assert.equal(harnessed.listeners.get('agent/status').length, 1)
  assert.equal(harnessed.listeners.has('agent/disposed'), false, 'the abort hook is only wired once a compaction starts')
})

test('a turn that leaves the session at the threshold compacts once', async () => {
  const harnessed = harness({ totalTokens: WINDOW * 0.9 })
  const agent = await idle(harnessed)
  assert.equal(harnessed.compactions.length, 1)
  assert.equal(harnessed.compactions[0].agent, agent)
  assert.ok(harnessed.compactions[0].signal instanceof AbortSignal)
  assert.equal(harnessed.compactions[0].sourceCommandId, undefined, 'a post-turn compaction is not a manual one')
})

test('a turn below the threshold leaves the session alone', async () => {
  const harnessed = harness({ totalTokens: WINDOW * 0.5 })
  await idle(harnessed)
  assert.equal(harnessed.compactions.length, 0)
})

test('the absolute token limit wins when it is the smaller of the two', async () => {
  const harnessed = harness({ totalTokens: 120_000, policy: resolvePolicy({ autoCompactTokenLimit: 100_000 }) })
  await idle(harnessed)
  assert.equal(harnessed.compactions.length, 1, '100k is below the 90% share, so the limit decides')
})

test('both knobs at zero leave the trigger unregistered', () => {
  const harnessed = harness({
    policy: resolvePolicy({ postTurnThresholdPercent: 0, preemptivePercent: 0, autoCompactTokenLimit: 0 }),
  })
  ObservableCompactionEngine.prototype._registerAryaStandardTriggers.call(harnessed.engine)
  assert.equal(harnessed.listeners.get('agent/status'), undefined)
})

test('a busy or failing maintenance path never reaches the loop', async () => {
  const harnessed = harness({ totalTokens: WINDOW })
  harnessed.engine.compactNow = async () => {
    throw new Error('manual compaction requires an idle agent')
  }
  await idle(harnessed)
  // Reaching here means the rejection was contained rather than escaping the
  // fire-and-forget trigger.
  assert.equal(harnessed.listeners.get('agent/status').length, 1)
})

test('postTurnThresholdTokens combines the share with the absolute limit', () => {
  const shareOnly = resolvePolicy({ postTurnThresholdPercent: 90 })
  assert.equal(postTurnThresholdTokens({ totalTokens: 1, contextWindow: WINDOW }, shareOnly), 900_000)

  const limited = resolvePolicy({ postTurnThresholdPercent: 90, autoCompactTokenLimit: 250_000 })
  assert.equal(postTurnThresholdTokens({ totalTokens: 1, contextWindow: WINDOW }, limited), 250_000)

  const shareOff = resolvePolicy({ postTurnThresholdPercent: 0, autoCompactTokenLimit: 250_000 })
  assert.equal(postTurnThresholdTokens({ totalTokens: 1, contextWindow: WINDOW }, shareOff), 250_000)

  const off = resolvePolicy({ postTurnThresholdPercent: 0, autoCompactTokenLimit: 0 })
  assert.equal(postTurnThresholdTokens({ totalTokens: 1, contextWindow: WINDOW }, off), 0)

  assert.equal(postTurnThresholdTokens(undefined, shareOnly), 0, 'no reading means no trigger')
})
