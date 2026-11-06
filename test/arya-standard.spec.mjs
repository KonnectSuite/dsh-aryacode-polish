/**
 * The Arya Standard declaration.
 *
 * The preset is data: a definition the Host's preset registry mounts like any
 * shipped preset. These tests pin the shape a session would mount — the rows, the
 * order, the isolate realms, the numbers the engine row receives — and the prompt
 * adaptation, because a prompt that silently kept a Codex tool name would tell the
 * model about tools this harness does not have.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { adaptPrompt, FORBIDDEN_TOKENS, PROMPT_SUBSTITUTIONS } from '../presets/arya-standard/adapt.js'
import {
  ARYA_STANDARD_ENGINE_MODULE,
  ARYA_STANDARD_ENGINE_ROW_ID,
  ARYA_STANDARD_POLICY_MODULE,
  ARYA_STANDARD_POLICY_ROW_ID,
  ARYA_STANDARD_PRESET_ID,
  ARYA_STANDARD_PRESET_NAME,
  ARYA_STANDARD_PRESET_ORDER,
  buildDefinition,
} from '../presets/arya-standard/definition.js'
import { ARYA_STANDARD_FIELDS } from '../presets/arya-standard/fields.js'
import { codexBasePrompt, planModeSection } from '../presets/arya-standard/files.js'
import { ARYA_STANDARD_DEFAULTS, engineConfig, isDefaultSettings, policyConfig, readSettings } from '../presets/arya-standard/settings.js'
import { BILI_GATE_SERVICE, BILI_VERDICT_ACTIVE, BILI_VERDICT_GLOBAL } from '../presets/billion-context.js'

/**
 * The complete configuration key set `compaction-basic` accepts. Anything else on
 * the engine row throws at mount, so `engineConfig` must stay inside this list.
 */
const BASE_ENGINE_KEYS = new Set([
  'thresholdRatio',
  'headroomTokens',
  'retainRatio',
  'retainTokens',
  'summarizationProvider',
  'summarizationModel',
  'maxTokens',
  'compactionRetries',
  'maxOverflowRetries',
  'modelPolicies',
  'auto',
])

const definition = buildDefinition()

/**
 * Find one row of the definition by id.
 * @param {string} id the row id.
 * @returns {object | undefined} the row.
 */
function rowOf(id) {
  return definition.plugins.find((row) => row.id === id)
}

test('the preset carries the identity the picker shows', () => {
  assert.equal(definition.id, ARYA_STANDARD_PRESET_ID)
  assert.equal(definition.name, ARYA_STANDARD_PRESET_NAME)
  assert.equal(definition.name, 'Arya Standard')
  assert.equal(definition.order, ARYA_STANDARD_PRESET_ORDER)
  assert.equal(typeof definition.description, 'string')
  assert.ok(definition.description.length > 0)
})

test('every row names a module and an id', () => {
  assert.ok(Array.isArray(definition.plugins))
  assert.ok(definition.plugins.length > 10)
  const ids = definition.plugins.map((row) => row.id)
  assert.equal(new Set(ids).size, ids.length, 'row ids must be unique')
  for (const row of definition.plugins) {
    assert.equal(typeof row.id, 'string')
    assert.equal(typeof row.name, 'string')
    assert.ok(row.name.length > 0)
  }
})

// The authoritative baseline is
// `AryaCode/packages/bundle/web-app/presets/standard.patch.yml`; that file is in
// the DSH checkout, not this package, so the expected list is pinned here instead
// of read at test time. `arya-review-skills` is the one row this package adds.
const PARITY_ROW_IDS = [
  'persona',
  'agent-instructions',
  'time-context',
  'tool-bash',
  'tool-pwsh',
  'tool-fs',
  'tool-fs-search',
  'tool-jobs',
  'tool-schedule',
  'skill-filesystem',
  'tool-skill',
  'arya-review-skills',
  'command-goal',
  'tool-goal',
  'planning',
  'compaction',
  'delegation',
  'tool-ask-user',
  'tool-todo',
  'tool-web',
  'present',
  'tool-plugin-manager',
  'tool-plugin-market',
]

test('the row list is the shipped standard tool set', () => {
  assert.deepEqual(definition.plugins.map((row) => row.id), PARITY_ROW_IDS)
})

