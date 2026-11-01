/**
 * Arya Automation Engineer: the preset shape, its persona, and the ledger fold.
 *
 * The projection is the part worth testing: it is what the Engineering tab shows,
 * and a mis-classified tool would claim a step happened that did not. The specs
 * drive it with the exact event shapes read out of a live session log
 * (`tool/call` carries the name; `tool/result` only carries the `callId`).
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  ARYA_AUTOMATION_ENGINE_MODULE,
  ARYA_AUTOMATION_ENGINE_ROW_ID,
  ARYA_AUTOMATION_POLICY,
  ARYA_AUTOMATION_POLICY_ROW_ID,
  ARYA_AUTOMATION_PRESET_ID,
  ARYA_AUTOMATION_PRESET_NAME,
  ARYA_AUTOMATION_PRUNER,
  buildDefinition,
} from '../presets/arya-automation/definition.js'
import { automationPersona } from '../presets/arya-automation/files.js'
import {
  ARYA_AUTOMATION_PROJECTION_KEY,
  applyEngineering,
  classifyTool,
  createAryaAutomationProjection,
} from '../presets/arya-automation/projection.js'
import { buildDefinition as buildAryaStandard } from '../presets/arya-standard/definition.js'

test('the preset carries the identity the picker shows', () => {
  const definition = buildDefinition()
  assert.equal(definition.id, 'arya-automation')
  assert.equal(definition.name, 'Arya Automation Engineer')
  assert.equal(ARYA_AUTOMATION_PRESET_ID, 'arya-automation')
  assert.equal(ARYA_AUTOMATION_PRESET_NAME, 'Arya Automation Engineer')
  assert.ok(definition.description.length > 40)
  assert.equal(definition.order, 5)
})

test('the row list is Arya Standard\'s except the persona and the compaction knobs', () => {
  const automation = buildDefinition()
  const standard = buildAryaStandard()
  assert.deepEqual(automation.plugins.map((row) => row.id), standard.plugins.map((row) => row.id))

  const persona = automation.plugins.find((row) => row.id === 'persona').config
  assert.ok(persona.prefix.startsWith('You are an automation engineer'))
  assert.equal(persona.complete, false)
  assert.equal(persona.includeRuntimeContext, true)

  const group = automation.plugins.find((row) => row.id === 'compaction')
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true, aryaStandardPolicy: true })
  const policy = group.config.find((row) => row.id === ARYA_AUTOMATION_POLICY_ROW_ID)
  assert.equal(policy.name, '@aryacode/dsh-aryacode-polish/arya-standard-policy')
  for (const [key, value] of Object.entries(ARYA_AUTOMATION_POLICY)) {
    assert.equal(policy.config[key], value, `${key} is the engineering default`)
  }
  const engine = group.config.find((row) => row.id === ARYA_AUTOMATION_ENGINE_ROW_ID)
  assert.equal(engine.name, ARYA_AUTOMATION_ENGINE_MODULE)
  const pruner = group.config.find((row) => row.id === 'tool-result-pruner')
  assert.deepEqual(pruner.config, { ...ARYA_AUTOMATION_PRUNER })
  // the manual command stays available
  assert.ok(group.config.some((row) => row.id === 'command-compact'))
})

test('the persona states the loop, the gates and the honesty rules', () => {
  const persona = automationPersona()
  for (const phrase of ['The loop is a contract', '# Gates', 'Identity discipline', '# Honesty',
    'Read before writing', 'Act in a copy', 'Verify with the vendor engine', 'Hand off what is human',
    'Never write to a running controller', 'never invent an instruction']) {
    assert.ok(persona.toLowerCase().includes(phrase.toLowerCase()), `missing: ${phrase}`)
  }
  for (const forbidden of ['apply_patch', '${', 'You are Codex']) {
    assert.equal(persona.includes(forbidden), false, `persona contains ${forbidden}`)
  }
  assert.ok(persona.includes('studio_sdk_status'), 'names the probes')
})

test('tool names classify into the five steps', () => {
  assert.equal(classifyTool('open_project'), 'read')
  assert.equal(classifyTool('run_checks'), 'check')
  assert.equal(classifyTool('verify_offline_l5x'), 'verify')
  assert.equal(classifyTool('build_acd_from_draft'), 'verify')
  assert.equal(classifyTool('compose_rung'), 'write')
  assert.equal(classifyTool('download_project'), 'live')
  assert.equal(classifyTool('write_live_tag'), 'live')
  assert.equal(classifyTool('todo_write'), null)
  assert.equal(classifyTool(''), null)
  assert.equal(classifyTool(undefined), null)
})

/** A fresh projection state. */
function initialState() {
  return createAryaAutomationProjection().init()
}

/** One engineering call event. */
function call(callId, name, args = '{}', time = 1) {
  return { type: 'tool/call', time, data: { turn: 1, step: 1, callId, name, arguments: args } }
}

