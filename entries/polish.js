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
 */
export const Config = z.object(configSchema(z))

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
        if (typeof feature.mount === 'function') mounted.set(feature.id, ctx.plugin(feature.mount))
      } else if (!wanted && running !== undefined) {
        void running.dispose()
        mounted.delete(feature.id)
      }
    }
  }

  sync()
  ctx.on('loader/volatile-update', sync)
}
