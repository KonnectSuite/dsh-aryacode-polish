/**
 * Arya Qwen: the preset shape, the adapted prompt, and the compaction kit.
 *
 * The prompt assertions are the important ones: the vendored text came out of a
 * 92 KB TypeScript file by extraction, so a hole (a `${...}` interpolation, a
 * Qwen Code tool name, a `tools.` receiver) is the failure mode that would ship
 * silently. Every one of those is forbidden here.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  ARYA_QWEN_ENGINE_MODULE,
  ARYA_QWEN_ENGINE_ROW_ID,
  ARYA_QWEN_POLICY_MODULE,
  ARYA_QWEN_POLICY_ROW_ID,
  ARYA_QWEN_PRESET_ID,
  ARYA_QWEN_PRESET_NAME,
  buildDefinition,
} from '../presets/arya-qwen/definition.js'
import { adaptQwenPrompt } from '../presets/arya-qwen/adapt.js'
import { qwenBasePrompt, qwenCheckpointPrompt, qwenSummarySuffix } from '../presets/arya-qwen/files.js'
import { ARYA_QWEN_KIT, AryaQwenEngine } from '../presets/arya-qwen/engine.js'
import { ARYA_QWEN_POLICY_SERVICE } from '../presets/arya-qwen/policy.js'
import { buildDefinition as buildAryaStandard } from '../presets/arya-standard/definition.js'
import { createAryaStandardCompaction } from '../presets/arya-standard/compaction.js'

test('the preset carries the identity the picker shows', () => {
  const definition = buildDefinition()
  assert.equal(definition.id, 'arya-qwen')
  assert.equal(definition.name, 'Arya Qwen')
  assert.equal(ARYA_QWEN_PRESET_ID, 'arya-qwen')
  assert.equal(ARYA_QWEN_PRESET_NAME, 'Arya Qwen')
  assert.ok(definition.description.length > 40)
  assert.equal(typeof definition.order, 'number')
  assert.ok(Array.isArray(definition.plugins) && definition.plugins.length > 10)
})

test('the row list is Arya Standard\'s, with only the three intended differences', () => {
  const qwen = buildDefinition()
  const standard = buildAryaStandard()
  assert.deepEqual(qwen.plugins.map((row) => row.id), standard.plugins.map((row) => row.id), 'same rows in the same order')

  const qwenPersona = qwen.plugins.find((row) => row.id === 'persona')
  const standardPersona = standard.plugins.find((row) => row.id === 'persona')
  assert.notEqual(qwenPersona.config.prefix, standardPersona.config.prefix, 'the persona differs')
  assert.equal(qwenPersona.config.complete, false)
  assert.equal(qwenPersona.config.includeRuntimeContext, true)

  const group = qwen.plugins.find((row) => row.id === 'compaction')
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true, aryaQwenPolicy: true })
  const ids = group.config.map((row) => row.id)
  assert.ok(ids.includes(ARYA_QWEN_ENGINE_ROW_ID))
  assert.ok(ids.includes(ARYA_QWEN_POLICY_ROW_ID))
  assert.equal(ids.includes('arya-standard-compaction'), false, 'no Arya Standard engine row')
  assert.equal(ids.includes('arya-standard-policy'), false, 'no Arya Standard policy row')
  const engineRow = group.config.find((row) => row.id === ARYA_QWEN_ENGINE_ROW_ID)
  assert.equal(engineRow.name, ARYA_QWEN_ENGINE_MODULE)
  const policyRow = group.config.find((row) => row.id === ARYA_QWEN_POLICY_ROW_ID)
  assert.equal(policyRow.name, ARYA_QWEN_POLICY_MODULE)
  assert.equal(policyRow.config.keepUserTokens, 0, 'Qwen Code reproduces user messages itself')
  // the pruner and the manual command stay untouched
  assert.ok(ids.includes('command-compact'))
  assert.ok(ids.includes('tool-result-pruner'))
})

test('the persona is Qwen Code\'s, with no extraction holes', () => {
  const persona = buildDefinition().plugins.find((row) => row.id === 'persona').config.prefix
  const qwenPart = adaptQwenPrompt(qwenBasePrompt())
  assert.ok(persona.startsWith('You are a coding agent'), 'the identity line is restored')
  assert.ok(persona.includes(qwenPart.trim()), 'the vendored prompt reaches the row intact')
  for (const heading of ['# Core Mandates', '## Software Engineering Tasks', '# Operational Guidelines', '## Using Your Tools']) {
    assert.ok(qwenPart.includes(heading), `missing ${heading}`)
  }
  assert.ok(qwenPart.includes('## Security and Safety Rules'))
  assert.ok(qwenPart.includes('todo_write'))
  assert.ok(qwenPart.includes('exit_plan_mode'))
  for (const forbidden of ['${', '@TOOL', '@AGENT', 'read_file', 'write_file', 'grep_search', 'run_shell_command', 'list_directory', 'qwen CLI', 'Interaction Details']) {
    assert.equal(qwenPart.includes(forbidden), false, `persona still contains ${forbidden}`)
  }
  // `tools.` as a receiver (Qwen Code's programmatic calling) is the hole; a
  // sentence ending in "dedicated tools." is fine.
  assert.deepEqual(qwenPart.match(/tools\.[A-Za-z_]/g), null, 'no tools.<name> receivers')
})

test('the adaptation adds the identity once and is idempotent', () => {
  const adapted = adaptQwenPrompt('# Core Mandates\n\n- a rule')
  assert.ok(adapted.startsWith('You are a coding agent'))
  assert.ok(adapted.includes('# Core Mandates'))
  assert.equal(adaptQwenPrompt(adapted), adapted, 'a second pass changes nothing')
  assert.equal(adaptQwenPrompt(undefined), adaptQwenPrompt(''), 'an empty body is still a valid prompt')
})

test('the checkpoint prompt and trailer are Qwen Code\'s', () => {
  const checkpoint = qwenCheckpointPrompt()
  assert.ok(checkpoint.includes('<state_snapshot>'))
  assert.ok(checkpoint.includes('<analysis>'))
  assert.ok(checkpoint.includes('all_user_messages'))
  assert.ok(checkpoint.trim().length > 2000)
  const trailer = qwenSummarySuffix()
  assert.ok(trailer.includes('do not acknowledge the summary'))
  assert.ok(trailer.trim().length < 400, 'the trailer is one line, not a paragraph')
})

test('the engine reads aryaQwenPolicy', () => {
  const descriptor = Object.getOwnPropertyDescriptor(AryaQwenEngine.prototype, 'policyService')
  assert.equal(typeof descriptor.get, 'function')
  assert.equal(descriptor.get.call({}), ARYA_QWEN_POLICY_SERVICE)
  assert.equal(ARYA_QWEN_POLICY_SERVICE, 'aryaQwenPolicy')
})

test('the shipped kit frames with the trailer, strips the analysis and refuses a tiny fold', () => {
  assert.equal(ARYA_QWEN_KIT.summaryPrefix, '')
  assert.ok(ARYA_QWEN_KIT.summarySuffix.includes('Resume the prior task'))
  assert.equal(ARYA_QWEN_KIT.stripAnalysis, true)
  assert.equal(ARYA_QWEN_KIT.checkpointMarker, '<state_snapshot>')
  // Below this much room the envelope would be cut and lose <next_step>.
  assert.ok(ARYA_QWEN_KIT.minBodyTokens >= 500, 'a structured checkpoint needs a floor')
})

test('a kit frames with a suffix and no prefix; an empty frame is refused', () => {
  class StubBase {}
  const kit = {
    BlockAssembler: class {},
    LlmError: Error,
    contentHasImage: () => false,
    deepFreeze: (value) => value,
    checkpointPrompt: 'compress this',
    summaryPrefix: '',
    summarySuffix: 'Resume the prior task.',
    stripAnalysis: true,
  }
  assert.doesNotThrow(() => createAryaStandardCompaction(StubBase, kit))
  assert.throws(() => createAryaStandardCompaction(StubBase, { ...kit, summarySuffix: '' }), /summary frame is missing/)
  assert.throws(() => createAryaStandardCompaction(StubBase, { ...kit, checkpointPrompt: ' ' }), /checkpoint prompt is missing/)
})

test('the vendored prompt is the adapted one the persona mounts', () => {
  const persona = buildDefinition().plugins.find((row) => row.id === 'persona').config.prefix
  assert.ok(persona.includes(qwenBasePrompt().trim().slice(0, 200)), 'the vendored prompt reaches the row')
})