test('the scheduling row and the delegation group are the shipped composition', () => {
  const schedule = rowOf('tool-schedule')
  assert.equal(schedule.name, '@deepseek-ai/dsh-tool-schedule')

  const group = rowOf('delegation')
  assert.equal(group.name, 'cordis:group')
  assert.equal(group.group, true)
  assert.deepEqual(group.isolate, { workflowEngine: true })
  assert.deepEqual(group.config.map((row) => row.id), [
    'tool-subagent-control',
    'tool-subagent',
    'tool-subagent-fork',
    'workflow-ptc',
    'tool-workflow',
  ])
  const spawn = group.config.find((row) => row.id === 'tool-subagent')
  assert.equal(spawn.name, '@deepseek-ai/dsh-tool-subagent')
  assert.equal(spawn.config.provider, 'spawn')
  assert.equal(spawn.config.toolName, 'subagent')
  const fork = group.config.find((row) => row.id === 'tool-subagent-fork')
  assert.equal(fork.config.provider, 'fork')
  assert.equal(fork.config.toolName, 'subagent_fork')
  assert.equal(group.config.find((row) => row.id === 'workflow-ptc').config.provider, 'spawn')
  assert.equal(group.config.find((row) => row.id === 'tool-workflow').name, '@deepseek-ai/dsh-tool-workflow')
})

test('the plugin manager follows the Host profileContext; the market stays off', () => {
  const row = (id, options) => buildDefinition(ARYA_STANDARD_DEFAULTS, options).plugins.find((plugin) => plugin.id === id)

  // The shipped preset writes `disabled: !!js "!ctx.get('profileContext')"`.
  assert.equal(row('tool-plugin-manager').disabled, true, 'an absent profileContext disables the manager')
  assert.equal(row('tool-plugin-manager', { profileContext: false }).disabled, true)
  assert.equal(row('tool-plugin-manager', { profileContext: true }).disabled, false, 'the Host service enables it')
  assert.equal(row('tool-plugin-manager').name, '@deepseek-ai/dsh-plugin-manager/tools')
  for (const options of [undefined, { profileContext: false }, { profileContext: true }]) {
    assert.equal(row('tool-plugin-market', options).disabled, true, 'the market is opt-in everywhere')
    assert.equal(row('tool-plugin-market', options).name, '@deepseek-ai/dsh-plugin-market/tools')
  }
})

test('the compaction group isolates its services and mounts our two rows', () => {
  const group = rowOf('compaction')
  assert.equal(group.name, 'cordis:group')
  assert.equal(group.group, true)
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true, aryaStandardPolicy: true })
  assert.deepEqual(group.config.map((row) => row.id), [
    ARYA_STANDARD_POLICY_ROW_ID,
    ARYA_STANDARD_ENGINE_ROW_ID,
    'command-compact',
    'tool-result-pruner',
  ])
  const engine = group.config.find((row) => row.id === ARYA_STANDARD_ENGINE_ROW_ID)

  assert.equal(engine.name, ARYA_STANDARD_ENGINE_MODULE)
  assert.equal(engine.name, '@aryacode/dsh-aryacode-polish/arya-standard')
  assert.deepEqual(engine.config, engineConfig(ARYA_STANDARD_DEFAULTS))
  assert.equal(group.config.find((row) => row.id === 'tool-result-pruner').config.thresholdChars, 8192)

  // The policy row is how the Codex-only knobs reach the summarizer: the engine's
  // own configuration set is closed, so they cannot ride on it.
  const policy = group.config.find((row) => row.id === ARYA_STANDARD_POLICY_ROW_ID)
  assert.equal(policy.name, ARYA_STANDARD_POLICY_MODULE)
  assert.deepEqual(policy.config, policyConfig(ARYA_STANDARD_DEFAULTS))
  assert.equal(policy.config.keepUserTokens, 20000)
  assert.equal(policy.config.postTurnThresholdPercent, 90)
})

