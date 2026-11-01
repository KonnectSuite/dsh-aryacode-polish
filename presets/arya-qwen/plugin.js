/**
 * Mounting Arya Qwen into a Host.
 *
 * The preset is registered with `agentPresets` and released with this plugin's
 * context, exactly like Arya Standard. There is no second projection: the
 * Compaction tab folds one `aryaStandard` projection over every session, and the
 * Qwen engine commits the same `compaction/*` events, so its checkpoints appear
 * in the same cards without a second wire view.
 *
 * A composition without `agentPresets` is a valid composition: the preset is
 * simply absent, and nothing else changes.
 *
 * @module dsh-aryacode-polish-arya-qwen-plugin
 */

import { readSettings } from '../arya-standard/settings.js'
import { buildDefinition } from './definition.js'

function describe(error) {
  if (error !== null && typeof error === 'object' && typeof error.message === 'string') return error.message
  return String(error)
}

function service(ctx, name) {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/**
 * Mount Arya Qwen.
 * @param {object} ctx the feature's own cordis context.
 * @param {unknown} [rawConfig] the row configuration read from the `polish` row.
 * @returns {Promise<void>} resolves once the definition is registered.
 */
export async function mountAryaQwen(ctx, rawConfig) {
  const settings = readSettings(rawConfig)
  const presets = service(ctx, 'agentPresets')
  if (presets === undefined || typeof presets.register !== 'function') {
    ctx.logger?.info?.('arya-qwen: this composition has no agent preset registry')
    return
  }
  let release
  ctx.effect(() => () => {
    if (typeof release === 'function') release()
  })
  presets.register(buildDefinition(settings)).then(
    (disposer) => {
      release = disposer
    },
    (error) => {
      ctx.logger?.warn?.(`arya-qwen: preset not registered: ${describe(error)}`)
    },
  )
}

/** The mount point a cordis `ctx.plugin()` and the feature registry both accept. */
mountAryaQwen.inject = ['agentPresets']
