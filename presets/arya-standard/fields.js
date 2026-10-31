/**
 * The knobs the Arya Standard preset exposes, declared once.
 *
 * Three consumers read this list and nothing else:
 *
 *   - `settings.js` derives the row's schemastery schema and the validated
 *     defaults the host half runs with;
 *   - `scripts/build-client.mjs` inlines it into the browser bundle, so the
 *     Settings page renders the same labels and bounds with no second copy;
 *   - `test/arya-standard.spec.mjs` pins the keys so a rename cannot silently
 *     drop a stored value.
 *
 * A field is `boolean`, `number`, or `text`. Numbers carry the bounds the
 * Settings page shows as a slider or a box, and `integer` marks the counters
 * where a fraction would mean nothing.
 *
 * @module dsh-aryacode-polish-arya-standard-fields
 */

/**
 * Every knob, in the order the Settings page shows them.
 *
 * `retainRatio` keeps a verbatim tail: Codex replaces the whole span, but DSH's
 * loop resumes mid tool-call, so dropping the last step makes the model lose the
 * thread (it stops with the work half-done). The summary still carries Codex's
 * shape and the user's own words; the tail is what keeps the loop continuous.
 *
 * @type {ReadonlyArray<{ key: string, kind: 'boolean' | 'number' | 'text', label: string, description: string, default: boolean | number | string, min?: number, max?: number, step?: number, integer?: boolean, unit?: string }>}
 */
export const ARYA_STANDARD_FIELDS = [
  {
    key: 'auto',
    kind: 'boolean',
    label: 'Compact automatically',
    description: 'Compact before the next step once the context reaches the threshold. Off leaves only /compact.',
    default: true,
  },
  {
    key: 'thresholdRatio',
    kind: 'number',
    label: 'Threshold',
    description: 'Fraction of the context window at which a session compacts. Codex rolls over near the limit; 0.9 leaves room for one more step.',
    default: 0.9,
    min: 0.5,
    max: 0.99,
    step: 0.01,
    unit: 'of the window',
  },
  {
    key: 'headroomTokens',
    kind: 'number',
    label: 'Headroom',
    description: 'Tokens held back from the threshold so the compaction request itself always fits.',
    default: 16000,
    min: 2000,
    max: 200000,
    step: 1000,
    integer: true,
    unit: 'tokens',
  },
  {
    key: 'retainRatio',
    kind: 'number',
    label: 'Verbatim tail',
    description: 'Fraction of the window kept untouched after a checkpoint. Codex keeps nothing verbatim, but a live tool loop needs its last step, so this defaults to DSH’s own 0.16.',
    default: 0.16,
    min: 0.05,
    max: 0.5,
    step: 0.01,
    unit: 'of the window',
  },
  {
    key: 'maxTokens',
    kind: 'number',
    label: 'Checkpoint budget',
    description: 'Cap on the summary the summarizer may write, including the retained user messages.',
    default: 20000,
    min: 1024,
    max: 64000,
    step: 512,
    integer: true,
    unit: 'tokens',
  },
  {
    key: 'keepUserTokens',
    kind: 'number',
    label: 'Keep the user’s words',
    description: 'Up to this many tokens of the most recent real user messages survive verbatim inside the checkpoint, as Codex does. Also capped at half of what is replaced, and dropped entirely when the checkpoint would stop being smaller than its span.',
    default: 20000,
    min: 0,
    max: 200000,
    step: 1000,
    integer: true,
    unit: 'tokens',
  },
  {
    key: 'compactionRetries',
    kind: 'number',
    label: 'Summary retries',
    description: 'How many times a failed summarization call is retried before the turn fails.',
    default: 1,
    min: 0,
    max: 5,
    step: 1,
    integer: true,
  },
  {
    key: 'maxOverflowRetries',
    kind: 'number',
    label: 'Overflow retries',
    description: 'How many times a provider context-window refusal is answered with one more maximal head reduction.',
    default: 1,
    min: 0,
    max: 5,
    step: 1,
  },
  {
    key: 'summarizationProvider',
    kind: 'text',
    label: 'Summarizer provider',
    description: 'Optional. Set both provider and model to summarize on a model other than the session’s own.',
    default: '',
  },
  {
    key: 'summarizationModel',
    kind: 'text',
    label: 'Summarizer model',
    description: 'Optional. Set both provider and model to summarize on a model other than the session’s own.',
    default: '',
  },
]

/**
 * The field a settings value would be compared against, keyed for lookup.
 * @returns {Map<string, object>} the declared fields by key.
 */
export function fieldsByKey() {
  return new Map(ARYA_STANDARD_FIELDS.map((field) => [field.key, field]))
}

/**
 * The declared defaults, as a flat object.
 * @returns {Record<string, boolean | number | string>} one entry per field.
 */
export function fieldDefaults() {
  const defaults = {}
  for (const field of ARYA_STANDARD_FIELDS) defaults[field.key] = field.default
  return defaults
}