test('the compaction group stands down for billion-context, but never the pruner or policy', () => {
  const groupOf = (options) => buildDefinition(ARYA_STANDARD_DEFAULTS, options).plugins.find((row) => row.id === 'compaction')
  const rowOfGroup = (group, id) => group.config.find((row) => row.id === id)

  // The default shape is untouched: no `disabled` key appears on any compaction child.
  for (const options of [undefined, {}, { profileContext: true }, { standDownCompaction: false }]) {
    const group = groupOf(options)
    for (const row of group.config) {
      assert.equal('disabled' in row, false, `${row.id} must stay enabled without bili`)
    }
    assert.deepEqual(group.config.map((row) => row.id), [
      ARYA_STANDARD_POLICY_ROW_ID,
      ARYA_STANDARD_ENGINE_ROW_ID,
      'command-compact',
      'tool-result-pruner',
    ])
  }

  // With bili owning the lane the summarizer and the manual command it exists
  // for are off; the policy and the pruner are not compressors and stay.
  const group = groupOf({ standDownCompaction: true })
  assert.equal(rowOfGroup(group, ARYA_STANDARD_ENGINE_ROW_ID).disabled, true)
  assert.equal(rowOfGroup(group, 'command-compact').disabled, true)
  assert.notEqual(rowOfGroup(group, ARYA_STANDARD_POLICY_ROW_ID).disabled, true, 'the policy row stays mounted')
  assert.notEqual(rowOfGroup(group, 'tool-result-pruner').disabled, true, 'the pruner is not a summarizer')
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true, aryaStandardPolicy: true })
  assert.deepEqual(group.config.map((row) => row.id), [
    ARYA_STANDARD_POLICY_ROW_ID,
    ARYA_STANDARD_ENGINE_ROW_ID,
    'command-compact',
    'tool-result-pruner',
  ])
  // The engine keeps its closed config set; only `disabled` is added.
  assert.deepEqual(rowOfGroup(group, ARYA_STANDARD_ENGINE_ROW_ID).config, engineConfig(ARYA_STANDARD_DEFAULTS))
})

test('the engine config never carries a key the base engine rejects', () => {
  const keys = Object.keys(engineConfig(ARYA_STANDARD_DEFAULTS)).sort()
  assert.deepEqual(keys, [
    'auto',
    'compactionRetries',
    'headroomTokens',
    'maxOverflowRetries',
    'maxTokens',
    'retainRatio',
    'thresholdRatio',
  ])
  for (const key of keys) assert.ok(BASE_ENGINE_KEYS.has(key), `${key} is not a compaction-basic config key`)
  for (const key of ['keepUserTokens', 'postTurnThresholdPercent', 'autoCompactTokenLimit', 'compactPromptOverride', 'dropOldestRetries']) {
    assert.equal(key in engineConfig(ARYA_STANDARD_DEFAULTS), false, `${key} belongs on the policy row`)
  }
})

test('a settings override reaches the engine and policy rows', () => {
  const settings = readSettings({
    aryaStandardOptions: { thresholdRatio: 0.7, maxTokens: 12000, auto: false, keepUserTokens: 4000, postTurnThresholdPercent: 65 },
  })
  const tuned = buildDefinition(settings)
  const group = tuned.plugins.find((row) => row.id === 'compaction')
  const engine = group.config.find((row) => row.id === ARYA_STANDARD_ENGINE_ROW_ID)
  assert.equal(engine.config.thresholdRatio, 0.7)
  assert.equal(engine.config.maxTokens, 12000)
  assert.equal(engine.config.auto, false)
  const policy = group.config.find((row) => row.id === ARYA_STANDARD_POLICY_ROW_ID)
  assert.equal(policy.config.keepUserTokens, 4000)
  assert.equal(policy.config.postTurnThresholdPercent, 65)
})

test('the persona keeps the harness capabilities first-class', () => {
  const persona = rowOf('persona')
  const text = persona.config.prefix
  const native = text.indexOf('## Harness capabilities')
  assert.ok(native > 0, 'the persona needs the harness-capabilities section')
  assert.ok(native > text.indexOf('Final answer structure'), 'the section belongs after the Codex text')
  for (const name of ['ask_user_question', 'todo_write', 'exit_plan_mode', 'create_goal', 'update_goal', 'present', 'skill', 'web_search', 'web_fetch']) {
    assert.ok(text.includes(name), 'the persona must name ' + name)
  }
  assert.ok(text.includes('never as a question left in prose'), 'asking belongs through the tool')
})

