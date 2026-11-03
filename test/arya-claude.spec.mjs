/**
 * Arya Claude: the preset shape, the authored prompt, the policy and the two
 * model-free pieces (the microcompact pruner and the recently-read-files
 * section).
 *
 * The row-list assertion is the important one: the preset is *derived* from Arya
 * Standard's definition, so a row added there must show up here too, and the
 * Claude-only differences must stay exactly the intended three (persona, the
 * compaction group's rows, and the delegation group plus the scheduling row).
 */
import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  ARYA_CLAUDE_DELEGATION_GROUP_ID,
  ARYA_CLAUDE_ENGINE_MODULE,
  ARYA_CLAUDE_ENGINE_ROW_ID,
  ARYA_CLAUDE_POLICY_MODULE,
  ARYA_CLAUDE_POLICY_ROW_ID,
  ARYA_CLAUDE_PRESET_ID,
  ARYA_CLAUDE_PRESET_NAME,
  ARYA_CLAUDE_PRESET_ORDER,
  ARYA_CLAUDE_PRUNER_MODULE,
  ARYA_CLAUDE_PRUNER_ROW_ID,
  ARYA_CLAUDE_SCHEDULE_ROW_ID,
  buildDefinition,
  delegationGroup,
} from '../presets/arya-claude/definition.js'
import {
  FORBIDDEN_TOKENS,
  PROMPT_ANCHORS,
  adaptClaudePrompt,
  normalizePrompt,
} from '../presets/arya-claude/adapt.js'
import {
  claudeBasePrompt,
  claudeCheckpointPrompt,
  claudeNativePrompt,
  claudeSummaryPrefix,
  claudeSummarySuffix,
} from '../presets/arya-claude/files.js'
import {
  ARYA_CLAUDE_KIT,
  AryaClaudeCompactionEngine,
  createAutoCompactBreaker,
} from '../presets/arya-claude/engine.js'
import {
  ARYA_CLAUDE_POLICY_DEFAULTS,
  ARYA_CLAUDE_POLICY_FALLBACK,
  ARYA_CLAUDE_POLICY_SERVICE,
  readClaudePolicy,
  resolveClaudePolicy,
} from '../presets/arya-claude/policy.js'
import {
  CLAUDE_HEADROOM_TOKENS,
  CLAUDE_PRUNER_CONFIG,
  CLAUDE_THRESHOLD_RATIO,
  engineConfig,
  policyConfig,
  prunerConfig,
  readSettings,
} from '../presets/arya-claude/settings.js'
import { recentFilePaths, recentFilesSection } from '../presets/arya-claude/recent.js'
import {
  CLEARED_TOOL_RESULT_TEXT,
  PRUNE_MARKER,
  PRUNER_DEFAULTS,
  hasRichBlocks,
  isClearedContent,
  measureContent,
  planMicrocompact,
  pruneContent,
  resolvePrunerConfig,
} from '../presets/arya-claude/pruner.js'
import { mountAryaClaude } from '../presets/arya-claude/plugin.js'
import { buildDefinition as buildAryaStandardDefinition } from '../presets/arya-standard/definition.js'

const root = new URL('../', import.meta.url)

/** Insert one value after a given row id. */
function insertAfter(list, afterId, value) {
  const index = list.indexOf(afterId)
  assert.notEqual(index, -1, `missing row ${afterId}`)
  return [...list.slice(0, index + 1), value, ...list.slice(index + 1)]
}

test('the preset carries the identity the picker shows', () => {
  const definition = buildDefinition()
  assert.equal(definition.id, 'arya-claude')
  assert.equal(definition.name, 'Arya Claude')
  assert.equal(definition.id, ARYA_CLAUDE_PRESET_ID)
  assert.equal(definition.name, ARYA_CLAUDE_PRESET_NAME)
  assert.equal(definition.order, ARYA_CLAUDE_PRESET_ORDER)
  assert.ok(definition.description.length > 60)
  assert.ok(Array.isArray(definition.plugins) && definition.plugins.length > 10)
})

