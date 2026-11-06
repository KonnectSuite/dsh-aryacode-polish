/**
 * Mounting Arya Claude into a Host.
 *
 * The preset is registered with `agentPresets` and released with this plugin's
 * context, exactly like Arya Standard and Arya Qwen. There is no second
 * projection: the Compaction tab folds one `aryaStandard` projection over every
 * session, and this engine commits the same `compaction/*` events, so its
 * checkpoints appear in the same cards without a second wire view.
 *
 * That coupling is stated in `docs/arya-claude.md`: the Claude preset shares Arya
 * Standard's Settings group and its Compaction tab. Turning the Arya Standard
 * feature off leaves the tab without its projection, exactly as it does for Arya
 * Qwen today.
 *
 * A composition without `agentPresets` is a valid composition: the preset is
 * simply absent, and nothing else changes.
 *
 * @module dsh-aryacode-polish-arya-claude-plugin
 */
import { resolveStandDown } from '../billion-context.js'
import { readSettings } from './settings.js'
import { buildDefinition } from './definition.js'

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
 * Resolve an optional service.
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
 * @returns {void} nothing.
 */
function registerPreset(ctx, definition) {
  const presets = service(ctx, 'agentPresets')
  if (presets === undefined || typeof presets.register !== 'function') {
    ctx.logger?.info?.('arya-claude: this composition has no agent preset registry')
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
      ctx.logger?.warn?.(`arya-claude: preset not registered: ${describe(error)}`)
    },
  )
}

/**
 * Mount Arya Claude.
 * @param {object} ctx the feature's own cordis context.
 * @param {unknown} [rawConfig] the row configuration read from the `polish` row.
 * @returns {Promise<void>} resolves once the definition is registered.
 */
export async function mountAryaClaude(ctx, rawConfig) {
  const settings = readSettings(rawConfig)
  const profileContext = service(ctx, 'profileContext')
  // See `presets/billion-context.js`: immediate when bili is absent or already
  // armed, and a bounded wait only when bili is expected but not yet armed.
  const standDownCompaction = await resolveStandDown(ctx, { profileContext })
  registerPreset(ctx, buildDefinition(settings, { profileContext: profileContext !== undefined, standDownCompaction }))
}

/** The mount point a cordis `ctx.plugin()` and the feature registry both accept. */
mountAryaClaude.inject = ['agentPresets']
