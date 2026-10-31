/**
 * Arya Standard in the browser: its settings and its Compaction tab.
 *
 * Three surfaces, one settings model:
 *
 *   - the fields rendered inside the `polish` row's Configure page (the row's
 *     config already appears there, so the preset knobs belong beside the
 *     switches);
 *   - a Settings page of its own, because a preset user may never open the
 *     plugin row;
 *   - a Conversation tab: a dashboard over the folded `aryaStandard` projection
 *     (context pressure, billed input per request, cache reuse, one card per
 *     checkpoint, the failure log) plus a button that runs `/compact` on the
 *     open session.
 *
 * Every colour is a theme token, so the surfaces follow light and dark mode with
 * the rest of the app. Everything reads through the services the Host already
 * exposes: the row config through `configForms`, the checkpoint log through the
 * `aryaStandard` projection, the gauge through `contextPressure`, and compaction
 * itself through the session's own command surface. Nothing here opens a
 * connection or renders a nested document — the data is already in the client.
 *
 * This file is a fragment, not a module: `scripts/build-client.mjs` inlines it
 * ahead of `face.js` inside the same factory, so it uses the `React` those two
 * files share and declares nothing that `face.js` already declares. Every
 * top-level name is `arya`-prefixed for that reason.
 */

/** The switch that mounts and disposes the preset. */
const ARYA_SWITCH = 'aryaStandard'

/** The row config key that holds the policy group. */
const ARYA_GROUP = 'aryaStandardOptions'

/** Characters of a checkpoint body shown before the expand control matters. */
const ARYA_PREVIEW_CHARS = 900

/** The theme tokens this face borrows; names are stable across light and dark. */
const ARYA_THEME = {
  surface: 'var(--dsw-alias-bg-layer-1)',
  surface2: 'var(--dsw-alias-bg-layer-2)',
  overlay: 'var(--dsw-alias-bg-overlay)',
  border: 'var(--dsw-alias-border-l1)',
  borderStrong: 'var(--dsw-alias-border-l2)',
  text: 'var(--dsw-alias-label-primary)',
  muted: 'var(--dsw-alias-label-secondary)',
  brand: 'var(--dsw-alias-brand-primary)',
  ok: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
  bad: 'var(--dsw-alias-state-error-primary)',
  idle: 'var(--dsw-alias-state-idle-primary)',
}

/** A tinted background for a chip or a marker, mixed from its own colour. */
const aryaTint = (colour, strength) => 'color-mix(in srgb, ' + colour + ' ' + String(strength) + '%, transparent)'

const ARYA_FONT_MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

/**
 * Data colours, kept apart from the brand token.
 *
 * The brand token is near-black in this app (it is a button colour), so a chart
 * drawn with it disappears. Series colour is a hue that stays legible on both
 * themes; the state tokens carry the warnings, because those are already tuned
 * for contrast in light and dark.
 */
const ARYA_DATA = '#4f8ff7'
const ARYA_DATA_FILL = 'rgba(79, 143, 247, 0.28)'
const ARYA_FOLD = 'var(--dsw-alias-state-error-primary)'

const ARYA_MUTED = { margin: 0, color: ARYA_THEME.muted, fontSize: '12px', lineHeight: 1.55 }
const ARYA_EYEBROW = {
  margin: '0 0 4px',
  color: ARYA_THEME.muted,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}
const ARYA_CARD = {
  background: ARYA_THEME.surface,
  border: '1px solid ' + ARYA_THEME.border,
  borderRadius: '14px',
  padding: '16px',
  margin: '0 0 12px',
  minWidth: 0,
}
const ARYA_ROW = { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }
const ARYA_TITLE = { margin: 0, fontSize: '15px', fontWeight: 650, letterSpacing: '-0.01em', color: ARYA_THEME.text }
const ARYA_BUTTON = {
  font: 'inherit',
  fontSize: '12.5px',
  fontWeight: 600,
  color: ARYA_THEME.text,
  background: ARYA_THEME.surface2,
  border: '1px solid ' + ARYA_THEME.border,
  borderRadius: '10px',
  padding: '7px 13px',
  cursor: 'pointer',
}
const ARYA_BUTTON_PRIMARY = {
  ...ARYA_BUTTON,
  color: '#ffffff',
  background: ARYA_THEME.brand,
  border: '1px solid ' + ARYA_THEME.brand,
}
const ARYA_INPUT = {
  font: 'inherit',
  fontSize: '12.5px',
  color: ARYA_THEME.text,
  background: ARYA_THEME.surface2,
  border: '1px solid ' + ARYA_THEME.border,
  borderRadius: '9px',
  padding: '6px 9px',
  width: '100%',
  textAlign: 'right',
  boxSizing: 'border-box',
}

/** The defaults, derived from the field list the bundle preamble carries. */
function aryaDefaultOptions() {
  const options = {}
  for (const field of ARYA_FIELDS) options[field.key] = field.default
  return options
}

/**
 * Whether the preset switch is on in a row config value.
 * @param {object | undefined} value the row config value.
 * @returns {boolean} true unless the switch is explicitly off.
 */
function aryaEnabled(value) {
  return value === undefined || value === null || value[ARYA_SWITCH] !== false
}

/**
 * Read the policy group out of a row config value, with defaults filled in.
 * @param {object | undefined} value the row config value.
 * @returns {Record<string, boolean | number | string>} every declared field.
 */
function aryaOptionsOf(value) {
  const options = aryaDefaultOptions()
  const group = value !== undefined && value !== null && typeof value[ARYA_GROUP] === 'object' && value[ARYA_GROUP] !== null ? value[ARYA_GROUP] : {}
  for (const field of ARYA_FIELDS) {
    const raw = group[field.key]
    if (field.kind === 'boolean') {
      options[field.key] = typeof raw === 'boolean' ? raw : field.default
      continue
    }
    if (field.kind === 'number') {
      const number = Number(raw)
      const lower = typeof field.min === 'number' ? field.min : Number.NEGATIVE_INFINITY
      const upper = typeof field.max === 'number' ? field.max : Number.POSITIVE_INFINITY
      options[field.key] = Number.isFinite(number) ? Math.min(upper, Math.max(lower, number)) : field.default
      continue
    }
    options[field.key] = typeof raw === 'string' ? raw : field.default
  }
  return options
}