test('the row list is Arya Standard\'s plus exactly the Claude-only differences', () => {
  const claude = buildDefinition()
  const standard = buildAryaStandardDefinition()
  let expected = [...standard.plugins.map((row) => row.id)]
  expected = insertAfter(expected, 'tool-jobs', ARYA_CLAUDE_SCHEDULE_ROW_ID)
  expected = insertAfter(expected, 'compaction', ARYA_CLAUDE_DELEGATION_GROUP_ID)
  assert.deepEqual(claude.plugins.map((row) => row.id), expected, 'same rows in the same order, plus the two insertions')
  assert.equal(claude.plugins.filter((row) => row.id === ARYA_CLAUDE_DELEGATION_GROUP_ID).length, 1)

  const persona = claude.plugins.find((row) => row.id === 'persona')
  const standardPersona = standard.plugins.find((row) => row.id === 'persona')
  assert.notEqual(persona.config.prefix, standardPersona.config.prefix, 'the persona differs')
  assert.equal(persona.config.complete, false)
  assert.equal(persona.config.includeRuntimeContext, true)

  const group = claude.plugins.find((row) => row.id === 'compaction')
  assert.deepEqual(group.isolate, { compaction: true, toolResultPruner: true, aryaClaudePolicy: true })
  const ids = group.config.map((row) => row.id)
  for (const id of [ARYA_CLAUDE_POLICY_ROW_ID, ARYA_CLAUDE_ENGINE_ROW_ID, ARYA_CLAUDE_PRUNER_ROW_ID]) {
    assert.ok(ids.includes(id), `the compaction group carries ${id}`)
  }
  assert.equal(ids.includes('arya-standard-compaction'), false, 'no Arya Standard engine row')
  assert.equal(ids.includes('arya-standard-policy'), false, 'no Arya Standard policy row')
  assert.equal(ids.includes('tool-result-pruner'), false, 'the shipped trimmer is replaced by the microcompact pruner')
  assert.ok(ids.includes('command-compact'), 'manual compaction stays reachable')
  const rows = new Map(group.config.map((row) => [row.id, row]))
  assert.equal(rows.get(ARYA_CLAUDE_ENGINE_ROW_ID).name, ARYA_CLAUDE_ENGINE_MODULE)
  assert.equal(rows.get(ARYA_CLAUDE_POLICY_ROW_ID).name, ARYA_CLAUDE_POLICY_MODULE)
  assert.equal(rows.get(ARYA_CLAUDE_PRUNER_ROW_ID).name, ARYA_CLAUDE_PRUNER_MODULE)
  assert.deepEqual(rows.get(ARYA_CLAUDE_PRUNER_ROW_ID).config, { ...CLAUDE_PRUNER_CONFIG })
})

test('the delegation group is the shipped standard composition', () => {
  const group = delegationGroup()
  assert.equal(group.id, 'delegation')
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
})

test('the authored prompt passes its own adapter and names only this harness', () => {
  const prompt = adaptClaudePrompt(claudeBasePrompt())
  assert.ok(prompt.includes('{{model}}'), 'the identity line keeps the routed model placeholder')
  for (const anchor of PROMPT_ANCHORS) assert.ok(prompt.includes(anchor), `missing anchor ${anchor}`)
  for (const token of FORBIDDEN_TOKENS) assert.equal(prompt.includes(token), false, `foreign token ${token}`)
  assert.ok(prompt.length > 2000, 'a real system prompt, not a stub')
  assert.equal(adaptClaudePrompt(prompt), prompt, 'idempotent')
  assert.equal(normalizePrompt('a\r\n\r\n\r\n\r\nb'), 'a\n\nb')
  assert.throws(() => adaptClaudePrompt(' '), /authored prompt is empty/)
  assert.throws(() => adaptClaudePrompt('x'.repeat(100)), /too short/)
  assert.throws(() => adaptClaudePrompt(`${prompt}\nYou are Claude Code.`), /foreign-agent token survived/)
})

test('the persona row mounts the authored prompt plus the capability section', () => {
  const persona = buildDefinition().plugins.find((row) => row.id === 'persona').config.prefix
  assert.ok(persona.includes(adaptClaudePrompt(claudeBasePrompt())))
  assert.ok(persona.includes(claudeNativePrompt()))
  assert.ok(persona.includes('subagent'), 'the capability section names the delegation tools')
})

