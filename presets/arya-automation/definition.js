/**
 * Arya Automation Engineer as data: the preset definition the registry mounts.
 *
 * Derived from Arya Standard's row list, so the loop behaviour, plan mode, the
 * pruner and the tool rows are the same. Three things differ, and only three:
 *
 *   1. the persona is the engineering contract in `persona.md` plus the same
 *      harness-capabilities section Arya Standard appends;
 *   2. the compaction policy is tuned for read-heavy engineering work: earlier
 *      pre-warm, lower post-turn level, a bigger minimum fold, and less verbatim
 *      user text (an engineer's transcript is mostly quoted tool output);
 *   3. the tool-result pruner keeps more of a large L5X read (16k/8k/2k instead of
 *      8k/4k/1k).
 *
 * The Engineering bundle's own rows are **not** re-mounted: they belong to the
 * installed bundle and stay visible to every session. A preset that repeated them
 * would double-register 142 tools.
 *
 * @module dsh-aryacode-polish-arya-automation-definition
 */

import { buildDefinition as buildAryaStandardDefinition } from '../arya-standard/definition.js'
import { nativePrompt } from '../arya-standard/files.js'
import { engineConfig, policyConfig, readSettings } from '../arya-standard/settings.js'
import { automationPersona } from './files.js'

/** The preset id sessions record in their header. */
export const ARYA_AUTOMATION_PRESET_ID = 'arya-automation'

/** The name the preset picker shows. */
export const ARYA_AUTOMATION_PRESET_NAME = 'Arya Automation Engineer'

/** One line under the name in the picker. */
export const ARYA_AUTOMATION_PRESET_DESCRIPTION = 'Automation-engineering posture for the Engineering bundle: read before writing, act in a copy, verify with the vendor engine, and name the human steps.'

/** Sort position after Arya Qwen (4). */
export const ARYA_AUTOMATION_PRESET_ORDER = 5

/** The row id of the compaction engine inside the preset. */
export const ARYA_AUTOMATION_ENGINE_ROW_ID = 'arya-automation-compaction'

/** The package and subpath the engine row mounts (the Codex kit, shared). */
export const ARYA_AUTOMATION_ENGINE_MODULE = '@aryacode/dsh-aryacode-polish/arya-standard'

/** The row id of the policy row inside the preset. */
export const ARYA_AUTOMATION_POLICY_ROW_ID = 'arya-automation-policy'

/** The package and subpath the policy row mounts. */
export const ARYA_AUTOMATION_POLICY_MODULE = '@aryacode/dsh-aryacode-polish/arya-standard-policy'

/** Engineering compaction defaults, overriding the shared settings group. */
export const ARYA_AUTOMATION_POLICY = Object.freeze({
  preemptivePercent: 65,
  postTurnThresholdPercent: 85,
  minFreedTokens: 6000,
  keepUserTokens: 12000,
})

/** The pruner kept for a large L5X read, instead of Arya Standard's. */
export const ARYA_AUTOMATION_PRUNER = Object.freeze({
  thresholdChars: 16384,
  headChars: 8192,
  tailChars: 2048,
})

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
          prefix: automationPersona().trim() + '\n\n' + nativePrompt(),
        },
      }
    }
    if (row.id !== 'compaction') return row
    return {
      ...row,
      config: row.config.map((child) => {
        if (child.id === 'arya-standard-policy') {
          return {
            id: ARYA_AUTOMATION_POLICY_ROW_ID,
            name: ARYA_AUTOMATION_POLICY_MODULE,
            config: { ...policyConfig(settings), ...ARYA_AUTOMATION_POLICY },
          }
        }
        if (child.id === 'arya-standard-compaction') {
          return { id: ARYA_AUTOMATION_ENGINE_ROW_ID, name: ARYA_AUTOMATION_ENGINE_MODULE, config: engineConfig(settings) }
        }
        if (child.id === 'tool-result-pruner') {
          return { ...child, config: { ...ARYA_AUTOMATION_PRUNER } }
        }
        return child
      }),
    }
  })
  return {
    id: ARYA_AUTOMATION_PRESET_ID,
    name: ARYA_AUTOMATION_PRESET_NAME,
    description: ARYA_AUTOMATION_PRESET_DESCRIPTION,
    order: ARYA_AUTOMATION_PRESET_ORDER,
    plugins,
  }
}