/**
 * The mutate operations that write a policy group plus the switch.
 * @param {Record<string, boolean | number | string>} options the values to write.
 * @param {boolean} enabled whether the preset stays switched on.
 * @returns {Array<{ op: 'set', path: string[], value: unknown }>} operations for `mutate()`.
 */
function aryaOps(options, enabled) {
  const ops = ARYA_FIELDS.map(field => ({ op: 'set', path: [ARYA_GROUP, field.key], value: options[field.key] }))
  ops.push({ op: 'set', path: [ARYA_SWITCH], value: enabled === true })
  return ops
}

/**
 * Whether a draft differs from the committed row config.
 * @param {object | undefined} value the committed value.
 * @param {object | undefined} current the draft (or committed) value.
 * @returns {boolean} true when a field differs.
 */
function aryaDirty(value, current) {
  const committed = aryaOptionsOf(value)
  const draft = aryaOptionsOf(current)
  return ARYA_FIELDS.some(field => draft[field.key] !== committed[field.key])
}

/**
 * Show one number as a readable string, without trailing zeroes.
 * @param {number} value the number.
 * @returns {string} a short string.
 */
function aryaNumberText(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return number >= 1000 ? Math.round(number).toLocaleString() : String(Math.round(number * 100) / 100)
}

/**
 * Show a token count the way a chart label reads: 31.4k, 262.1k, 1.2M.
 * @param {number} value the count.
 * @returns {string} the compact label.
 */
function aryaCompact(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (number >= 1000000) return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (number >= 1000) return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(Math.round(number))
}

/**
 * A small tinted chip.
 * @param {{ tone?: string, children?: unknown, title?: string }} props the chip.
 * @returns {object} the chip.
 */
function AryaChip(props) {
  const tone = props.tone === undefined ? ARYA_THEME.muted : props.tone
  return React.createElement('span', {
    title: props.title,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: 650,
      letterSpacing: '0.01em',
      lineHeight: 1.6,
      color: tone,
      background: aryaTint(tone, 14),
      border: '1px solid ' + aryaTint(tone, 38),
      whiteSpace: 'nowrap',
    },
  }, props.children)
}

/**
 * One statistic tile.
 * @param {{ label: string, value: string, hint?: string, tone?: string }} props the tile contents.
 * @returns {object} the tile.
 */