test('the checkpoint prompt is the authored nine-section instruction', () => {
  const checkpoint = claudeCheckpointPrompt()
  for (const heading of [
    'Primary Request and Intent',
    'Key Technical Concepts',
    'Files and Code Sections',
    'Errors and Fixes',
    'Problem Solving',
    'All User Messages',
    'Pending Tasks',
    'Current Work',
    'Optional Next Step',
  ]) {
    assert.ok(checkpoint.includes(heading), `missing section ${heading}`)
  }
  assert.ok(checkpoint.includes('<analysis>'))
  assert.ok(checkpoint.includes('<summary>'))
  assert.ok(/text only/i.test(checkpoint), 'the summarizer is told not to call tools')
  assert.ok(/only messages that actually came from the user/i.test(checkpoint), 'user-voice weighting is explicit')
  assert.ok(checkpoint.trim().length > 1500)
})

test('the continuation frame is a prefix and a resume trailer', () => {
  const prefix = claudeSummaryPrefix()
  const suffix = claudeSummarySuffix()
  assert.ok(prefix.length > 80 && prefix.length < 600)
  assert.ok(/continues an earlier conversation/i.test(prefix))
  assert.ok(suffix.length > 40 && suffix.length < 600)
  assert.ok(/do not acknowledge/i.test(suffix))
})

test('the policy pins the Claude pipeline and clamps hand-edited values', () => {
  assert.equal(ARYA_CLAUDE_POLICY_SERVICE, 'aryaClaudePolicy')
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.keepUserTokens, 0, 'the checkpoint prompt writes the user section')
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.postTurnThresholdPercent, 0, 'the base step-boundary trigger is the trigger')
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.preemptivePercent, 0)
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.dropOldestRetries, 3)
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.autoCompactFailureLimit, 3)
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.keepRecentToolResults, 12)
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.minMicroCompactTokens, 20000)
  assert.equal(ARYA_CLAUDE_POLICY_DEFAULTS.recentFileLimit, 5)

  const clamped = resolveClaudePolicy({ autoCompactFailureLimit: 0, keepRecentToolResults: 999, recentFileLimit: -3, minMicroCompactTokens: -1, dropOldestRetries: 99 })
  assert.equal(clamped.autoCompactFailureLimit, 1)
  assert.equal(clamped.keepRecentToolResults, 100)
  assert.equal(clamped.recentFileLimit, 0)
  assert.equal(clamped.minMicroCompactTokens, 0)
  assert.equal(clamped.dropOldestRetries, 5)
  assert.deepEqual(resolveClaudePolicy(undefined), ARYA_CLAUDE_POLICY_FALLBACK)
  assert.equal(readClaudePolicy(undefined), ARYA_CLAUDE_POLICY_FALLBACK)
  assert.equal(readClaudePolicy({ get: () => clamped }), clamped)
  assert.equal(readClaudePolicy({ get: () => ({}) }), ARYA_CLAUDE_POLICY_FALLBACK, 'a foreign service is ignored')
  assert.equal(readClaudePolicy({ get: () => { throw new Error('no service') } }), ARYA_CLAUDE_POLICY_FALLBACK)
})

test('the engine row keeps the two Claude thresholds and stays inside the closed key set', () => {
  const settings = readSettings()
  const config = engineConfig(settings)
  assert.equal(config.thresholdRatio, CLAUDE_THRESHOLD_RATIO)
  assert.equal(config.headroomTokens, CLAUDE_HEADROOM_TOKENS)
  assert.equal(config.auto, true)
  assert.ok(config.retainRatio < config.thresholdRatio, 'compaction-basic refuses retention >= threshold')
  const allowed = new Set([
    'auto', 'thresholdRatio', 'headroomTokens', 'retainRatio', 'retainTokens',
    'summarizationProvider', 'summarizationModel', 'maxTokens', 'compactionRetries',
    'maxOverflowRetries', 'modelPolicies',
  ])
  for (const key of Object.keys(config)) assert.ok(allowed.has(key), `engine row key ${key} is outside the closed set`)
  assert.equal(CLAUDE_THRESHOLD_RATIO, 0.99)
  assert.equal(CLAUDE_HEADROOM_TOKENS, 13000)
})

