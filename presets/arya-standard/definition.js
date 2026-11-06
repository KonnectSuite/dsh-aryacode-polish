/**
 * Arya Standard as data: the preset definition the registry mounts.
 *
 * The row list mirrors `@deepseek-ai/dsh-web-app`'s shipped `standard` preset at
 * the DSH version this plugin targets, so an agent running Arya Standard has the
 * same tools and the same composition shape a DSH user already knows. Only three
 * things differ, and each one is deliberate:
 *
 *   1. `persona` carries Codex's base instructions (adapted by `adapt.js`) instead
 *      of the one-line default. `complete` stays false and the runtime context
 *      stays included, because the preset should still look like a DSH session.
 *   2. The `compaction` group carries two rows of ours instead of one: the engine
 *      (`arya-standard-compaction`) keeps the base engine's trigger, retention,
 *      locking and transaction work and replaces only the summary, while the
 *      policy row (`arya-standard-policy`) publishes the knobs that engine's own
 *      closed configuration cannot carry.
 *   3. The full shipped tool set is present: scheduling, delegation, and the
 *      conditional Host plugin-manager/market rows are not removed just because
 *      the Codex loop would not normally use them. The prompt can prefer direct
 *      work; the harness capability stays available.
 *
 * Row ids matter: a later patch layer addresses rows by id, and the Web editor
 * saves overrides the same way, so the ids match the shipped preset wherever the
 * rows are the same.
 *
 * @module dsh-aryacode-polish-arya-standard-definition
 */
import { adaptPrompt } from './adapt.js'
import { codexBasePrompt, nativePrompt, planModeSection, skillsDirectory } from './files.js'
import { engineConfig, policyConfig, readSettings } from './settings.js'

/** The preset id sessions record in their header. */
export const ARYA_STANDARD_PRESET_ID = 'arya-standard'

/** The name the preset picker shows. */
export const ARYA_STANDARD_PRESET_NAME = 'Arya Standard'

/** One line under the name in the picker. */
export const ARYA_STANDARD_PRESET_DESCRIPTION = 'Codex-style agent loop behaviour: a plan-first prompt, the full DSH tool set, and Codex checkpoint compaction.'

/** Sort position beside the shipped presets (`standard` is 1, `minimal` is 3). */
export const ARYA_STANDARD_PRESET_ORDER = 2

/** The row id of the compaction engine inside the preset. */
export const ARYA_STANDARD_ENGINE_ROW_ID = 'arya-standard-compaction'

/** The package and subpath the engine row mounts. */
export const ARYA_STANDARD_ENGINE_MODULE = '@aryacode/dsh-aryacode-polish/arya-standard'

/** The row id of the policy row inside the preset. */
export const ARYA_STANDARD_POLICY_ROW_ID = 'arya-standard-policy'

/** The package and subpath the policy row mounts. */
export const ARYA_STANDARD_POLICY_MODULE = '@aryacode/dsh-aryacode-polish/arya-standard-policy'

/**
 * Build the preset definition.
 *
 * @param {{ [key: string]: boolean | number | string }} [settings] validated
 *   settings; defaults are read when omitted.
 * @param {{ profileContext?: boolean, standDownCompaction?: boolean }} [options]
 *   host facts available at mount; `profileContext` enables the Host
 *   plugin-manager tools exactly as the shipped standard preset does, and
 *   `standDownCompaction` disables this preset's summarizer and `/compact` when
 *   billion-context owns the context lane (`presets/billion-context.js`).
 * @returns {{ id: string, name: string, description: string, order: number, plugins: object[] }}
 *   a definition `agentPresets.register()` accepts.
 */
export function buildDefinition(settings = readSettings(), options = {}) {
  const windows = process.platform === 'win32'
  const safeOptions = options !== null && typeof options === 'object' ? options : {}
  const profileContext = safeOptions.profileContext === true
  // billion-context compresses the wire; a second summarizer on the same history
  // produces two incompatible checkpoint shapes. Disable only the summarizer and
  // the manual command it exists for: the policy row and the tool-result pruner
  // are not compressors and stay mounted.
  const standDownCompaction = safeOptions.standDownCompaction === true
  const stoodDown = standDownCompaction ? { disabled: true } : {}
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
          prefix: adaptPrompt(codexBasePrompt()) + '\n\n' + nativePrompt(),
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
      { id: 'tool-schedule', name: '@deepseek-ai/dsh-tool-schedule' },
      { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
      { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
      {
        // The review lenses ship inside this package. A second provider scans only
        // that directory, so the project and user roots keep coming from the
        // shipped provider above it and nothing is scanned twice.
        id: 'arya-review-skills',
        name: '@deepseek-ai/dsh-skill-filesystem',
        config: {
          providerName: 'arya-review',
          includeDefaultRoots: false,
          watch: false,
          customSkillDirs: [skillsDirectory()],
        },
      },
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
        // A preset may only provide a service inside a realm it declares. The
        // registry rejects the whole definition otherwise with
        // `agent-preset/invalid: Preset services require isolate realms:
        // aryaStandardPolicy`, which surfaces as a failed session create.
        isolate: { compaction: true, toolResultPruner: true, aryaStandardPolicy: true },
        config: [
          { id: ARYA_STANDARD_POLICY_ROW_ID, name: ARYA_STANDARD_POLICY_MODULE, config: policyConfig(settings) },
          {
            id: ARYA_STANDARD_ENGINE_ROW_ID,
            name: ARYA_STANDARD_ENGINE_MODULE,
            config: engineConfig(settings),
            ...stoodDown,
          },
          { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact', ...stoodDown },
          {
            id: 'tool-result-pruner',
            name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
            config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
          },
        ],
      },
      {
        id: 'delegation',
        name: 'cordis:group',
        group: true,
        isolate: { workflowEngine: true },
        config: [
          { id: 'tool-subagent-control', name: '@deepseek-ai/dsh-tool-subagent-control' },
          {
            id: 'tool-subagent',
            name: '@deepseek-ai/dsh-tool-subagent',
            config: { provider: 'spawn', toolName: 'subagent', modelSelection: true, modelDiscovery: true },
          },
          {
            id: 'tool-subagent-fork',
            name: '@deepseek-ai/dsh-tool-subagent',
            config: { provider: 'fork', toolName: 'subagent_fork' },
          },
          { id: 'workflow-ptc', name: '@deepseek-ai/dsh-workflow-ptc', config: { provider: 'spawn' } },
          { id: 'tool-workflow', name: '@deepseek-ai/dsh-tool-workflow' },
        ],
      },
      { id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' },
      { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
      { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } },
      { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
      // Host plumbing, matching the shipped standard rows: the manager exists
      // only where the Host exposes profileContext; the market is opt-in.
      { id: 'tool-plugin-manager', name: '@deepseek-ai/dsh-plugin-manager/tools', disabled: !profileContext },
      { id: 'tool-plugin-market', name: '@deepseek-ai/dsh-plugin-market/tools', disabled: true },
    ],
  }
}