function AryaStat(props) {
  return React.createElement('div', {
    style: {
      background: ARYA_THEME.surface2,
      border: '1px solid ' + ARYA_THEME.border,
      borderRadius: '11px',
      padding: '11px 12px',
      minWidth: 0,
    },
  },
  React.createElement('div', { style: { ...ARYA_EYEBROW, margin: '0 0 2px' } }, props.label),
  React.createElement('div', {
    style: {
      fontSize: '21px',
      fontWeight: 660,
      letterSpacing: '-0.02em',
      lineHeight: 1.15,
      color: props.tone === undefined ? ARYA_THEME.text : props.tone,
    },
  }, props.value),
  props.hint === undefined ? null : React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11px', marginTop: '2px' } }, props.hint))
}

/**
 * The editable fields for one policy group.
 * @param {{ options: Record<string, unknown>, enabled: boolean, disabled: boolean, onChange: (key: string, value: unknown) => void }} props
 *   the current values and the writer.
 * @returns {object} the rendered field list.
 */
function AryaSettingsFields(props) {
  const rows = []
  for (const field of ARYA_FIELDS) {
    const id = 'arya-standard-' + field.key
    let input
    if (field.kind === 'boolean') {
      input = React.createElement('input', {
        id,
        type: 'checkbox',
        checked: props.options[field.key] === true,
        disabled: props.disabled,
        onChange: event => props.onChange(field.key, event.target.checked),
        style: { width: '16px', height: '16px', accentColor: ARYA_THEME.brand, cursor: 'pointer' },
      })
    } else if (field.kind === 'number') {
      input = React.createElement('input', {
        id,
        type: 'number',
        value: String(props.options[field.key] ?? field.default),
        min: field.min,
        max: field.max,
        step: field.step ?? 1,
        disabled: props.disabled,
        style: ARYA_INPUT,
        onChange: event => {
          const number = Number(event.target.value)
          props.onChange(field.key, Number.isFinite(number) ? number : field.default)
        },
      })
    } else {
      input = React.createElement('input', {
        id,
        type: 'text',
        value: String(props.options[field.key] ?? ''),
        placeholder: field.key === 'summarizationModel' ? 'the routed model' : 'the routed provider',
        disabled: props.disabled,
        style: { ...ARYA_INPUT, textAlign: 'left' },
        onChange: event => props.onChange(field.key, event.target.value),
      })
    }
    rows.push(React.createElement('div', {
      key: field.key,
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(110px, 168px)',
        alignItems: 'center',
        gap: '10px 16px',
        padding: '9px 0',
        borderTop: '1px solid ' + ARYA_THEME.border,
        opacity: props.enabled ? 1 : 0.55,
      },
    },
    React.createElement('div', { style: { minWidth: 0 } },
      React.createElement('label', {
        htmlFor: id,
        style: { display: 'block', fontSize: '12.5px', fontWeight: 600, color: ARYA_THEME.text, cursor: 'pointer' },
      }, field.label + (field.unit === undefined ? '' : ' · ' + field.unit)),
      React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11px', marginTop: '1px' } }, field.description)),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, input)))
  }
  return React.createElement('div', { style: { margin: '4px 0 14px' } }, rows)
}

/**
 * Mount a row-config-backed settings editor.
 * @param {{ configForms?: () => object | undefined, compact?: boolean }} props the slot props.
 * @returns {object} the rendered editor.
 */
function AryaSettingsEditor(props) {
  const configForms = typeof props.configForms === 'function' ? props.configForms() : props.configForms
  const live = configForms === undefined || configForms === null ? undefined : configForms.get(ROW_ID)
  const subscribe = React.useCallback(listener => (live === undefined ? () => {} : live.subscribe(listener)), [live])
  const snapshot = React.useCallback(() => (live === undefined ? undefined : live.getSnapshot()), [live])
  const state = React.useSyncExternalStore(subscribe, snapshot)
  const [draft, setDraft] = React.useState(null)
  const [saving, setSaving] = React.useState(false)
  const [notice, setNotice] = React.useState('')

  if (live === undefined) {
    return React.createElement('div', { style: ARYA_CARD },
      React.createElement('p', { style: ARYA_MUTED }, 'This composition does not expose row configuration to plugins.'))
  }
  if (state === undefined) {
    return React.createElement('div', { style: ARYA_CARD }, React.createElement('p', { style: ARYA_MUTED }, 'Loading configuration…'))
  }

  const value = state.value === undefined || state.value === null ? {} : state.value
  const current = draft === null ? value : draft
  const enabled = aryaEnabled(current)
  const writable = state.writable === true
  const options = aryaOptionsOf(current)
  const dirty = aryaDirty(value, current) || enabled !== aryaEnabled(value)
  const editable = writable && enabled

  const update = (key, next) => setDraft({ ...current, [ARYA_GROUP]: { ...options, [key]: next } })

  const save = async () => {
    setSaving(true)
    setNotice('')
    try {
      const accepted = await live.mutate(aryaOps(aryaOptionsOf(current), enabled), state.revision)
      if (accepted === false) {
        setNotice('The Host refused the change.')
        return
      }
      setDraft(null)
      setNotice('Saved. Sessions created from now on mount the preset with these values.')
    } catch {
      setNotice('The Host refused the change.')
    } finally {
      setSaving(false)
    }
  }

  return React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'flex-start', gap: '16px' } },
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { style: ARYA_TITLE }, 'Preset definition'),
        React.createElement('p', { style: { ...ARYA_MUTED, marginTop: '3px' } },
          'These values shape the definition a new session mounts: the compaction threshold, what a checkpoint may cost, and how much of your own wording survives inside it.'),
        ),
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: enabled,
          disabled: !writable,
          onChange: event => setDraft({ ...current, [ARYA_SWITCH]: event.target.checked }),
          style: { width: '16px', height: '16px', accentColor: ARYA_THEME.brand, cursor: 'pointer' },
        }),
        React.createElement('span', { style: { fontSize: '12.5px', fontWeight: 600, color: ARYA_THEME.text, whiteSpace: 'nowrap' } }, 'Mounted'))),

    React.createElement(AryaSettingsFields, { options, enabled, disabled: !editable || saving, onChange: update }),

    React.createElement('div', { style: { ...ARYA_ROW, justifyContent: 'flex-start', gap: '12px' } },
      React.createElement('button', {
        type: 'button',
        style: { ...ARYA_BUTTON_PRIMARY, opacity: !writable || !dirty || saving ? 0.45 : 1, cursor: !writable || !dirty || saving ? 'default' : 'pointer' },
        disabled: !writable || !dirty || saving,
        onClick: save,
      }, saving ? 'Saving…' : 'Save changes'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } },
        writable ? (dirty ? 'Unsaved changes.' : 'Saved.') : 'This row is read-only in the current composition.'),
      notice.length === 0 ? null : React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } }, notice)))
}

/**
 * The Settings page entry.
 * @param {object} props the slot props; `configForms` is injected.
 * @returns {object} the page.
 */
function AryaStandardSettingsPage(props) {
  return React.createElement('div', { style: { maxWidth: '820px', padding: '4px 2px 8px' } },
    React.createElement('div', { style: ARYA_EYEBROW }, 'Arya Standard'),
    React.createElement('h2', { style: { margin: '0 0 6px', fontSize: '20px', fontWeight: 680, letterSpacing: '-0.02em', color: ARYA_THEME.text } }, 'Compaction policy'),
    React.createElement('p', { style: { ...ARYA_MUTED, marginBottom: '14px', maxWidth: '640px' } },
      'A coding agent that compacts the way Codex does: one checkpoint replaces the span it summarizes, the checkpoint carries Codex’s handoff framing, and up to 20k tokens of your own messages survive verbatim inside it.'),
    React.createElement(AryaSettingsEditor, { configForms: props.configForms, compact: false }))
}

/**
 * The live context gauge: what the next step would cost, and where the threshold sits.
 * @param {{ used: number, window: number, thresholdRatio: number, headroomTokens: number, thresholdTokens?: number }} props
 *   the numbers.
 * @returns {object} the gauge.
 */
