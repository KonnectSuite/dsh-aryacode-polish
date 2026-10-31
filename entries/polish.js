/**
 * The `polish` row: every feature of the bundle behind one switch each.
 *
 * Mounting this row mounts the host half of each enabled feature. A feature that
 * is switched off is disposed, not just ignored, so its listeners and routes go
 * away — a switch that only hid behaviour would keep costing the app.
 *
 * @module dsh-aryacode-polish
 */
import z from '@deepseek-ai/schemastery'
import { ARYA_STANDARD_SETTINGS_KEY, aryaStandardSchema } from '../presets/arya-standard/settings.js'
import { flag } from './config.js'
import { configSchema, features } from './registry.js'

/** The plugin name inside a composition. */
export const name = 'aryacode-polish'

/** No services are required; features that need one declare it in their own module. */
export const inject = []

export { features }

/**
 * The row's config: one volatile boolean per registered feature, derived from
 * `entries/registry.js` so a new feature gains its switch automatically.
 *
 * `aryaStandardOptions` is the one non-volatile group. A volatile field is applied
 * in place, which is right for a switch and wrong for a preset knob: the definition
 * is built at mount time, so a knob edit has to re-run `apply()` and rebuild it.
 */
export const Config = z.object({
  ...configSchema(z),
  [ARYA_STANDARD_SETTINGS_KEY]: aryaStandardSchema(z),
})

/**
 * Mount the enabled features and follow the switches at runtime.
 *
 * @param ctx - plugin context.
 * @param config - the row config; every field is a volatile reference, not a value.
 */
export function apply(ctx, config = {}) {
  /** @type {Map<string, { dispose: () => unknown }>} */
  const mounted = new Map()

  // The loader commits a volatile-only change into the live references and emits
  // `loader/volatile-update` instead of re-running apply(), so the switches have
  // to mount and dispose their feature in place — otherwise the page would claim
  // a feature is on while nothing is running.
  const sync = () => {
    for (const feature of features) {
      const wanted = flag(config[feature.id], feature.defaultOn ?? true)
      const running = mounted.get(feature.id)
      if (wanted && running === undefined) {
        if (typeof feature.mount === 'function') {
          // A feature may derive its mount config from the row config — the Arya
          // Standard preset reads its policy group here, once per mount.
          const mountConfig = typeof feature.config === 'function' ? feature.config(config) : undefined
          mounted.set(feature.id, ctx.plugin(feature.mount, mountConfig))
        }
      } else if (!wanted && running !== undefined) {
        void running.dispose()
        mounted.delete(feature.id)
      }
    }
  }

  sync()
  ctx.on('loader/volatile-update', sync)
}