test('the policy row pins the Claude values and passes the user override through', () => {
  const settings = readSettings({ aryaStandardOptions: { compactPromptOverride: 'CCP override' } })
  const config = policyConfig(settings)
  assert.equal(config.postTurnThresholdPercent, 0)
  assert.equal(config.preemptivePercent, 0)
  assert.equal(config.autoCompactTokenLimit, 0)
  assert.equal(config.keepUserTokens, 0)
  assert.equal(config.dropOldestRetries, 3)
  assert.equal(config.autoCompactFailureLimit, 3)
  assert.equal(config.keepRecentToolResults, 12)
  assert.equal(config.minMicroCompactTokens, 20000)
  assert.equal(config.recentFileLimit, 5)
  assert.equal(config.compactPromptOverride, 'CCP override')
  assert.deepEqual(prunerConfig(), { ...CLAUDE_PRUNER_CONFIG })
})

test('every preset subpath the definition names is a real export', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  for (const subpath of ['./arya-claude', './arya-claude-policy', './arya-claude-pruner']) {
    const target = pkg.exports[subpath]
    assert.equal(typeof target, 'string', `${subpath} is exported`)
    assert.ok(existsSync(new URL(target, root)), `${subpath} points at an existing file (${target})`)
  }
})

test('recently read files come from the newest file tool calls, deduplicated', () => {
  const messages = [
    { role: 'assistant', content: [{ type: 'tool-call', id: '1', name: 'read', arguments: JSON.stringify({ file_path: 'C:/repo/a.js' }) }] },
    { role: 'tool', content: [{ type: 'text', text: 'a' }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: '2', name: 'grep', arguments: JSON.stringify({ pattern: 'x' }) }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: '3', name: 'edit', arguments: JSON.stringify({ file_path: 'C:/repo/b.js' }) }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: '4', name: 'read', arguments: JSON.stringify({ file_path: 'C:/repo/a.js' }) }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: '5', name: 'read', arguments: 'not json' }] },
  ]
  assert.deepEqual(recentFilePaths(messages, 5), ['C:/repo/a.js', 'C:/repo/b.js'], 'newest first, deduplicated')
  assert.deepEqual(recentFilePaths(messages, 1), ['C:/repo/a.js'])
  assert.deepEqual(recentFilePaths(messages, 0), [])
  const section = recentFilesSection(messages, 5)
  assert.ok(section.startsWith('## Files recently read'))
  assert.ok(section.includes('- C:/repo/a.js'))
  assert.ok(section.includes('- C:/repo/b.js'))
  assert.equal(recentFilesSection([], 5), '')
})

test('the pruner trims long results and keeps its config in bounds', () => {
  assert.deepEqual(resolvePrunerConfig(undefined), { ...PRUNER_DEFAULTS })
  const config = resolvePrunerConfig({ thresholdChars: 10, headChars: 500, tailChars: 500 })
  assert.deepEqual(config, { thresholdChars: 10, headChars: 10, tailChars: 10 }, 'head/tail are capped at the threshold')
  const long = [{ type: 'text', text: 'x'.repeat(200) }]
  assert.equal(measureContent(long), 200)
  const pruned = pruneContent(long, { thresholdChars: 50, headChars: 10, tailChars: 10 })
  assert.ok(pruned !== null)
  assert.ok(pruned[0].text.includes(PRUNE_MARKER))
  assert.ok(measureContent(pruned) < 200)
  assert.equal(pruneContent([{ type: 'text', text: 'short' }], { thresholdChars: 50, headChars: 10, tailChars: 10 }), null)
  assert.deepEqual(hasRichBlocks([{ type: 'image', data: 'x' }]), true)
  assert.deepEqual(hasRichBlocks([{ type: 'text', text: 'x' }]), false)
  assert.equal(isClearedContent([{ type: 'text', text: CLEARED_TOOL_RESULT_TEXT }]), true)
  assert.equal(isClearedContent([{ type: 'text', text: 'other' }]), false)
})

