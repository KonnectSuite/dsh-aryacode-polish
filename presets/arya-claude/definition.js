/**
 * Arya Claude as data: the preset definition the registry mounts.
 *
 * The row list is **derived from the Arya Standard definition** rather than
 * copied, so the two presets stay in sync everywhere the Claude preset does not
 * differ. It differs in exactly four places, and each one is deliberate:
 *
 *   1. `persona` carries this bundle's authored Claude-shaped instructions
 *      (concise agentic behaviour, verification, plan/todo discipline) plus a
 *      harness-capabilities section naming the tools this preset mounts.
 *   2. The `compaction` group mounts this preset's policy, engine and microcompact
 *      pruner rows, and declares `aryaClaudePolicy` as the service its realm
 *      provides. The manual `/compact` command is unchanged.
 *   3. A `delegation` group is present, with the shipped composition's rows: Claude
 *      Code fans out to subagents, and Arya Standard's "no delegation" rule is not
 *      Claude's. The group is the shipped shape so its isolated `workflowEngine`
 *      realm resolves exactly as it does in the stock `standard` preset.
 *   4. `tool-schedule` is present for the same reason: Claude Code schedules work.
 *
 * Everything else — plan mode, todos, skills, goals, the fs/search/bash/ps tools,
 * web, present — is the Arya Standard row list by construction.
 *
 * @module dsh-aryacode-polish-arya-claude-definition
 */
import { buildDefinition as buildAryaStandardDefinition } from '../arya-standard/definition.js'
import { adaptClaudePrompt } from './adapt.js'
import { claudeBasePrompt, claudeNativePrompt } from './files.js'
import { engineConfig, policyConfig, prunerConfig, readSettings } from './settings.js'

/** The preset id sessions record in their header. */
export const ARYA_CLAUDE_PRESET_ID = 'arya-claude'

/** The name the preset picker shows. */
export const ARYA_CLAUDE_PRESET_NAME = 'Arya Claude'

/** One line under the name in the picker. */
export const ARYA_CLAUDE_PRESET_DESCRIPTION = 'Claude Code-style agent behaviour: its checkpoint shape and window arithmetic, tool-result microcompact, a summarizer failure breaker, and the subagent fan-out Arya Standard omits.'

/** Sort position beside the shipped presets and Arya Standard (2) / Arya Qwen (4). */
export const ARYA_CLAUDE_PRESET_ORDER = 5

/** The row id of the compaction engine inside the preset. */
export const ARYA_CLAUDE_ENGINE_ROW_ID = 'arya-claude-compaction'

/** The package and subpath the engine row mounts. */
export const ARYA_CLAUDE_ENGINE_MODULE = '@aryacode/dsh-aryacode-polish/arya-claude'

/** The row id of the policy row inside the preset. */
export const ARYA_CLAUDE_POLICY_ROW_ID = 'arya-claude-policy'

/** The package and subpath the policy row mounts. */
export const ARYA_CLAUDE_POLICY_MODULE = '@aryacode/dsh-aryacode-polish/arya-claude-policy'

/** The row id of the microcompact pruner inside the preset. */
export const ARYA_CLAUDE_PRUNER_ROW_ID = 'arya-claude-microcompact'

/** The package and subpath the pruner row mounts. */
export const ARYA_CLAUDE_PRUNER_MODULE = '@aryacode/dsh-aryacode-polish/arya-claude-pruner'

/** The delegation group id, matching the shipped `standard` preset. */
export const ARYA_CLAUDE_DELEGATION_GROUP_ID = 'delegation'

/** The scheduling row id, matching the shipped `standard` preset. */
export const ARYA_CLAUDE_SCHEDULE_ROW_ID = 'tool-schedule'

/** The shipped `standard` preset's delegation shape. */
const DELEGATION_ROWS = [
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
]

/**
 * Build the delegation group the shipped `standard` preset carries.
 * @returns {object} the group row.
 */
export function delegationGroup() {
  return {
    id: ARYA_CLAUDE_DELEGATION_GROUP_ID,
    name: 'cordis:group',
    group: true,
    isolate: { workflowEngine: true },
    config: DELEGATION_ROWS.map((row) => ({ ...row, ...(row.config === undefined ? {} : { config: { ...row.config } }) })),
  }
}

/**
 * Build the preset definition.
 *
 * @param {{ [key: string]: boolean | number | string }} [settings] validated
 *   settings; defaults are read when omitted.
 * @returns {{ id: string, name: string, description: string, order: number, plugins: object[] }}
 *   a definition `agentPresets.register()` accepts.
 */
export function buildDefinition(settings = readSettings()) {
  const base = buildAryaStandardDefinition(settings)
  const plugins = []
  for (const row of base.plugins) {
    if (row.id === 'persona') {
      plugins.push({
        ...row,
        config: {
          ...row.config,
          prefix: adaptClaudePrompt(claudeBasePrompt()) + '\n\n' + claudeNativePrompt(),
        },
      })
      continue
    }
    if (row.id === 'tool-jobs') {
      plugins.push(row)
      plugins.push({ id: ARYA_CLAUDE_SCHEDULE_ROW_ID, name: '@deepseek-ai/dsh-tool-schedule' })
      continue
    }
    if (row.id === 'compaction') {
      plugins.push({
        ...row,
        isolate: { compaction: true, toolResultPruner: true, aryaClaudePolicy: true },
        config: row.config.map((child) => {
          if (child.id === 'arya-standard-policy') {
            return { id: ARYA_CLAUDE_POLICY_ROW_ID, name: ARYA_CLAUDE_POLICY_MODULE, config: policyConfig(settings) }
          }
          if (child.id === 'arya-standard-compaction') {
            return { id: ARYA_CLAUDE_ENGINE_ROW_ID, name: ARYA_CLAUDE_ENGINE_MODULE, config: engineConfig(settings) }
          }
          if (child.id === 'tool-result-pruner') {
            return { id: ARYA_CLAUDE_PRUNER_ROW_ID, name: ARYA_CLAUDE_PRUNER_MODULE, config: prunerConfig() }
          }
          return child
        }),
      })
      plugins.push(delegationGroup())
      continue
    }
    plugins.push(row)
  }
  return {
    id: ARYA_CLAUDE_PRESET_ID,
    name: ARYA_CLAUDE_PRESET_NAME,
    description: ARYA_CLAUDE_PRESET_DESCRIPTION,
    order: ARYA_CLAUDE_PRESET_ORDER,
    plugins,
  }
}
