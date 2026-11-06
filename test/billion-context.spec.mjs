/**
 * The billion-context stand-down decision.
 *
 * These tests are the whole contract with an unpublished bili internal: the
 * gate service name, the process-global verdict, the two environment kill
 * switches, the attach variables, and the two waits. Every timing is injected,
 * so the table runs with a fake sleep and never actually waits 2.5 seconds.
 *
 * The decision is deliberately fail-open: anything unexpected (a thrown
 * `ctx.get`, a logger that throws, malformed options) resolves to `false` and
 * keeps the engine. A duplicate summarizer is recoverable; a silently missing
 * one is not.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  BILI_ATTACH_ENV,
  BILI_BUNDLE_NAME,
  BILI_GATE_SERVICE,
  BILI_KILL_ENV,
  BILI_REWRITES_ENV,
  BILI_STAND_DOWN_WARNING,
  BILI_TIMING,
  BILI_VERDICT_ACTIVE,
  BILI_VERDICT_GLOBAL,
  isBiliExpected,
  isBiliKillSwitched,
  isBiliVerdictActive,
  resolveStandDown,
} from '../presets/billion-context.js'

/** A profile whose startup bundles include billion-context. */
const BILI_PROFILE = { startedBundles: [BILI_BUNDLE_NAME], overlays: [] }

/** A profile with no bili signal. */
const STOCK_PROFILE = { startedBundles: ['@deepseek-ai/dsh-web-app'], overlays: [] }

/** A verdict scope that says bili owns the lane. */
const ACTIVE = { [BILI_VERDICT_GLOBAL]: BILI_VERDICT_ACTIVE }

/** A verdict scope that says nothing (the default before bili-native runs). */
const INACTIVE = {}

/**
 * Build a fake context. The gate function controls how many `get` calls pass
 * before the service appears, which is how the poll tests count ticks.
 * @param {{ profileContext?: unknown, gate?: () => boolean, getThrows?: boolean }} [options]
 * @returns {{ ctx: object, warns: string[] }}
 */
function stubCtx({ profileContext, gate = () => false, getThrows = false } = {}) {
  const warns = []
  const ctx = {
    get(name) {
      if (getThrows) throw new Error('context is not ready')
      if (name === 'profileContext') return profileContext
      if (name === BILI_GATE_SERVICE) return gate() ? { owner: 'billion-context', issue: '#3354' } : undefined
      return undefined
    },
    logger: {
      warn(message) {
        warns.push(message)
      },
    },
  }
  return { ctx, warns }
}

/** A sleep that records the requested delay instead of waiting. */
function sleepRecorder() {
  const sleeps = []
  return {
    sleeps,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
  }
}

/** A gate that is absent for the first `n` reads and present afterwards. */
function gateAfter(n) {
  let reads = 0
  return () => {
    reads += 1
    return reads > n
  }
}

test('the bili contract constants are pinned', () => {
  // bili 0.1.212: dist/agent/dsh-compaction-gate.js and
  // dist/agent/dsh-compaction-disable.js. These are internal, version-sensitive
  // names; a bili upgrade must re-read them.
  assert.equal(BILI_GATE_SERVICE, 'biliBasicCompactionPolicy')
  assert.equal(BILI_VERDICT_GLOBAL, '__BILI_DSH_COMPACTION_VERDICT__')
  assert.equal(BILI_VERDICT_ACTIVE, 'active')
  assert.equal(BILI_BUNDLE_NAME, 'billion-context')
  assert.deepEqual([...BILI_ATTACH_ENV], ['BILLION_CONTEXT_PROXY', 'BILLION_CONTEXT_ATTACH'])
  assert.deepEqual([...BILI_KILL_ENV], ['BILLION_CONTEXT_PLUGIN', 'BILI_NATIVE_DSH'])
  assert.equal(BILI_REWRITES_ENV, 'BILI_PROVIDER_REWRITES')
  assert.deepEqual({ ...BILI_TIMING }, { pollMs: 25, gateMs: 2000, verdictMs: 500 })
  assert.equal(typeof BILI_STAND_DOWN_WARNING, 'string')
  assert.ok(BILI_STAND_DOWN_WARNING.includes(BILI_BUNDLE_NAME))
  assert.equal(BILI_STAND_DOWN_WARNING.includes('\n'), false, 'one warning, one line')
})

