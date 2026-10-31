/**
 * Arya Standard as data: the preset definition the registry mounts.
 *
 * The row list mirrors `@deepseek-ai/dsh-web-app`'s shipped `standard` preset at
 * the DSH version this plugin targets, so an agent running Arya Standard has the
 * same tools and the same composition shape a DSH user already knows. Only four
 * things differ, and each one is deliberate:
 *
 *   1. `persona` carries Codex's base instructions (adapted by `adapt.js`) instead
 *      of the one-line default. `complete` stays false and the runtime context
 *      stays included, because the preset should still look like a DSH session.
 *   2. The `compaction` group's engine row is ours (`arya-standard-compaction`)
 *      rather than `compaction-basic`. It keeps the base engine's trigger,
 *      retention, locking and transaction work and replaces only the summary.
 *   3. The `delegation` group is absent. Codex has no subagent fan-out, and a
 *      preset that promises Codex behaviour should not quietly ship it.
 *   4. `tool-schedule`, `tool-plugin-manager` and `tool-plugin-market` are absent
 *      for the same reason: they are Host chores, not coding-loop tools.
 *
 * Row ids matter: a later patch layer addresses rows by id, and the Web editor
 * saves overrides the same way, so the ids match the shipped preset wherever the
 * rows are the same.
 *
 * @module dsh-aryacode-polish-arya-standard-definition
 */
import { adaptPrompt } from './adapt.js'
import { codexBasePrompt, planModeSection } from './files.js'
import { engineConfig, readSettings } from './settings.js'

/** The preset id sessions record in their header. */
export const ARYA_STANDARD_PRESET_ID = 'arya-standard'

/** The name the preset picker shows. */
export const ARYA_STANDARD_PRESET_NAME = 'Arya Standard'

/** One line under the name in the picker. */
export const ARYA_STANDARD_PRESET_DESCRIPTION = 'Codex-style agent loop behaviour: a plan-first prompt, no subagent fan-out, and Codex checkpoint compaction.'

/** Sort position beside the shipped presets (`standard` is 1, `minimal` is 3). */
export const ARYA_STANDARD_PRESET_ORDER = 2

/** The row id of the compaction engine inside the preset. */
export const ARYA_STANDARD_ENGINE_ROW_ID = 'arya-standard-compaction'

/** The package and subpath the engine row mounts. */
export const ARYA_STANDARD_ENGINE_MODULE = '@aryacode/dsh-aryacode-polish/arya-standard'

/**
 * Build the preset definition.
 *
 * @param {{ [key: string]: boolean | number | string }} [settings] validated
 *   settings; defaults are read when omitted.
 * @returns {{ id: string, name: string, description: string, order: number, plugins: object[] }}
 *   a definition `agentPresets.register()` accepts.
 */
export function buildDefinition(settings = readSettings()) {
  const windows = process.platform === 'win32'
  return {
    id: ARYA_STANDARD_PRESET_ID,
    name: ARYA_STANDARD_PRESET_NAME,
    description: ARYA_STANDARD_PRESET_DESCRIPTION,
    order: ARYA_STANDARD_PRESET_ORDER,
    plugins: [
      {
        id: 'persona',
        name: '@deepseek-ai/dsh-persona',
        config: {
          prefix: adaptPrompt(codexBasePrompt()),
          complete: false,
          includeRuntimeContext: true,
        },
      },
      { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
      { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
      { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', disabled: windows },
      { id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh', disabled: !windows },
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
      { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
      { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
      { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
      { id: 'command-goal', name: '@deepseek-ai/dsh-command-goal' },
      { id: 'tool-goal', name: '@deepseek-ai/dsh-tool-goal' },
      {
        id: 'planning',
        name: 'cordis:group',
        group: true,
        isolate: { planMode: true },
        config: [
          { id: 'plan-mode', name: '@deepseek-ai/dsh-plan-mode', config: { section: planModeSection() } },
        ],
      },
      {
        id: 'compaction',
        name: 'cordis:group',
        group: true,
        isolate: { compaction: true, toolResultPruner: true },
        config: [
          { id: ARYA_STANDARD_ENGINE_ROW_ID, name: ARYA_STANDARD_ENGINE_MODULE, config: engineConfig(settings) },
          { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
          {
            id: 'tool-result-pruner',
            name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
            config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
          },
        ],
      },
      { id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' },
      { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
      { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } },
      { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
    ],
  }
}