test('microcompact keeps the recent tail, skips rich and cleared results, and needs the token floor', () => {
  const entries = []
  for (let index = 0; index < 20; index += 1) {
    entries.push({ seq: index * 2, tokens: 2000, clearable: true, cleared: false })
  }
  // The most recent 12 are never cleared; the older 8 free 16,000 tokens.
  assert.deepEqual(planMicrocompact(entries, { keepRecent: 12, minTokens: 20000 }), { clearSeqs: [], savedTokens: 0 }, 'the floor is not met')
  const reached = planMicrocompact(entries, { keepRecent: 12, minTokens: 16000 })
  assert.equal(reached.clearSeqs.length, 8)
  assert.equal(reached.savedTokens, 16000)

  const mixed = [
    { seq: 1, tokens: 50000, clearable: false, cleared: false },
    { seq: 2, tokens: 40000, clearable: true, cleared: true },
    { seq: 3, tokens: 30000, clearable: true, cleared: false },
    { seq: 4, tokens: 1000, clearable: true, cleared: false },
  ]
  assert.deepEqual(planMicrocompact(mixed, { keepRecent: 1, minTokens: 1000 }), { clearSeqs: [3], savedTokens: 30000 })
  assert.deepEqual(planMicrocompact([], { keepRecent: 12, minTokens: 0 }), { clearSeqs: [], savedTokens: 0 })
})

test('the automatic-compaction breaker opens after the limit, skips, and resets', async () => {
  const agent = {}
  let limit = 3
  const breaker = createAutoCompactBreaker({ limit: () => limit })
  const fail = async () => { throw new Error('summarizer failed') }
  for (let attempt = 1; attempt < 3; attempt += 1) {
    await assert.rejects(breaker.run(agent, fail), /summarizer failed/)
    assert.equal(breaker.failureCount(agent), attempt)
    assert.equal(breaker.isOpen(agent), false)
  }
  await assert.rejects(breaker.run(agent, fail), /summarizer failed/)
  assert.equal(breaker.isOpen(agent), true, 'the third consecutive failure opens the breaker')
  const skipped = await breaker.run(agent, async () => ({ compactionId: 'never' }))
  assert.equal(skipped, null, 'an open breaker returns null without calling the engine')
  breaker.reset(agent)
  assert.equal(breaker.isOpen(agent), false)
  assert.equal(breaker.failureCount(agent), 0)
  const result = await breaker.run(agent, async () => ({ compactionId: 'ok' }))
  assert.deepEqual(result, { compactionId: 'ok' }, 'a success passes the result through')
  limit = 1
  const second = {}
  await assert.rejects(breaker.run(second, fail))
  assert.equal(breaker.isOpen(second), true, 'the limit is read per failure')
})

test('the shipped engine kit carries the Claude framing', () => {
  assert.ok(ARYA_CLAUDE_KIT.summaryPrefix.includes('continues an earlier conversation'))
  assert.ok(ARYA_CLAUDE_KIT.summarySuffix.includes('Do not acknowledge'))
  assert.equal(ARYA_CLAUDE_KIT.stripAnalysis, true)
  assert.ok(ARYA_CLAUDE_KIT.envelope instanceof RegExp)
  assert.equal(ARYA_CLAUDE_KIT.checkpointMarker, '<summary>')
  assert.equal(ARYA_CLAUDE_KIT.hookPrefix, 'arya-claude')
  assert.equal(ARYA_CLAUDE_KIT.label, 'arya-claude')
  assert.ok(ARYA_CLAUDE_KIT.minBodyTokens >= 400)
  assert.equal(typeof AryaClaudeCompactionEngine, 'function')
  assert.equal(typeof AryaClaudeCompactionEngine.prototype.compactIfNeeded, 'function')
})

test('mounting registers one definition and tolerates a composition without presets', async () => {
  const registered = []
  const ctx = {
    get(name) {
      if (name === 'agentPresets') return { register: async (definition) => { registered.push(definition); return () => {} } }
      return undefined
    },
    effect(callback) {
      return callback()
    },
    logger: { info() {}, warn() {} },
  }
  await mountAryaClaude(ctx)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].id, ARYA_CLAUDE_PRESET_ID)
  let warned = ''
  const bare = {
    get() { return undefined },
    effect(callback) { return callback() },
    logger: { info(message) { warned += message }, warn() {} },
  }
  await mountAryaClaude(bare)
  assert.match(warned, /no agent preset registry/)
  assert.deepEqual(mountAryaClaude.inject, ['agentPresets'])
})
