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
  ARYA_STANDARD_PRESET_ID,
  ARYA_STANDARD_PRESET_NAME,
  ARYA_STANDARD_PRESET_ORDER,
  buildDefinition,
} from '../presets/arya-standard/definition.js'
import { ARYA_STANDARD_FIELDS } from '../presets/arya-standard/fields.js'
import { codexBasePrompt, planModeSection } from '../presets/arya-standard/files.js'
import { ARYA_STANDARD_DEFAULTS, engineConfig, isDefaultSettings, readSettings } from '../presets/arya-standard/settings.js'

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

test('the toolset is the shipped standard toolset minus delegation and scheduling', () => {
  assert.deepEqual(definition.plugins.map((row) => row.id), [
    'persona',
    'agent-instructions',
    'time-context',
    'tool-bash',
    'tool-pwsh',
    'tool-fs',
    'tool-fs-search',
    'tool-jobs',
    'skill-filesystem',
    'tool-skill',
    'command-goal',
    'tool-goal',
    'planning',
    'compaction',
    'tool-ask-user',
    'tool-todo',
    'tool-web',
    'present',
  ])
  for (const dropped of ['delegation', 'tool-schedule', 'tool-plugin-manager', 'tool-plugin-market']) {
    assert.equal(rowOf(dropped), undefined, `${dropped} must not be part of the preset`)
  }
})

test('the compaction group isolates its services and mounts our engine row', () => {
  const group = rowOf('compaction')
  assert.equal(group.name, 'cordis:group')
  assert.equal(group.group, true)
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true })
  assert.deepEqual(group.config.map((row) => row.id), [ARYA_STANDARD_ENGINE_ROW_ID, 'command-compact', 'tool-result-pruner'])
  const engine = group.config[0]
  assert.equal(engine.name, ARYA_STANDARD_ENGINE_MODULE)
  assert.equal(engine.name, '@aryacode/dsh-aryacode-polish/arya-standard')
  assert.deepEqual(engine.config, engineConfig(ARYA_STANDARD_DEFAULTS))
  assert.equal(group.config.find((row) => row.id === 'tool-result-pruner').config.thresholdChars, 8192)
})

test('a settings override reaches the engine row', () => {
  const settings = readSettings({ aryaStandardOptions: { thresholdRatio: 0.7, maxTokens: 12000, auto: false } })
  const tuned = buildDefinition(settings)
  const engine = tuned.plugins.find((row) => row.id === 'compaction').config[0]
  assert.equal(engine.config.thresholdRatio, 0.7)
  assert.equal(engine.config.maxTokens, 12000)
  assert.equal(engine.config.auto, false)
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
    assert.ok(['boolean', 'number', 'text'].includes(field.kind))
    assert.equal(typeof field.label, 'string')
    assert.equal(typeof field.description, 'string')
    assert.ok(field.default !== undefined)
    if (field.kind === 'number') {
      assert.equal(typeof field.min, 'number')
      assert.equal(typeof field.max, 'number')
      assert.ok(field.default >= field.min && field.default <= field.max)
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
  const engine = registered[0].plugins.find((row) => row.id === 'compaction').config[0]
  assert.equal(engine.config.thresholdRatio, 0.75)
  assert.equal(projections.length, 1)
  assert.equal(projections[0].key, 'aryaStandard')
  assert.equal(projections[0].stateVersion, 2)
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