test('the persona carries the adapted Codex prompt and leaves the runtime context on', () => {
  const persona = rowOf('persona')
  assert.equal(persona.config.complete, false)
  assert.equal(persona.config.includeRuntimeContext, true)
  assert.ok(persona.config.prefix.startsWith('You are a coding agent powered by the {{model}} model.'))
  for (const token of FORBIDDEN_TOKENS) {
    assert.equal(persona.config.prefix.includes(token), false, `${token} must not reach the model`)
  }
})

test('the plan-mode row receives the shipped section', () => {
  const planning = rowOf('planning')
  assert.equal(planning.group, true)
  assert.deepEqual(planning.isolate, { planMode: true })
  const mode = planning.config.find((row) => row.id === 'plan-mode')
  assert.equal(mode.config.section, planModeSection())
  assert.ok(mode.config.section.length > 100)
})

test('adaptation replaces every rule and nothing else', () => {
  const source = codexBasePrompt()
  const adapted = adaptPrompt(source)
  for (const rule of PROMPT_SUBSTITUTIONS) {
    assert.equal(adapted.includes(rule.find), false, `rule for ${rule.find.slice(0, 40)}… did not apply`)
    assert.ok(adapted.includes(rule.replace))
  }
  assert.throws(() => adaptPrompt(''), /the vendored Codex prompt is empty/)
  assert.throws(() => adaptPrompt('You are Codex, based on GPT-5. Nothing else here.'), /missing expected Codex sentence/)
})

test('settings are validated, clamped and defaulted', () => {
  assert.deepEqual(readSettings(undefined), ARYA_STANDARD_DEFAULTS)
  assert.deepEqual(readSettings({}), ARYA_STANDARD_DEFAULTS)
  assert.deepEqual(readSettings('not an object'), ARYA_STANDARD_DEFAULTS)
  const clamped = readSettings({ aryaStandardOptions: { thresholdRatio: 5, headroomTokens: 1, compactionRetries: -3 } })
  assert.equal(clamped.thresholdRatio, 0.99)
  assert.equal(clamped.headroomTokens, 2000)
  assert.equal(clamped.compactionRetries, 0)
  const rounded = readSettings({ aryaStandardOptions: { thresholdRatio: 0.7333, maxTokens: 12345.6 } })
  assert.equal(rounded.thresholdRatio, 0.7333, 'fractions of a ratio survive; only integers round')
  assert.equal(rounded.maxTokens, 12346)
  assert.equal(rounded.unknownKey, undefined, 'unknown keys are dropped')
  assert.equal(isDefaultSettings({}), true)
  assert.equal(isDefaultSettings({ aryaStandardOptions: { maxTokens: 8000 } }), false)
})

test('the engine config only names a summarizer when both halves are set', () => {
  assert.equal('summarizationProvider' in engineConfig(ARYA_STANDARD_DEFAULTS), false)
  const half = readSettings({ aryaStandardOptions: { summarizationProvider: 'deepseek' } })
  assert.equal('summarizationProvider' in engineConfig(half), false)
  const both = readSettings({ aryaStandardOptions: { summarizationProvider: 'deepseek', summarizationModel: 'deepseek-v4' } })
  assert.deepEqual(engineConfig(both).summarizationProvider, 'deepseek')
  assert.deepEqual(engineConfig(both).summarizationModel, 'deepseek-v4')
})

test('every field descriptor is well formed and unique', () => {
  const keys = ARYA_STANDARD_FIELDS.map((field) => field.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const field of ARYA_STANDARD_FIELDS) {
    assert.match(field.key, /^[a-z][a-zA-Z0-9]*$/)
    assert.ok(['boolean', 'number', 'text', 'choice'].includes(field.kind))
    assert.equal(typeof field.label, 'string')
    assert.equal(typeof field.description, 'string')
    assert.ok(field.default !== undefined)
    if (field.kind === 'number') {
      assert.equal(typeof field.min, 'number')
      assert.equal(typeof field.max, 'number')
      assert.ok(field.default >= field.min && field.default <= field.max)
    }
    if (field.kind === 'choice') {
      assert.ok(Array.isArray(field.options) && field.options.length >= 2, `${field.key} needs options`)
      assert.ok(field.options.some((option) => option.value === field.default), `${field.key} default must be an option`)
    }
  }
})

