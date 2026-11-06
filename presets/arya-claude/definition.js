/**
 * Arya Claude as data: the preset definition the registry mounts.
 *
 * The row list is **derived from the Arya Standard definition** rather than
 * copied, so the two presets stay in sync everywhere the Claude preset does not
 * differ. It differs in exactly three places, and each one is deliberate:
 *
 *   1. `persona` carries this bundle's authored Claude-shaped instructions
 *      (concise agentic behaviour, verification, plan/todo discipline) plus a
 *      harness-capabilities section naming the tools this preset mounts.
 *   2. The `compaction` group mounts this preset's policy, engine and microcompact
 *      pruner rows, and declares `aryaClaudePolicy` as the service its realm
 *      provides. The manual `/compact` command is unchanged.
 *   3. The full shipped tool set is inherited: scheduling, delegation, and the
 *      conditional Host plugin-manager/market rows are already in the base row
 *      list. Claude's prompt can prefer direct work, but the harness capability
 *      is not removed.
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
export const ARYA_CLAUDE_PRESET_DESCRIPTION = 'Claude Code-style agent behaviour: its checkpoint shape and window arithmetic, tool-result microcompact, a summarizer failure breaker, and the full DSH tool set.'

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

/** The delegation group id, inherited from the shared base row list. */
export const ARYA_CLAUDE_DELEGATION_GROUP_ID = 'delegation'

/** The scheduling row id, inherited from the shared base row list. */
export const ARYA_CLAUDE_SCHEDULE_ROW_ID = 'tool-schedule'

/**
 * Build the preset definition.
 *
 * @param {{ [key: string]: boolean | number | string }} [settings] validated
 *   settings; defaults are read when omitted.
 * @param {{ profileContext?: boolean, standDownCompaction?: boolean }} [options]
 *   host facts available at mount; passed through to the shared base row list.
 *   `standDownCompaction` also lands on this preset's replacement engine row so
 *   billion-context and the Claude summarizer never both compress one history;
 *   the microcompact pruner is not a summarizer and stays mounted.
 * @returns {{ id: string, name: string, description: string, order: number, plugins: object[] }}
 *   a definition `agentPresets.register()` accepts.
 */
export function buildDefinition(settings = readSettings(), options = {}) {
  const base = buildAryaStandardDefinition(settings, options)
  const safeOptions = options !== null && typeof options === 'object' ? options : {}
  const stoodDown = safeOptions.standDownCompaction === true ? { disabled: true } : {}
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
    if (row.id === 'compaction') {
      plugins.push({
        ...row,
        isolate: { compaction: true, toolResultPruner: true, aryaClaudePolicy: true },
        config: row.config.map((child) => {
          if (child.id === 'arya-standard-policy') {
            return { id: ARYA_CLAUDE_POLICY_ROW_ID, name: ARYA_CLAUDE_POLICY_MODULE, config: policyConfig(settings) }
          }
          if (child.id === 'arya-standard-compaction') {
            return { id: ARYA_CLAUDE_ENGINE_ROW_ID, name: ARYA_CLAUDE_ENGINE_MODULE, config: engineConfig(settings), ...stoodDown }
          }
          if (child.id === 'tool-result-pruner') {
            return { id: ARYA_CLAUDE_PRUNER_ROW_ID, name: ARYA_CLAUDE_PRUNER_MODULE, config: prunerConfig() }
          }
          return child
        }),
      })
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