test('the kill switches mirror bili planNativeDsh', () => {
  assert.equal(isBiliKillSwitched({}), false)
  assert.equal(isBiliKillSwitched({ BILLION_CONTEXT_PLUGIN: '1' }), false, 'only "0" switches the plugin off')
  assert.equal(isBiliKillSwitched({ BILLION_CONTEXT_PLUGIN: '0' }), true)
  assert.equal(isBiliKillSwitched({ BILI_NATIVE_DSH: '0' }), true)
  assert.equal(isBiliKillSwitched({ [BILI_REWRITES_ENV]: '' }), true, 'a defined rewrites variable is enough')
  assert.equal(isBiliKillSwitched({ [BILI_REWRITES_ENV]: '0' }), true)
  assert.equal(isBiliKillSwitched(undefined), false)
  assert.equal(isBiliKillSwitched(null), false)
  assert.equal(isBiliKillSwitched('not an env'), false)
})

test('expected detection reads bundles, overlays and the attach variables', () => {
  // No signal.
  assert.equal(isBiliExpected(undefined, {}), false)
  assert.equal(isBiliExpected(STOCK_PROFILE, {}), false)
  assert.equal(isBiliExpected({}, {}), false)

  // The bundle listed in dsh.profile.bundles.
  assert.equal(isBiliExpected(BILI_PROFILE, {}), true)

  // A --patch overlay that inserts bili, including a nested group row.
  assert.equal(
    isBiliExpected(
      { startedBundles: [], overlays: [{ insert: [{ id: 'bili-native', name: BILI_BUNDLE_NAME }] }] },
      {},
    ),
    true,
  )
  assert.equal(
    isBiliExpected(
      { startedBundles: [], overlays: [{ id: 'preset-standard', config: [{ group: true, name: 'group', config: [{ name: BILI_BUNDLE_NAME }] }] }] },
      {},
    ),
    true,
  )
  assert.equal(isBiliExpected({ startedBundles: [], overlays: [{ insert: [{ name: '@deepseek-ai/dsh-agent-preset' }] }] }, {}), false)
  assert.equal(isBiliExpected({ startedBundles: [], overlays: 'not an array' }, {}), false)

  // A launcher / explicit attach owns routing even when the bundle is not listed.
  for (const name of BILI_ATTACH_ENV) {
    assert.equal(isBiliExpected({}, { [name]: 'http://127.0.0.1:8787' }), true, name)
    assert.equal(isBiliExpected({}, { [name]: '   ' }), false, `${name} must not be blank`)
  }

  // A kill switch outranks every positive signal, exactly like bili's plan.
  for (const [name, value] of [
    ['BILLION_CONTEXT_PLUGIN', '0'],
    ['BILI_NATIVE_DSH', '0'],
    [BILI_REWRITES_ENV, 'defined'],
  ]) {
    assert.equal(isBiliExpected(BILI_PROFILE, { [name]: value }), false, `${name} wins over the bundle`)
    assert.equal(isBiliExpected({}, { [name]: value, BILLION_CONTEXT_PROXY: 'http://127.0.0.1:8787' }), false)
  }
})

test('the verdict is exactly the active marker', () => {
  assert.equal(isBiliVerdictActive(ACTIVE), true)
  assert.equal(isBiliVerdictActive(INACTIVE), false)
  assert.equal(isBiliVerdictActive({ [BILI_VERDICT_GLOBAL]: 'inactive' }), false)
  assert.equal(isBiliVerdictActive({ [BILI_VERDICT_GLOBAL]: true }), false)
  assert.equal(isBiliVerdictActive(undefined), false)
  assert.equal(isBiliVerdictActive(null), false)
})