test('mounting registers the preset and its projection, and disposes them', async () => {
  const { mountAryaStandard } = await import('../presets/arya-standard/plugin.js')
  assert.deepEqual(mountAryaStandard.inject, ['agentPresets'])
  const registered = []
  const projections = []
  const effects = []
  const ctx = {
    get(name) {
      if (name === 'agentPresets') {
        return {
          register: async (definition) => {
            registered.push(definition)
            return () => registered.push('disposed')
          },
        }
      }
      if (name === 'sessionProjections') {
        return { register: async (projection) => projections.push(projection) }
      }
      return undefined
    },
    effect(fn) {
      effects.push(fn)
      return () => {}
    },
    logger: { info() {}, warn() {} },
  }
  await mountAryaStandard(ctx, { aryaStandardOptions: { thresholdRatio: 0.75 } })
  assert.equal(registered.length, 1)
  assert.equal(registered[0].id, 'arya-standard')
  assert.equal(registered[0].name, 'Arya Standard')
  assert.equal(
    registered[0].plugins.find((row) => row.id === 'tool-plugin-manager').disabled,
    true,
    'a Host without profileContext mounts the manager disabled',
  )
  const engine = registered[0].plugins.find((row) => row.id === 'compaction').config
    .find((row) => row.id === ARYA_STANDARD_ENGINE_ROW_ID)
  assert.equal(engine.config.thresholdRatio, 0.75)
  assert.equal(projections.length, 1)
  assert.equal(projections[0].key, 'aryaStandard')
  assert.equal(projections[0].stateVersion, 4)
  assert.equal(effects.length, 1)

  // The projection folds the route and the billed usage into the trajectory the
  // tab draws: one point per response, with cache reads folded into the input.
  const init = projections[0].init()
  const routed = projections[0].apply(init, {
    type: 'request/context',
    time: 1700000000000,
    data: { provider: 'local-library', model: 'strata:swift-1.5', contextWindow: 262144 },
  })
  const first = projections[0].apply(routed, {
    type: 'assistant/message',
    seq: 12,
    time: 1700000001000,
    data: { usage: { inputTokens: 900, outputTokens: 120, cacheReadTokens: 8200 } },
  })
  const second = projections[0].apply(first, {
    type: 'assistant/message',
    seq: 20,
    time: 1700000002000,
    data: { usage: { inputTokens: 40, outputTokens: 30, cacheReadTokens: 0 } },
  })
  assert.deepEqual(second.series.map((point) => point.seq), [12, 20])
  assert.equal(second.series[0].input, 9100)
  assert.equal(second.series[0].cached, 8200)
  assert.deepEqual(second.totals, { requests: 2, input: 9140, cached: 8200, output: 150 })

  // And a committed checkpoint becomes the card the tab renders.
  const state = projections[0].apply(second, {
    type: 'compaction/summary',
    time: 1700000000000,
    data: {
      compactionId: 'ab12cd34',
      summary: [{ type: 'text', text: 'the checkpoint' }],
      shadowedRange: { start: 4, end: 30 },
      shadowedSeqs: [4, 5, 6],
      shadowedTokenCount: 4000,
      provider: 'deepseek',
      model: 'deepseek-v4',
    },
  })
  const view = projections[0].wire.view(state)
  assert.equal(view.count, 1)
  assert.equal(view.checkpoints[0].freedTokens, 4000)
  assert.equal(view.checkpoints[0].pin, 'deepseek/deepseek-v4')
  assert.equal(view.checkpoints[0].manual, false)
  assert.equal(view.checkpoints[0].summary, 'the checkpoint')
  assert.equal(view.policy.thresholdRatio, 0.75)
  assert.equal(view.window.contextWindow, 262144)
  assert.equal(view.thresholdTokens, Math.min(Math.floor(262144 * 0.75), 262144 - 16000))
  assert.equal(view.series.length, 2, 'the wire view carries the trajectory')
  assert.equal(view.totals.requests, 2)
  assert.ok(view.cacheHitRatio > 0.89 && view.cacheHitRatio < 0.9, `cache hit ratio ${view.cacheHitRatio}`)
  assert.equal(view.savedTokens, 4000)
})

