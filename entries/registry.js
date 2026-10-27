/**
 * The feature list — the one place a quality-of-life feature is declared.
 *
 * One entry is one feature, and one feature is one switch: the row's `Config`
 * schema is derived from this array (see `configSchema`), so adding an entry
 * here is what makes the switch appear in the Configure page. There is no second
 * registration to forget.
 *
 * Entry shape:
 *
 *   {
 *     id: 'spellcheck',            // the config field name and the switch name
 *     label: 'Spelling corrections', // the words the Configure page shows
 *     description: 'Right-click a misspelled word to pick a correction.',
 *     defaultOn: true,             // the switch defaults to on
 *     mount: spellcheck,           // optional host half, a Cordis plugin
 *   }
 *
 * `mount` is the host half: a Cordis plugin object (or function) that this row
 * plugs in when the switch is on and disposes when it is off. A feature with no
 * host work omits `mount` and lives only in the client face.
 *
 * @module dsh-aryacode-polish-registry
 */

/**
 * Every feature this bundle ships. Empty until the first feature lands:
 * spelling corrections are investigated and documented in
 * `docs/parked-spellcheck.md`, and are parked because they need a shell change.
 *
 * @type {ReadonlyArray<{ id: string, label: string, description: string, defaultOn: boolean, mount?: unknown }>}
 */
export const features = []

/**
 * Derive the row's config shape from the feature list.
 *
 * Every field is boolean, defaults to the feature's own default, and is
 * `.volatile()`: a volatile field is committed into the running fiber without a
 * remount, so flipping a switch does not restart the plugin — `apply()` listens
 * for `loader/volatile-update` and mounts or disposes the feature in place.
 *
 * @param z - the schemastery factory (`import z from '@deepseek-ai/schemastery'`).
 * @param list - features to derive from; the real list unless a test passes one.
 * @returns a schema shape: one field per feature.
 */
export function configSchema(z, list = features) {
  const shape = {}
  for (const feature of list) {
    shape[feature.id] = z
      .boolean()
      .default(feature.defaultOn ?? true)
      .volatile()
      .description(feature.description)
  }
  return shape
}