/**
 * Every row asserts: the decision, the number of poll ticks, and the number of
 * warnings. `sleeps` counts `sleep(pollMs)` calls, so it is the observable
 * timeline of the wait.
 */
const CASES = [
  {
    name: 'gate and verdict already active with no profileContext: immediate true',
    // A custom preset or a profile-local patch can mount bili directly; the
    // armed pair alone must stand the engine down.
    env: {},
    profileContext: undefined,
    gate: () => true,
    scope: ACTIVE,
    expected: true,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'gate and verdict already active with a stock profile: immediate true',
    env: {},
    profileContext: STOCK_PROFILE,
    gate: () => true,
    scope: ACTIVE,
    expected: true,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'kill switch wins over an armed bili with no profile context',
    env: { BILI_NATIVE_DSH: '0' },
    profileContext: undefined,
    gate: () => true,
    scope: ACTIVE,
    expected: false,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'bundle expected, gate and verdict already there: immediate true',
    env: {},
    profileContext: BILI_PROFILE,
    gate: () => true,
    scope: ACTIVE,
    expected: true,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'attach env names the proxy: expected, waits for the gate',
    env: { BILLION_CONTEXT_PROXY: 'http://127.0.0.1:8787' },
    profileContext: {},
    gate: gateAfter(2),
    scope: ACTIVE,
    expected: true,
    sleeps: 2,
    warns: 0,
  },
  {
    name: 'overlay row names bili: expected, waits for the gate',
    env: {},
    profileContext: { startedBundles: [], overlays: [{ insert: [{ name: BILI_BUNDLE_NAME }] }] },
    gate: gateAfter(1),
    scope: ACTIVE,
    expected: true,
    sleeps: 1,
    warns: 0,
  },
  {
    name: 'gate appears on the fourth read: three ticks',
    env: {},
    profileContext: BILI_PROFILE,
    gate: gateAfter(3),
    scope: ACTIVE,
    expected: true,
    sleeps: 3,
    warns: 0,
  },
  {
    name: 'gate never appears: 2000 ms of ticks, one warning',
    env: {},
    profileContext: BILI_PROFILE,
    gate: () => false,
    scope: ACTIVE,
    expected: false,
    sleeps: Math.ceil(BILI_TIMING.gateMs / BILI_TIMING.pollMs),
    warns: 1,
  },
  {
    name: 'gate appears but the verdict is never active: 500 ms of grace, one warning',
    env: {},
    profileContext: BILI_PROFILE,
    gate: () => true,
    scope: INACTIVE,
    expected: false,
    sleeps: Math.ceil(BILI_TIMING.verdictMs / BILI_TIMING.pollMs),
    warns: 1,
  },
  {
    name: 'kill switch wins even when the gate is up and active',
    env: { BILLION_CONTEXT_PLUGIN: '0' },
    profileContext: BILI_PROFILE,
    gate: () => true,
    scope: ACTIVE,
    expected: false,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'native kill switch wins over the attach proxy',
    env: { BILI_NATIVE_DSH: '0', BILLION_CONTEXT_ATTACH: 'http://127.0.0.1:8787' },
    profileContext: {},
    gate: () => true,
    scope: ACTIVE,
    expected: false,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'provider rewrites defined: bili-native is off',
    env: { [BILI_REWRITES_ENV]: '1' },
    profileContext: BILI_PROFILE,
    gate: () => true,
    scope: ACTIVE,
    expected: false,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'bili not expected and gate not armed: immediate false, no delay, no warning',
    env: {},
    profileContext: STOCK_PROFILE,
    gate: () => false,
    scope: ACTIVE,
    expected: false,
    sleeps: 0,
    warns: 0,
  },
  {
    name: 'no profileContext and no armed gate: immediate false',
    env: {},
    profileContext: undefined,
    gate: () => false,
    scope: ACTIVE,
    expected: false,
    sleeps: 0,
    warns: 0,
  },
  {
    // The armed check reads the verdict once, then the grace loop reads it once
    // before each sleep, so six reads precede the seventh that turns active:
    // five sleeps.
    name: 'verdict turns active inside the grace window',
    env: {},
    profileContext: BILI_PROFILE,
    gate: () => true,
    scope: (() => {
      let reads = 0
      return {
        get [BILI_VERDICT_GLOBAL]() {
          reads += 1
          return reads > 6 ? BILI_VERDICT_ACTIVE : undefined
        },
      }
    })(),
    expected: true,
    sleeps: 5,
    warns: 0,
  },
  {
    name: 'custom timing changes the tick count, not the decision',
    env: {},
    profileContext: BILI_PROFILE,
    gate: () => false,
    scope: ACTIVE,
    timing: { pollMs: 10, gateMs: 20, verdictMs: 10 },
    expected: false,
    sleeps: 2,
    warns: 1,
  },
]

