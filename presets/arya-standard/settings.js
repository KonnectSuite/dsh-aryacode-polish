/**
 * Arya Standard's policy, validated once for the whole plugin.
 *
 * The row's configuration form is generated from `fields.js`; the form only ever
 * hands back plain JSON, but a hand-edited `cordis.yml` can contain anything, so
 * every value passes through `readSettings()` before the preset definition or the
 * engine row sees it. Out-of-range numbers are clamped, unknown keys are dropped,
 * and a missing group falls back to the declared defaults.
 *
 * The group is deliberately NON-volatile: the host re-runs `apply()` when it
 * changes, which is what lets a knob edit replace the preset definition that
 * sessions created afterwards mount. The feature's on/off switch next to it stays
 * volatile, so flipping that still needs no remount.
 *
 * @module dsh-aryacode-polish-arya-standard-settings
 */
import z from '@deepseek-ai/schemastery'
import { ARYA_STANDARD_FIELDS, fieldDefaults } from './fields.js'

/** The key the settings group occupies inside the `polish` row configuration. */
export const ARYA_STANDARD_SETTINGS_KEY = 'aryaStandardOptions'

/**
 * The declared defaults, frozen so a caller cannot mutate the schema's source.
 * @type {Readonly<Record<string, boolean | number | string>>}
 */
export const ARYA_STANDARD_DEFAULTS = Object.freeze(fieldDefaults())

/**
 * Build the schemastery shape for the settings group.
 *
 * The row already builds its top-level schema with the schemastery instance the
 * host passes to `Config`, so this function takes that instance instead of
 * importing a second copy — the same pattern `entries/registry.js` uses.
 *
 * @param {object} schema the host's schemastery instance, or a compatible stub.
 * @returns {object} one schema per declared field.
 */
export function settingsSchema(schema) {
  const shape = {}
  for (const field of ARYA_STANDARD_FIELDS) {
    if (field.kind === 'boolean') {
      shape[field.key] = schema.boolean().default(field.default).description(field.description)
      continue
    }
    if (field.kind === 'number') {
      let number = schema.number().default(field.default)
      if (typeof field.min === 'number') number = number.min(field.min)
      if (typeof field.max === 'number') number = number.max(field.max)
      shape[field.key] = number.description(field.description)
      continue
    }
    shape[field.key] = schema.string().default(field.default).description(field.description)
  }
  return shape
}

/**
 * The whole group as one schemastery object, for the row's `Config`.
 * @param {object} schema the host's schemastery instance.
 * @returns {object} a schema describing the settings group.
 */
export function aryaStandardSchema(schema) {
  return schema.object(settingsSchema(schema))
}

/**
 * Read one declared field out of a raw group.
 * @param {unknown} value the raw value, possibly a volatile getter reference.
 * @param {object} field the descriptor to validate against.
 * @returns {boolean | number | string} the validated value.
 */
function readField(value, field) {
  const bare = value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
  if (field.kind === 'boolean') return typeof bare === 'boolean' ? bare : field.default
  if (field.kind === 'number') {
    const number = Number(bare)
    if (!Number.isFinite(number)) return field.default
    const lower = typeof field.min === 'number' ? field.min : Number.NEGATIVE_INFINITY
    const upper = typeof field.max === 'number' ? field.max : Number.POSITIVE_INFINITY
    const clamped = Math.min(upper, Math.max(lower, number))
    return field.integer === true ? Math.round(clamped) : clamped
  }
  if (typeof bare === 'string') return bare.trim()
  if (typeof bare === 'number' || typeof bare === 'boolean') return String(bare)
  return field.default
}

/**
 * Validate a raw settings group into the shape the definition and the row use.
 *
 * @param {unknown} raw whatever the row configuration carries under
 *   {@link ARYA_STANDARD_SETTINGS_KEY}, or the whole configuration object.
 * @returns {{ [key: string]: boolean | number | string }} one entry per declared field.
 */
export function readSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const group = source[ARYA_STANDARD_SETTINGS_KEY] !== null && typeof source[ARYA_STANDARD_SETTINGS_KEY] === 'object'
    ? source[ARYA_STANDARD_SETTINGS_KEY]
    : source
  const settings = {}
  for (const field of ARYA_STANDARD_FIELDS) {
    settings[field.key] = readField(group[field.key], field)
  }
  return settings
}

/**
 * The policy fields a compaction engine row accepts, with the empty summarizer
 * pair dropped so the engine follows the session's own routed model.
 *
 * @param {{ [key: string]: boolean | number | string }} settings validated settings.
 * @returns {Record<string, boolean | number | string>} the engine row configuration.
 */
export function engineConfig(settings) {
  const config = {
    auto: settings.auto,
    thresholdRatio: settings.thresholdRatio,
    headroomTokens: settings.headroomTokens,
    retainRatio: settings.retainRatio,
    maxTokens: settings.maxTokens,
    compactionRetries: settings.compactionRetries,
    maxOverflowRetries: settings.maxOverflowRetries,
  }
  const provider = typeof settings.summarizationProvider === 'string' ? settings.summarizationProvider.trim() : ''
  const model = typeof settings.summarizationModel === 'string' ? settings.summarizationModel.trim() : ''
  if (provider.length > 0 && model.length > 0) {
    config.summarizationProvider = provider
    config.summarizationModel = model
  }
  return config
}

/**
 * Whether a raw group differs from the declared defaults.
 * @param {unknown} raw the raw group.
 * @returns {boolean} true when at least one field diverges.
 */
export function isDefaultSettings(raw) {
  const settings = readSettings(raw)
  return ARYA_STANDARD_FIELDS.every((field) => settings[field.key] === field.default)
}