function AryaGauge(props) {
  const contextWindow = Math.max(0, Number(props.window) || 0)
  const used = Math.max(0, Number(props.used) || 0)
  const share = contextWindow > 0 ? Math.min(1, used / contextWindow) : 0
  const threshold = Math.min(0.99, Math.max(0.1, Number(props.thresholdRatio) || 0.9))
  const headroom = Math.max(0, Number(props.headroomTokens) || 0)
  const thresholdTokens = Math.max(0, Number(props.thresholdTokens) || Math.round(contextWindow * threshold))
  const untilThreshold = Math.max(0, thresholdTokens - used)
  const tone = share >= threshold ? ARYA_THEME.warn : ARYA_DATA
  const meter = {
    position: 'relative',
    height: '14px',
    borderRadius: '999px',
    background: aryaTint(ARYA_THEME.muted, 14),
    border: '1px solid ' + ARYA_THEME.border,
    boxSizing: 'border-box',
    margin: '14px 0 6px',
  }
  const fill = {
    position: 'absolute',
    top: '2px',
    bottom: '2px',
    left: '2px',
    width: 'calc(' + Math.max(share > 0 ? 1.2 : 0, share * 100) + '% - 4px)',
    background: share >= threshold
      ? 'linear-gradient(90deg, ' + aryaTint(tone, 55) + ', ' + tone + ')'
      : 'linear-gradient(90deg, ' + ARYA_DATA + ', ' + aryaTint(ARYA_DATA, 55) + ')',
    borderRadius: '999px',
    transition: 'width 160ms ease',
  }
  const mark = {
    position: 'absolute',
    top: '-4px',
    bottom: '-4px',
    left: Math.round(threshold * 1000) / 10 + '%',
    width: '2px',
    borderRadius: '2px',
    background: ARYA_THEME.warn,
    opacity: 0.95,
  }
  const flag = {
    position: 'absolute',
    top: '-20px',
    left: 'calc(' + Math.round(threshold * 1000) / 10 + '% - 16px)',
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: ARYA_THEME.warn,
    whiteSpace: 'nowrap',
  }
  const label = contextWindow > 0
    ? aryaNumberText(used) + ' of ' + aryaNumberText(contextWindow) + ' tokens used'
    : 'Waiting for the first request in this session.'
  return React.createElement('div', null,
    React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'flex-start' } },
      React.createElement('div', null,
        React.createElement('div', { style: ARYA_EYEBROW }, 'Live context'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
          React.createElement('span', { style: { fontSize: '30px', fontWeight: 680, letterSpacing: '-0.03em', lineHeight: 1.05, color: ARYA_THEME.text } },
            aryaCompact(used)),
          React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '13px' } }, 'of ' + aryaCompact(contextWindow) + ' tokens')),
        React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11.5px', marginTop: '2px' } }, label)),
      AryaChip({ tone: share >= threshold ? ARYA_THEME.warn : ARYA_THEME.ok },
        share >= threshold ? 'near threshold' : 'healthy')),
    React.createElement('div', { style: { position: 'relative' } },
      contextWindow > 0 ? React.createElement('span', { style: flag }, Math.round(threshold * 100) + '%') : null,
      React.createElement('div', { style: meter },
        React.createElement('div', { style: fill }),
        contextWindow > 0 ? React.createElement('div', { style: mark }) : null)),
    React.createElement('div', { style: { ...ARYA_ROW, marginTop: '2px' } },
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px' } }, '0'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO } }, Math.round(share * 1000) / 10 + '% used'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px' } }, aryaCompact(contextWindow))),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '10px' } },
      React.createElement('div', null,
        React.createElement('div', { style: ARYA_EYEBROW }, 'Compacts at'),
        React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, color: ARYA_THEME.text } }, Math.round(threshold * 100) + '% · ' + aryaCompact(thresholdTokens))),
      React.createElement('div', null,
        React.createElement('div', { style: ARYA_EYEBROW }, 'Headroom'),
        React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, color: ARYA_THEME.text } }, aryaNumberText(headroom) + ' tokens')),
      React.createElement('div', null,
        React.createElement('div', { style: ARYA_EYEBROW }, 'Room before the fold'),
        React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, color: untilThreshold > 0 ? ARYA_THEME.text : ARYA_THEME.warn } }, aryaCompact(untilThreshold) + ' tokens'))))
}

/**
 * Chart geometry for one value of a series.
 *
 * The chart is drawn in a fixed 1000×160 coordinate space and stretched by CSS, so
 * every stroke carries `vectorEffect: non-scaling-stroke` and stays one pixel wide
 * however wide the tab gets.
 *
 * @param {ReadonlyArray<object>} series the folded usage points.
 * @param {(point: object) => number} pick the value to plot.
 * @param {number} ceiling a floor for the scale, so the window line never clips.
 * @returns {{ width: number, height: number, top: number, x: Function, y: Function, line: string, area: string }}
 *   the geometry.
 */
function aryaChart(series, pick, ceiling) {
  const width = 1000
  const height = 160
  let top = Math.max(1, Number(ceiling) || 0)
  for (const point of series) top = Math.max(top, pick(point))
  const x = index => (series.length <= 1 ? Math.round(width / 2) : Math.round((index / (series.length - 1)) * width))
  const y = value => Math.round(height - Math.min(1, Math.max(0, value / top)) * (height - 6) - 3)
  let line = ''
  for (let index = 0; index < series.length; index += 1) {
    line = line.length === 0 ? x(index) + ',' + y(pick(series[index])) : line + ' ' + x(index) + ',' + y(pick(series[index]))
  }
  const area = series.length < 2 ? '' : '0,' + height + ' ' + line + ' ' + width + ',' + height
  return { width, height, top, x, y, line, area }
}

/**
 * The per-request cache strip: how much of each billed request was already cached.
 * @param {{ series: ReadonlyArray<object>, cacheHitRatio: number }} props the folded usage points.
 * @returns {object | null} the strip.
 */
function AryaCacheStrip(props) {
  const series = props.series
  if (series.length === 0) return null
  const chart = aryaChart(series, point => point.input, 1)
  const slot = chart.width / series.length
  const share = Math.round((Number(props.cacheHitRatio) || 0) * 100)
  const cold = series.every(point => Math.max(0, Number(point.cached) || 0) === 0)
  return React.createElement('div', { style: { ...ARYA_CARD, padding: '14px 16px' } },
    React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'baseline' } },
      React.createElement('div', null,
        React.createElement('div', { style: ARYA_EYEBROW }, 'Cache reuse'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: '7px' } },
          React.createElement('span', { style: { fontSize: '19px', fontWeight: 660, letterSpacing: '-0.02em', color: ARYA_THEME.text } }, share + '%'),
          React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } }, 'of billed input came from cache'))),
      AryaChip({ tone: share >= 50 ? ARYA_THEME.ok : ARYA_THEME.muted }, share >= 50 ? 'warm prefix' : 'cold prefix')),
    cold
      ? React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12px', margin: '10px 0 0' } },
        'No cached reads recorded yet. The strip fills as soon as this provider reports a reused prefix, so a cold session honestly shows nothing.')
      : React.createElement('svg', {
        viewBox: '0 0 ' + chart.width + ' ' + chart.height,
        preserveAspectRatio: 'none',
        style: { width: '100%', height: '40px', display: 'block', marginTop: '10px' },
      }, series.map((point, index) => React.createElement('rect', {
        key: 'cached' + index,
        x: Math.round(index * slot) + 1,
        width: Math.max(1, Math.round(slot) - 2),
        y: chart.y(point.cached),
        height: Math.max(0, chart.height - chart.y(point.cached)),
        fill: ARYA_THEME.ok,
        opacity: 0.55,
        rx: 2,
      }))))
}