for (const item of CASES) {
  test(`resolveStandDown: ${item.name}`, async () => {
    const { ctx, warns } = stubCtx({ profileContext: item.profileContext, gate: item.gate })
    const { sleeps, sleep } = sleepRecorder()
    const result = await resolveStandDown(ctx, {
      env: item.env,
      scope: item.scope,
      sleep,
      timing: item.timing,
    })
    assert.equal(result, item.expected)
    assert.equal(sleeps.length, item.sleeps, 'poll tick count')
    assert.equal(warns.length, item.warns, 'warning count')
    if (item.warns > 0) assert.equal(warns[0], BILI_STAND_DOWN_WARNING)
  })
}

test('the verdict is read from globalThis when no scope is injected', async () => {
  globalThis[BILI_VERDICT_GLOBAL] = BILI_VERDICT_ACTIVE
  try {
    const { ctx, warns } = stubCtx({ profileContext: BILI_PROFILE, gate: () => true })
    const { sleeps, sleep } = sleepRecorder()
    assert.equal(await resolveStandDown(ctx, { env: {}, sleep }), true)
    assert.equal(sleeps.length, 0)
    assert.deepEqual(warns, [])
  } finally {
    delete globalThis[BILI_VERDICT_GLOBAL]
  }
})

test('a throwing context is a fail-open false, never a rejection', async () => {
  const { ctx } = stubCtx({ getThrows: true })
  const { sleeps, sleep } = sleepRecorder()
  await assert.doesNotReject(async () => {
    assert.equal(await resolveStandDown(ctx, { env: {}, sleep }), false)
  })
  assert.equal(sleeps.length, 0)
})

test('a throwing logger does not turn the fail-open decision into a crash', async () => {
  const ctx = {
    get(name) {
      if (name === 'profileContext') return BILI_PROFILE
      return undefined
    },
    logger: {
      warn() {
        throw new Error('logger is broken')
      },
    },
  }
  const { sleeps, sleep } = sleepRecorder()
  await assert.doesNotReject(async () => {
    assert.equal(await resolveStandDown(ctx, { env: {}, sleep }), false)
  })
  assert.equal(sleeps.length, Math.ceil(BILI_TIMING.gateMs / BILI_TIMING.pollMs))
})

test('garbage options still resolve to a boolean', async () => {
  const { ctx } = stubCtx({ profileContext: undefined })
  // Close every positive signal in the ambient environment so this assertion
  // does not depend on the shell that runs the suite.
  const saved = process.env[BILI_REWRITES_ENV]
  process.env[BILI_REWRITES_ENV] = '1'
  try {
    assert.equal(await resolveStandDown(ctx, null), false)
    assert.equal(await resolveStandDown(ctx, 'nonsense'), false)
  } finally {
    if (saved === undefined) delete process.env[BILI_REWRITES_ENV]
    else process.env[BILI_REWRITES_ENV] = saved
  }
  assert.equal(await resolveStandDown(null, { env: {} }), false)
})
