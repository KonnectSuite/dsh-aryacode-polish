/**
 * Arya Qwen as data: the preset definition the registry mounts.
 *
 * The row list is **derived from the Arya Standard definition** rather than
 * copied, so the two presets keep the same tools, the same groups and the same
 * row ids everywhere except the three places this preset differs:
 *
 *   1. `persona` carries Qwen Code's system prompt (Core Mandates, Primary
 *      Workflows, Operational Guidelines, adapted by `adapt.js`) plus the same
 *      harness-capabilities section Arya Standard appends;
 *   2. the `compaction` group mounts our Qwen engine and policy rows, and
 *      declares `aryaQwenPolicy` as the service its realm provides;
 *   3. the policy row asks for `keepUserTokens: 0`, because Qwen Code's
 *      compression prompt already reproduces the user's messages inside
 *      `<all_user_messages>`.
 *
 * Everything else — no delegation group, no schedule or plugin-manager tools,
 * plan mode, the pruner — is the Arya Standard row list by construction.
 *
 * @module dsh-aryacode-polish-arya-qwen-definition
 */

import { buildDefinition as buildAryaStandardDefinition } from '../arya-standard/definition.js'
import { nativePrompt } from '../arya-standard/files.js'
import { engineConfig, policyConfig, readSettings } from '../arya-standard/settings.js'
import { adaptQwenPrompt } from './adapt.js'
import { qwenBasePrompt } from './files.js'

/** The preset id sessions record in their header. */
export const ARYA_QWEN_PRESET_ID = 'arya-qwen'

/** The name the preset picker shows. */
export const ARYA_QWEN_PRESET_NAME = 'Arya Qwen'

/** One line under the name in the picker. */
export const ARYA_QWEN_PRESET_DESCRIPTION = 'Qwen Code-style agent behaviour: its prompt, its state_snapshot checkpoint, and the same tools as Arya Standard.'

/** Sort position beside the shipped presets and Arya Standard (2). */
export const ARYA_QWEN_PRESET_ORDER = 4

/** The row id of the compaction engine inside the preset. */
export const ARYA_QWEN_ENGINE_ROW_ID = 'arya-qwen-compaction'

/** The package and subpath the engine row mounts. */
export const ARYA_QWEN_ENGINE_MODULE = '@aryacode/dsh-aryacode-polish/arya-qwen'

/** The row id of the policy row inside the preset. */
export const ARYA_QWEN_POLICY_ROW_ID = 'arya-qwen-policy'

/** The package and subpath the policy row mounts. */
export const ARYA_QWEN_POLICY_MODULE = '@aryacode/dsh-aryacode-polish/arya-qwen-policy'

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
  const plugins = base.plugins.map((row) => {
    if (row.id === 'persona') {
      return {
        ...row,
        config: {
          ...row.config,
          prefix: adaptQwenPrompt(qwenBasePrompt()) + '\n\n' + nativePrompt(),
        },
      }
    }
    if (row.id !== 'compaction') return row
    return {
      ...row,
      isolate: { compaction: true, toolResultPruner: true, aryaQwenPolicy: true },
      config: row.config.map((child) => {
        if (child.id === 'arya-standard-policy') {
          return {
            id: ARYA_QWEN_POLICY_ROW_ID,
            name: ARYA_QWEN_POLICY_MODULE,
            config: { ...policyConfig(settings), keepUserTokens: 0 },
          }
        }
        if (child.id === 'arya-standard-compaction') {
          return { id: ARYA_QWEN_ENGINE_ROW_ID, name: ARYA_QWEN_ENGINE_MODULE, config: engineConfig(settings) }
        }
        return child
      }),
    }
  })
  return {
    id: ARYA_QWEN_PRESET_ID,
    name: ARYA_QWEN_PRESET_NAME,
    description: ARYA_QWEN_PRESET_DESCRIPTION,
    order: ARYA_QWEN_PRESET_ORDER,
    plugins,
  }
}
