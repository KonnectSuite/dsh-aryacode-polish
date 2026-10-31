/**
 * Mounting Arya Standard into a Host.
 *
 * `entries/polish.js` calls this function when the feature switch is on and
 * disposes it when the switch goes off, so everything a Host gains here has to
 * come back out:
 *
 *   - the preset definition is registered with `agentPresets` and its disposer
 *     releases the definition and unmounts its rows;
 *   - the `aryaStandard` projection is registered for the Compaction tab, and it
 *     dies with this plugin's context like the cost projection does.
 *
 * Two shapes of failure are tolerated on purpose. A composition without
 * `agentPresets` or `sessionProjections` simply does not get that surface — the
 * plugin is additive, and a Host without presets is still a valid Host. A duplicate
 * registration (a reload that raced the previous disposer) is logged and dropped,
 * because the preset that is already mounted is the one sessions are using.
 *
 * @module dsh-aryacode-polish-arya-standard-plugin
 */
import { buildDefinition } from './definition.js'
import { createAryaStandardProjection } from './projection.js'
import { readSettings } from './settings.js'

/**
 * Describe a thrown value for a log line.
 * @param {unknown} error whatever was thrown.
 * @returns {string} a short message.
 */
function describe(error) {
  if (error !== null && typeof error === 'object' && typeof error.message === 'string') return error.message
  return String(error)
}

/**
 * Resolve an optional service. A composition that does not provide it is a valid
 * composition, not a failure: the surfaces it would have enabled are simply absent.
 * @param {object} ctx the plugin context.
 * @param {string} name the service name.
 * @returns {any} the service, or undefined.
 */
function service(ctx, name) {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/**
 * Register the preset and release it with this plugin's context.
 * @param {object} ctx the feature's cordis context.
 * @param {object} definition the definition to register.
 */
function registerPreset(ctx, definition) {
  const presets = service(ctx, 'agentPresets')
  if (presets === undefined || typeof presets.register !== 'function') {
    ctx.logger?.info?.('arya-standard: this composition has no agent preset registry')
    return
  }
  let release
  ctx.effect(() => () => {
    if (typeof release === 'function') release()
  })
  presets.register(definition).then(
    (disposer) => {
      release = disposer
    },
    (error) => {
      ctx.logger?.warn?.(`arya-standard: preset not registered: ${describe(error)}`)
    },
  )
}

/**
 * Mount Arya Standard.
 * @param {object} ctx the feature's own cordis context.
 * @param {unknown} [rawConfig] the row configuration read from the `polish` row.
 * @returns {Promise<void>} resolves once the synchronous surfaces are registered.
 */
export async function mountAryaStandard(ctx, rawConfig) {
  const settings = readSettings(rawConfig)
  registerPreset(ctx, buildDefinition(settings))
  const projections = service(ctx, 'sessionProjections')
  if (projections === undefined || typeof projections.register !== 'function') {
    ctx.logger?.info?.('arya-standard: this composition has no session projections')
    return
  }
  await projections.register(createAryaStandardProjection(settings))
}

/**
 * The mount point a cordis `ctx.plugin()` and the feature registry both accept.
 * The `inject` list is what makes the registry ready before `apply` runs.
 */
mountAryaStandard.inject = ['agentPresets']