/**
 * The context trajectory: billed input per request, the window, the threshold, and
 * one mark per checkpoint so a fold is visible next to the drop it caused.
 * @param {{ series: ReadonlyArray<object>, window: number, thresholdTokens: number, folds: number[] }} props
 *   the series and the two reference lines.
 * @returns {object} the chart.
 */
function AryaTrajectory(props) {
  const series = props.series
  const contextWindow = Math.max(0, Number(props.window) || 0)
  const threshold = Math.max(0, Number(props.thresholdTokens) || 0)
  const folds = Array.isArray(props.folds) ? props.folds : []
  if (series.length === 0) {
    return React.createElement('div', { style: { ...ARYA_CARD, padding: '22px 18px' } },
      React.createElement('div', { style: ARYA_EYEBROW }, 'Context trajectory'),
      React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px', marginTop: '4px' } },
        'No request has been billed in this session yet. The chart draws itself from the first completed request, one point per prompt the model was actually charged for.'))
  }
  const chart = aryaChart(series, point => point.input, Math.max(contextWindow, threshold))
  const marks = []
  for (const seq of folds) {
    let index = -1
    for (let cursor = 0; cursor < series.length; cursor += 1) {
      if (series[cursor].seq >= seq) {
        index = cursor
        break
      }
    }
    if (index >= 0) marks.push(index)
  }
  const grid = ARYA_THEME.border
  const gradientId = 'arya-trajectory-fill'
  const first = new Date(series[0].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const last = new Date(series[series.length - 1].at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const legend = [
    { label: 'input', tone: ARYA_DATA },
    { label: 'threshold', tone: ARYA_THEME.warn },
    { label: 'window', tone: ARYA_THEME.bad },
    { label: 'fold', tone: ARYA_FOLD },
  ]
  return React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'flex-start', marginBottom: '10px' } },
      React.createElement('div', null,
        React.createElement('div', { style: ARYA_TITLE }, 'Context trajectory'),
        React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11.5px', marginTop: '2px' } },
          series.length + (series.length === 1 ? ' request' : ' requests') + ' · oldest first · one point per billed prompt')),
      React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' } },
        AryaChip({ tone: ARYA_DATA }, 'latest ' + aryaCompact(series[series.length - 1].input)),
        legend.map(item => React.createElement('span', {
          key: item.label,
          style: { display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: ARYA_THEME.muted, fontWeight: 600 },
        },
        React.createElement('span', { style: { width: '8px', height: '2px', borderRadius: '2px', background: item.tone } }),
        item.label)))),
    React.createElement('div', { style: { display: 'flex', gap: '10px', alignItems: 'stretch' } },
      React.createElement('div', {
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '46px', textAlign: 'right', fontSize: '10px', color: ARYA_THEME.muted, fontFamily: ARYA_FONT_MONO, padding: '2px 0' },
      },
      React.createElement('span', null, aryaCompact(chart.top)),
      React.createElement('span', null, aryaCompact(chart.top / 2)),
      React.createElement('span', null, '0')),
      React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
        React.createElement('svg', {
          viewBox: '0 0 ' + chart.width + ' ' + chart.height,
          preserveAspectRatio: 'none',
          style: { width: '100%', height: '170px', display: 'block' },
        },
        React.createElement('defs', null,
          React.createElement('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0', y2: '1' },
            React.createElement('stop', { offset: '0%', stopColor: ARYA_DATA, stopOpacity: 0.42 }),
            React.createElement('stop', { offset: '100%', stopColor: ARYA_DATA, stopOpacity: 0.02 }))),
        [0.25, 0.5, 0.75].map(step => React.createElement('line', {
          key: 'grid' + step,
          x1: 0,
          y1: Math.round(chart.height * step),
          x2: chart.width,
          y2: Math.round(chart.height * step),
          stroke: grid,
          strokeWidth: 1,
          strokeDasharray: '2 6',
          vectorEffect: 'non-scaling-stroke',
        })),
        contextWindow > 0 ? React.createElement('line', {
          x1: 0,
          y1: chart.y(contextWindow),
          x2: chart.width,
          y2: chart.y(contextWindow),
          stroke: ARYA_THEME.bad,
          strokeDasharray: '6 4',
          strokeWidth: 1,
          vectorEffect: 'non-scaling-stroke',
        }) : null,
        threshold > 0 ? React.createElement('line', {
          x1: 0,
          y1: chart.y(threshold),
          x2: chart.width,
          y2: chart.y(threshold),
          stroke: ARYA_THEME.warn,
          strokeDasharray: '3 3',
          strokeWidth: 1,
          vectorEffect: 'non-scaling-stroke',
        }) : null,
        chart.area.length === 0 ? null : React.createElement('polygon', { points: chart.area, fill: 'url(#' + gradientId + ')', stroke: 'none' }),
        series.length < 2 ? null : React.createElement('polyline', {
          points: chart.line,
          fill: 'none',
          stroke: ARYA_DATA,
          strokeWidth: 2,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
          vectorEffect: 'non-scaling-stroke',
        }),
        series.length <= 60 ? series.map((point, index) => React.createElement('circle', {
          key: 'dot' + index,
          cx: chart.x(index),
          cy: chart.y(point.input),
          r: 3,
          fill: ARYA_DATA,
          stroke: ARYA_THEME.surface,
          strokeWidth: 1.5,
          vectorEffect: 'non-scaling-stroke',
        })) : null,
        series.length < 2 ? null : marks.map((index, order) => React.createElement('g', { key: 'fold' + order },
          React.createElement('line', {
            x1: chart.x(index),
            y1: 0,
            x2: chart.x(index),
            y2: chart.height,
            stroke: ARYA_FOLD,
            strokeDasharray: '2 4',
            strokeWidth: 1,
            opacity: 0.7,
            vectorEffect: 'non-scaling-stroke',
          }),
          React.createElement('polygon', {
            points: (chart.x(index) - 5) + ',0 ' + (chart.x(index) + 5) + ',0 ' + chart.x(index) + ',7',
            fill: ARYA_FOLD,
            opacity: 0.85,
          })))))),
    React.createElement('div', {
      style: {
        ...ARYA_ROW,
        marginTop: '8px',
        paddingLeft: '56px',
        justifyContent: series.length === 1 ? 'center' : 'space-between',
      },
    },
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO } }, series.length === 1 ? 'billed at ' + first : first),
      series.length === 1 ? null : React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '10.5px', fontFamily: ARYA_FONT_MONO } }, last)),
    React.createElement('div', { style: { ...ARYA_ROW, marginTop: '10px', paddingTop: '10px', borderTop: '1px solid ' + ARYA_THEME.border } },
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } }, 'window ' + aryaNumberText(contextWindow) + ' · threshold ' + aryaNumberText(threshold)),
      marks.length === 0
        ? React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } }, 'no fold yet')
        : React.createElement('span', {
          style: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', color: ARYA_FOLD, whiteSpace: 'nowrap', flexShrink: 0 },
        }, String(marks.length) + (marks.length === 1 ? ' fold' : ' folds'))))
}