/** The matching result event. */
function result(callId, isError = false, time = 2) {
  return { type: 'tool/result', time, data: { turn: 1, step: 1, message: { role: 'tool', toolCallId: callId, isError, content: [] } } }
}

test('a read, a check and their results fill the ledger', () => {
  const projection = createAryaAutomationProjection()
  let state = projection.init()
  state = applyEngineering(state, call('c1', 'open_project', '{"path":"C:/P/Line.L5X"}', 10))
  state = applyEngineering(state, result('c1', false, 11))
  state = applyEngineering(state, call('c2', 'run_checks', '{}', 12))
  state = applyEngineering(state, result('c2', false, 13))
  state = applyEngineering(state, call('c3', 'compose_rung', '{"project_id":"proj-1"}', 14))
  state = applyEngineering(state, result('c3', false, 15))

  const view = projection.wire.view(state)
  const stage = Object.fromEntries(view.stages.map((entry) => [entry.id, entry]))
  assert.equal(stage.read.done, true)
  assert.equal(stage.check.done, true)
  assert.equal(stage.write.done, true)
  assert.equal(stage.verify.done, false, 'a draft is not a verification')
  assert.equal(view.failures, 0)
  assert.equal(view.artifacts[0].value, 'proj-1')
  assert.ok(view.artifacts.some((artifact) => artifact.value === 'C:/P/Line.L5X'))
  assert.deepEqual(view.checks.map((check) => check.name), ['run_checks'])
})

test('a failed check stays red until a later attempt replaces it', () => {
  const projection = createAryaAutomationProjection()
  let state = projection.init()
  state = applyEngineering(state, call('c1', 'run_checks', '{}', 10))
  state = applyEngineering(state, result('c1', true, 11))
  state = applyEngineering(state, call('c2', 'verify_offline_l5x', '{}', 12))
  state = applyEngineering(state, result('c2', false, 13))

  let view = projection.wire.view(state)
  assert.equal(view.failures, 1)
  assert.equal(view.checks.find((check) => check.name === 'run_checks').ok, false)
  assert.equal(view.checks.find((check) => check.name === 'verify_offline_l5x').ok, true)
  assert.equal(view.stages.find((stage) => stage.id === 'verify').done, true)

  // the retry passes: the failure count stays (it happened), the row flips
  state = applyEngineering(state, call('c3', 'run_checks', '{}', 20))
  state = applyEngineering(state, result('c3', false, 21))
  view = projection.wire.view(state)
  assert.equal(view.checks.find((check) => check.name === 'run_checks').ok, true)
})

test('non-engineering tools and results are ignored', () => {
  const projection = createAryaAutomationProjection()
  let state = projection.init()
  state = applyEngineering(state, call('c1', 'todo_write', '{"todos":[]}', 10))
  state = applyEngineering(state, result('c1', false, 11))
  state = applyEngineering(state, call('c2', 'pwsh', '{"command":"dir"}', 12))
  state = applyEngineering(state, result('c2', false, 13))
  const view = projection.wire.view(state)
  assert.equal(view.hasActivity, false)
  assert.deepEqual(view.artifacts, [])
  assert.deepEqual(view.checks, [])
})

test('approvals and live writes are counted, not judged', () => {
  const projection = createAryaAutomationProjection()
  let state = projection.init()
  state = applyEngineering(state, { type: 'approval/policy', data: { policy: 'ask' }, time: 1 })
  state = applyEngineering(state, { type: 'approval/asked', data: {}, time: 2 })
  state = applyEngineering(state, { type: 'approval/decided', data: {}, time: 3 })
  state = applyEngineering(state, call('c1', 'write_live_tag', '{"ip_address":"192.168.1.10"}', 4))
  state = applyEngineering(state, result('c1', false, 5))
  state = applyEngineering(state, call('c2', 'read_live_tags', '{}', 6))
  state = applyEngineering(state, result('c2', false, 7))
  const view = projection.wire.view(state)
  assert.deepEqual(view.gates, { asked: 1, decided: 1, policy: 'ask' })
  assert.deepEqual(view.live, { reads: 1, writes: 1 })
  assert.equal(view.stages.find((stage) => stage.id === 'live').done, true)
})

test('the projection registers under its own key and version', () => {
  const projection = createAryaAutomationProjection()
  assert.equal(projection.key, 'aryaAutomation')
  assert.equal(projection.key, ARYA_AUTOMATION_PROJECTION_KEY)
  assert.equal(projection.stateVersion, 1)
  assert.equal(typeof projection.init, 'function')
  assert.deepEqual(projection.wire.view(initialState()), {
    hasActivity: false,
    stages: projection.wire.view(initialState()).stages,
    artifacts: [],
    checks: [],
    gates: { asked: 0, decided: 0, policy: '' },
    live: { reads: 0, writes: 0 },
    last: null,
    failures: 0,
  })
})