test('mounting passes the Host profileContext service to the definition', async () => {
  const { mountAryaStandard } = await import('../presets/arya-standard/plugin.js')
  const registered = []
  const ctx = {
    get(name) {
      if (name === 'agentPresets') {
        return {
          register: async (definition) => {
            registered.push(definition)
            return () => {}
          },
        }
      }
      if (name === 'profileContext') return {}
      return undefined
    },
    effect: (fn) => {
      fn()
      return () => {}
    },
    logger: { info() {}, warn() {} },
  }
  await mountAryaStandard(ctx, {})
  assert.equal(registered.length, 1)
  assert.equal(
    registered[0].plugins.find((row) => row.id === 'tool-plugin-manager').disabled,
    false,
    'the manager mounts where the Host exposes profileContext',
  )
})

test('mounting stands the summarizer down when billion-context owns the lane', async () => {
  const { mountAryaStandard } = await import('../presets/arya-standard/plugin.js')
  const registered = []
  const ctx = {
    get(name) {
      if (name === 'agentPresets') {
        return {
          register: async (definition) => {
            registered.push(definition)
            return () => {}
          },
        }
      }
      if (name === 'sessionProjections') return { register: async () => {} }
      if (name === 'profileContext') return { startedBundles: ['billion-context'], overlays: [] }
      if (name === BILI_GATE_SERVICE) return { owner: 'billion-context', issue: '#3354' }
      return undefined
    },
    effect: () => () => {},
    logger: { info() {}, warn() {} },
  }
  globalThis[BILI_VERDICT_GLOBAL] = BILI_VERDICT_ACTIVE
  try {
    await mountAryaStandard(ctx, {})
  } finally {
    delete globalThis[BILI_VERDICT_GLOBAL]
  }
  assert.equal(registered.length, 1)
  const group = registered[0].plugins.find((row) => row.id === 'compaction')
  assert.equal(group.config.find((row) => row.id === ARYA_STANDARD_ENGINE_ROW_ID).disabled, true, 'no second summarizer')
  assert.equal(group.config.find((row) => row.id === 'command-compact').disabled, true, '/compact goes with the engine')
  assert.notEqual(group.config.find((row) => row.id === ARYA_STANDARD_POLICY_ROW_ID).disabled, true)
  assert.notEqual(group.config.find((row) => row.id === 'tool-result-pruner').disabled, true)
  assert.equal(
    registered[0].plugins.find((row) => row.id === 'tool-plugin-manager').disabled,
    false,
    'bili does not change the Host tool rows',
  )
})

test('mounting honors an armed bili even when the profile names no bili bundle', async () => {
  const { mountAryaStandard } = await import('../presets/arya-standard/plugin.js')
  const registered = []
  const ctx = {
    get(name) {
      if (name === 'agentPresets') {
        return {
          register: async (definition) => {
            registered.push(definition)
            return () => {}
          },
        }
      }
      if (name === 'sessionProjections') return { register: async () => {} }
      // No profileContext at all: a custom preset or a profile-local patch can
      // mount bili directly, so the armed pair alone must be honored.
      if (name === BILI_GATE_SERVICE) return { owner: 'billion-context', issue: '#3354' }
      return undefined
    },
    effect: () => () => {},
    logger: { info() {}, warn() {} },
  }
  globalThis[BILI_VERDICT_GLOBAL] = BILI_VERDICT_ACTIVE
  try {
    await mountAryaStandard(ctx, {})
  } finally {
    delete globalThis[BILI_VERDICT_GLOBAL]
  }
  assert.equal(registered.length, 1)
  const group = registered[0].plugins.find((row) => row.id === 'compaction')
  assert.equal(group.config.find((row) => row.id === ARYA_STANDARD_ENGINE_ROW_ID).disabled, true)
  assert.equal(group.config.find((row) => row.id === 'command-compact').disabled, true)
  assert.equal(
    registered[0].plugins.find((row) => row.id === 'tool-plugin-manager').disabled,
    true,
    'no profileContext still disables the manager, as before',
  )
})

test('a composition without the preset registry is not a failure', async () => {
  const { mountAryaStandard } = await import('../presets/arya-standard/plugin.js')
  const logs = []
  await mountAryaStandard(
    { get: () => undefined, effect: () => () => {}, logger: { info: (line) => logs.push(line), warn: (line) => logs.push(line) } },
    {},
  )
  assert.deepEqual(logs, [
    'arya-standard: this composition has no agent preset registry',
    'arya-standard: this composition has no session projections',
  ])
})