/**
 * One checkpoint card.
 * @param {{ checkpoint: object }} props the checkpoint from the projection.
 * @returns {object} the card.
 */
function AryaCheckpointCard(props) {
  const checkpoint = props.checkpoint
  const [open, setOpen] = React.useState(false)
  const long = checkpoint.summary.length > ARYA_PREVIEW_CHARS
  const text = open || !long ? checkpoint.summary : checkpoint.summary.slice(0, ARYA_PREVIEW_CHARS) + '…'
  const when = new Date(checkpoint.at).toLocaleString()
  const model = checkpoint.pin.length > 1 ? checkpoint.pin : 'routed model'
  return React.createElement('div', { style: { ...ARYA_CARD, marginBottom: '10px' } },
    React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'flex-start', gap: '12px' } },
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          AryaChip({ tone: checkpoint.manual ? ARYA_THEME.brand : ARYA_THEME.muted }, checkpoint.manual ? 'manual' : 'automatic'),
          React.createElement('span', { style: { fontFamily: ARYA_FONT_MONO, fontSize: '12.5px', fontWeight: 600, color: ARYA_THEME.text } }, checkpoint.id.slice(0, 8)),
          React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11px' } }, when)),
        React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11px', marginTop: '3px' } }, model)),
      React.createElement('div', { style: { display: 'flex', gap: '14px', flex: '0 0 auto', textAlign: 'right' } },
        React.createElement('div', null,
          React.createElement('div', { style: ARYA_EYEBROW }, 'replaced'),
          React.createElement('div', { style: { fontSize: '14px', fontWeight: 640, color: ARYA_THEME.text } }, String(checkpoint.shadowedNodes))),
        React.createElement('div', null,
          React.createElement('div', { style: ARYA_EYEBROW }, 'freed'),
          React.createElement('div', { style: { fontSize: '14px', fontWeight: 640, color: ARYA_THEME.ok } }, aryaCompact(checkpoint.freedTokens))),
        React.createElement('div', null,
          React.createElement('div', { style: ARYA_EYEBROW }, 'seqs'),
          React.createElement('div', { style: { fontSize: '14px', fontWeight: 640, color: ARYA_THEME.text, fontFamily: ARYA_FONT_MONO } }, checkpoint.startSeq + '–' + checkpoint.endSeq)))),
    React.createElement('div', {
      style: {
        marginTop: '10px',
        background: ARYA_THEME.surface2,
        border: '1px solid ' + ARYA_THEME.border,
        borderRadius: '10px',
        padding: '11px 13px',
      },
    },
    React.createElement('pre', {
      style: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: 0,
        maxHeight: open ? 'none' : '130px',
        overflow: open ? 'visible' : 'hidden',
        fontFamily: ARYA_FONT_MONO,
        fontSize: '11.5px',
        lineHeight: 1.6,
        color: ARYA_THEME.text,
      },
    }, text)),
    long ? React.createElement('button', {
      type: 'button',
      style: { ...ARYA_BUTTON, marginTop: '10px', fontSize: '11.5px', padding: '5px 10px' },
      onClick: () => setOpen(!open),
    }, open ? 'Show less' : 'Show full checkpoint (' + aryaNumberText(checkpoint.summary.length) + ' chars)') : null)
}

/**
 * The log tab: every checkpoint and every failure, oldest first.
 * @param {{ checkpoints: ReadonlyArray<object>, failure: object | null }} props the folded facts.
 * @returns {object} the log.
 */
