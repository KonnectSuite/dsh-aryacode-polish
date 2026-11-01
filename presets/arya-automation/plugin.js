/**
 * Mounting Arya Automation Engineer into a Host.
 *
 * Identical in shape to the other presets: register with `agentPresets`, release
 * with this plugin's context, tolerate a composition without a preset registry.
 *
 * @module dsh-aryacode-polish-arya-automation-plugin
 */

import { readSettings } from '../arya-standard/settings.js'
import { buildDefinition } from './definition.js'
import { createAryaAutomationProjection } from './projection.js'

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
 * Mount Arya Automation Engineer.
 * @param {object} ctx the feature's own cordis context.
 * @param {unknown} [rawConfig] the row configuration read from the `polish` row.
 * @returns {Promise<void>} resolves once the definition is registered.
 */
export async function mountAryaAutomation(ctx, rawConfig) {
  const settings = readSettings(rawConfig)
  const presets = service(ctx, 'agentPresets')
  if (presets === undefined || typeof presets.register !== 'function') {
    ctx.logger?.info?.('arya-automation: this composition has no agent preset registry')
  } else {
    let release
    ctx.effect(() => () => {
      if (typeof release === 'function') release()
    })
    presets.register(buildDefinition(settings)).then(
      (disposer) => {
        release = disposer
      },
      (error) => {
        ctx.logger?.warn?.(`arya-automation: preset not registered: ${describe(error)}`)
      },
    )
  }
  // The ledger is registered whether or not the preset is: a session on another
  // preset that happens to use the engineering tools still gets the tab.
  const projections = service(ctx, 'sessionProjections')
  if (projections === undefined || typeof projections.register !== 'function') {
    ctx.logger?.info?.('arya-automation: this composition has no session projections')
    return
  }
  await projections.register(createAryaAutomationProjection())
}

/** The mount point a cordis `ctx.plugin()` and the feature registry both accept. */
mountAryaAutomation.inject = ['agentPresets']
