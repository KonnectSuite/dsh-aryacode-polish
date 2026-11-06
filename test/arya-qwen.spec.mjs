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

// The authoritative shipped `standard` row ids:
// `AryaCode/packages/bundle/web-app/presets/standard.patch.yml`. Arya Qwen
// derives the list from Arya Standard and only changes the persona and the
// compaction children.
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

test('the row list is Arya Standard\'s full shipped tool set, with only the three intended differences', () => {
  const qwen = buildDefinition()
  const standard = buildAryaStandard()
  assert.deepEqual(qwen.plugins.map((row) => row.id), PARITY_ROW_IDS, 'the shipped standard rows, in order')
  assert.deepEqual(qwen.plugins.map((row) => row.id), standard.plugins.map((row) => row.id), 'same rows in the same order')
  assert.ok(qwen.plugins.some((row) => row.id === 'tool-schedule'))
  assert.ok(qwen.plugins.some((row) => row.id === 'delegation'))
  assert.ok(qwen.plugins.some((row) => row.id === 'tool-plugin-manager'))
  assert.ok(qwen.plugins.some((row) => row.id === 'tool-plugin-market'))

  const qwenPersona = qwen.plugins.find((row) => row.id === 'persona')
  const standardPersona = standard.plugins.find((row) => row.id === 'persona')
  assert.notEqual(qwenPersona.config.prefix, standardPersona.config.prefix, 'the persona differs')
  assert.equal(qwenPersona.config.complete, false)
  assert.equal(qwenPersona.config.includeRuntimeContext, true)

  // Compaction stays this preset's own pipeline; parity is about the tool rows.
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

test('the plugin-manager conditional is inherited from Arya Standard', () => {
  const row = (id, options) => buildDefinition(undefined, options).plugins.find((plugin) => plugin.id === id)
  assert.equal(row('tool-plugin-manager').disabled, true, 'an absent profileContext disables the manager')
  assert.equal(row('tool-plugin-manager', { profileContext: true }).disabled, false)
  assert.equal(row('tool-plugin-market').disabled, true)
  assert.equal(row('tool-plugin-market', { profileContext: true }).disabled, true)
})

test('the compaction group stands down for billion-context and keeps the pruner and policy', () => {
  const groupOf = (options) => buildDefinition(undefined, options).plugins.find((row) => row.id === 'compaction')
  const rowOfGroup = (group, id) => group.config.find((row) => row.id === id)

  // Without bili nothing changes: no compaction child carries `disabled`.
  for (const options of [undefined, {}, { standDownCompaction: false }, { profileContext: true }]) {
    const group = groupOf(options)
    for (const row of group.config) assert.equal('disabled' in row, false, `${row.id} must stay enabled without bili`)
    assert.deepEqual(group.config.map((row) => row.id), [
      ARYA_QWEN_POLICY_ROW_ID,
      ARYA_QWEN_ENGINE_ROW_ID,
      'command-compact',
      'tool-result-pruner',
    ])
  }

  // With bili owning the lane the Qwen summarizer and /compact go off; the
  // policy row and the pruner are not compressors and stay mounted.
  const group = groupOf({ standDownCompaction: true })
  assert.equal(rowOfGroup(group, ARYA_QWEN_ENGINE_ROW_ID).disabled, true)
  assert.equal(rowOfGroup(group, 'command-compact').disabled, true)
  assert.notEqual(rowOfGroup(group, ARYA_QWEN_POLICY_ROW_ID).disabled, true)
  assert.notEqual(rowOfGroup(group, 'tool-result-pruner').disabled, true)
  assert.equal(rowOfGroup(group, ARYA_QWEN_ENGINE_ROW_ID).name, ARYA_QWEN_ENGINE_MODULE)
  // The replacement row is still the Qwen one, not a disabled Arya Standard row.
  assert.equal(rowOfGroup(group, ARYA_QWEN_ENGINE_ROW_ID).id, ARYA_QWEN_ENGINE_ROW_ID)
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true, aryaQwenPolicy: true })
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