function AryaLog(props) {
  const rows = []
  for (const checkpoint of props.checkpoints) {
    rows.push({
      at: checkpoint.at,
      tone: ARYA_THEME.ok,
      label: checkpoint.manual ? 'manual' : 'auto',
      text: 'checkpoint ' + checkpoint.id.slice(0, 8) + ' · ' + checkpoint.shadowedNodes + ' nodes replaced · ~' + aryaNumberText(checkpoint.shadowedTokens) + ' tokens · ' + checkpoint.pin,
    })
  }
  if (props.failure !== null && props.failure !== undefined) {
    rows.push({ at: props.failure.at, tone: ARYA_THEME.bad, label: 'failed', text: props.failure.message })
  }
  rows.sort((left, right) => left.at - right.at)
  return React.createElement('div', { style: ARYA_CARD },
    React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
      React.createElement('div', { style: ARYA_TITLE }, 'Compaction log'),
      React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } }, rows.length === 0 ? 'empty' : rows.length + (rows.length === 1 ? ' entry' : ' entries'))),
    rows.length === 0
      ? React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px' } }, 'Nothing logged yet. A checkpoint or a failed attempt appears here, oldest first.')
      : React.createElement('div', null, rows.map((row, index) => React.createElement('div', {
        key: 'log' + index,
        style: {
          display: 'grid',
          gridTemplateColumns: '74px 62px minmax(0, 1fr)',
          gap: '10px',
          alignItems: 'baseline',
          padding: '7px 0',
          borderTop: index === 0 ? 'none' : '1px solid ' + ARYA_THEME.border,
        },
      },
      React.createElement('span', { style: { fontFamily: ARYA_FONT_MONO, fontSize: '10.5px', color: ARYA_THEME.muted } }, new Date(row.at).toLocaleTimeString()),
      AryaChip({ tone: row.tone }, row.label),
      React.createElement('span', { style: { fontSize: '12px', color: row.tone === ARYA_THEME.bad ? ARYA_THEME.bad : ARYA_THEME.text, wordBreak: 'break-word' } }, row.text)))))
}

/**
 * The Compaction tab.
 * @param {object} props the `conversation.view` props; `useProjection`, `sessionId` and
 *   the injected `sessions` client service are read here.
 * @returns {object | null} the tab body.
 */
function AryaCompactionView(props) {
  const record = typeof props.useProjection === 'function' ? props.useProjection('aryaStandard') : undefined
  const pressure = typeof props.useProjection === 'function' ? props.useProjection('contextPressure') : undefined
  const [busy, setBusy] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const [tab, setTab] = React.useState('Overview')

  const view = record !== undefined && record !== null && typeof record === 'object' ? record : {}
  const policy = view.policy !== null && typeof view.policy === 'object' ? view.policy : { thresholdRatio: 0.9, headroomTokens: 16000 }
  const checkpoints = Array.isArray(view.checkpoints) ? view.checkpoints : []
  const series = Array.isArray(view.series) ? view.series : []
  const totals = view.totals !== null && typeof view.totals === 'object' ? view.totals : { requests: 0, input: 0, cached: 0, output: 0 }
  const live = view.window !== null && typeof view.window === 'object' ? view.window : null
  const contextWindow = live !== null ? Number(live.contextWindow) || 0 : pressure !== undefined && pressure !== null ? Number(pressure.contextWindow) || 0 : 0
  const used = pressure !== undefined && pressure !== null ? Number(pressure.pressureTokens) || Number(pressure.projectedTokens) || 0 : 0
  const thresholdTokens = Number(view.thresholdTokens) || 0
  const savedTokens = Number(view.savedTokens) || 0
  const cacheHitRatio = Number(view.cacheHitRatio) || 0
  const folds = checkpoints.map(checkpoint => checkpoint.startSeq)
  const manualCount = checkpoints.filter(checkpoint => checkpoint.manual === true).length
  const autoCount = checkpoints.length - manualCount

  const compactNow = async () => {
    setBusy(true)
    setNotice('')
    try {
      const client = typeof props.sessions === 'function' ? props.sessions() : props.sessions
      const binding = client !== undefined && client !== null && typeof client.binding === 'function' ? client.binding(props.sessionId) : undefined
      const session = binding === undefined ? undefined : binding.session
      if (session === undefined || typeof session.command !== 'function') {
        setNotice('This session is not retained by the browser client.')
        return
      }
      await session.command('/compact')
      setNotice('Compaction requested.')
    } catch {
      setNotice('Could not request compaction.')
    } finally {
      setBusy(false)
    }
  }

  const tabs = React.createElement('div', {
    style: { display: 'flex', gap: '2px', borderBottom: '1px solid ' + ARYA_THEME.border, margin: '0 0 14px' },
  }, ['Overview', 'Trajectory', 'Checkpoints', 'Logs', 'Settings'].map(name => React.createElement('button', {
    key: name,
    type: 'button',
    onClick: () => setTab(name),
    style: {
      font: 'inherit',
      fontSize: '12.5px',
      fontWeight: 600,
      background: 'transparent',
      color: tab === name ? ARYA_THEME.text : ARYA_THEME.muted,
      border: 'none',
      borderBottom: tab === name ? '2px solid ' + ARYA_THEME.brand : '2px solid transparent',
      padding: '7px 11px',
      marginBottom: '-1px',
      cursor: 'pointer',
    },
  }, name)))

  const header = React.createElement('div', { style: { ...ARYA_ROW, alignItems: 'flex-start', gap: '16px', marginBottom: '12px' } },
    React.createElement('div', { style: { minWidth: 0 } },
      React.createElement('div', { style: ARYA_EYEBROW }, 'Arya Standard'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
        React.createElement('h2', { style: { margin: 0, fontSize: '19px', fontWeight: 680, letterSpacing: '-0.02em', color: ARYA_THEME.text } }, 'Context compaction'),
        React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px', fontFamily: ARYA_FONT_MONO } },
          live === null ? 'no route yet' : live.provider + '/' + live.model)),
      React.createElement('div', { style: { ...ARYA_MUTED, fontSize: '11.5px', marginTop: '2px' } },
        'Codex-framed checkpoints · compacts at ' + Math.round((Number(policy.thresholdRatio) || 0.9) * 100) + '% · ' + aryaNumberText(policy.headroomTokens) + ' headroom')),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' } },
      notice.length === 0 ? null : React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11px', maxWidth: '180px' } }, notice),
      React.createElement('button', {
        type: 'button',
        style: { ...ARYA_BUTTON_PRIMARY, opacity: busy ? 0.55 : 1, cursor: busy ? 'default' : 'pointer' },
        disabled: busy,
        onClick: compactNow,
      }, busy ? 'Compacting…' : 'Compact now')))

  let body
  if (tab === 'Trajectory') {
    body = React.createElement('div', null,
      React.createElement(AryaTrajectory, { series, window: contextWindow, thresholdTokens, folds }),
      React.createElement(AryaCacheStrip, { series, cacheHitRatio }))
  } else if (tab === 'Checkpoints') {
    body = checkpoints.length === 0
      ? React.createElement('div', { style: { ...ARYA_CARD, padding: '26px 20px', textAlign: 'center' } },
        React.createElement('div', { style: { ...ARYA_TITLE, marginBottom: '6px' } }, 'No checkpoint yet'),
        React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px', maxWidth: '420px', margin: '0 auto' } },
          'A checkpoint appears here the moment this session compacts — automatically as it nears the threshold, or right away when you run /compact. Each card keeps the replaced span, the tokens it freed, and the summary verbatim.'),
        React.createElement('button', { type: 'button', style: { ...ARYA_BUTTON, marginTop: '12px' }, onClick: compactNow }, 'Compact now'))
      : React.createElement('div', null,
        React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '8px' } },
          React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } },
            checkpoints.length + (checkpoints.length === 1 ? ' checkpoint' : ' checkpoints') + ', newest first'),
          aryaNumberText(savedTokens) === '0' ? null : AryaChip({ tone: ARYA_THEME.ok }, aryaCompact(savedTokens) + ' tokens freed in total')),
        checkpoints.slice().reverse().map(checkpoint => React.createElement(AryaCheckpointCard, { key: checkpoint.id, checkpoint })))
  } else if (tab === 'Logs') {
    body = React.createElement(AryaLog, { checkpoints, failure: view.failure })
  } else if (tab === 'Settings') {
    body = React.createElement(AryaSettingsEditor, { configForms: props.configForms })
  } else {
    const failure = view.failure !== null && view.failure !== undefined
      ? React.createElement('div', {
        style: {
          ...ARYA_CARD,
          borderColor: aryaTint(ARYA_THEME.bad, 40),
          background: aryaTint(ARYA_THEME.bad, 6),
        },
      },
      React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        AryaChip({ tone: ARYA_THEME.bad }, 'last attempt failed'),
        React.createElement('span', { style: { fontSize: '12px', color: ARYA_THEME.text } }, view.failure.message)))
      : null
    const empty = series.length === 0 && checkpoints.length === 0
    body = empty
      ? React.createElement('div', null,
        React.createElement('div', { style: { ...ARYA_CARD, padding: '26px 20px', textAlign: 'center' } },
          React.createElement('div', { style: { ...ARYA_TITLE, marginBottom: '6px' } }, 'Nothing to chart yet'),
          React.createElement('p', { style: { ...ARYA_MUTED, fontSize: '12.5px', maxWidth: '440px', margin: '0 auto' } },
            'Send one message and this dashboard fills in: the context gauge, the trajectory of every billed request, cache reuse, and a card per checkpoint.'),
          React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' } },
            React.createElement('button', { type: 'button', style: ARYA_BUTTON_PRIMARY, onClick: compactNow }, 'Compact now'),
            React.createElement('button', { type: 'button', style: ARYA_BUTTON, onClick: () => setTab('Settings') }, 'Open policy'))),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' } },
          React.createElement(AryaStat, { label: 'Threshold', value: Math.round((Number(policy.thresholdRatio) || 0.9) * 100) + '%', hint: 'of the context window' }),
          React.createElement(AryaStat, { label: 'Headroom', value: aryaNumberText(policy.headroomTokens), hint: 'tokens held back' }),
          React.createElement(AryaStat, { label: 'Verbatim tail', value: String(policy.retainRatio ?? 0.16), hint: 'of the window kept as-is' }),
          React.createElement(AryaStat, { label: 'Checkpoint budget', value: aryaNumberText(policy.maxTokens), hint: 'summary token cap' })))
      : React.createElement('div', null,
        failure,
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '12px', marginBottom: '12px' } },
          React.createElement('div', { style: { ...ARYA_CARD, margin: 0 } },
            React.createElement(AryaGauge, {
              used,
              window: contextWindow,
              thresholdRatio: policy.thresholdRatio,
              headroomTokens: policy.headroomTokens,
              thresholdTokens,
            })),
          React.createElement('div', { style: { ...ARYA_CARD, margin: 0 } },
            React.createElement('div', { style: { ...ARYA_ROW, marginBottom: '10px' } },
              React.createElement('div', { style: ARYA_TITLE }, 'This session'),
              React.createElement('span', { style: { ...ARYA_MUTED, fontSize: '11.5px' } },
                String(totals.requests) + (totals.requests === 1 ? ' request' : ' requests'))),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' } },
              React.createElement(AryaStat, {
                label: 'Checkpoints',
                value: String(checkpoints.length),
                hint: checkpoints.length === 0
                  ? 'none yet'
                  : manualCount + ' manual · ' + autoCount + ' automatic',
              }),
              React.createElement(AryaStat, { label: 'Freed by compaction', value: aryaCompact(savedTokens), hint: 'tokens dropped from the prompt', tone: savedTokens > 0 ? ARYA_THEME.ok : undefined }),
              React.createElement(AryaStat, { label: 'Input tokens', value: aryaCompact(totals.input), hint: 'including cached' }),
              React.createElement(AryaStat, { label: 'Cache hit', value: Math.round(cacheHitRatio * 100) + '%', hint: aryaCompact(totals.cached) + ' read from cache' })))),
        React.createElement(AryaTrajectory, { series, window: contextWindow, thresholdTokens, folds }),
        React.createElement(AryaCacheStrip, { series, cacheHitRatio }))
  }

  return React.createElement('div', { style: { padding: '14px 4px 6px', maxWidth: '1080px' } }, header, tabs, body)
}
