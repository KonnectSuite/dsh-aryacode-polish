/**
 * @aryacode/dsh-aryacode-polish — the browser face bundle.
 *
 * GENERATED FILE. Edit client/face.js or client/switches.json and run
 * `pnpm build:client`; nothing here should be hand-edited.
 */
window.__ModuleLoader__.load({
  id: "@aryacode/dsh-aryacode-polish",
  factory: (require) => {
    const SWITCHES = [
      {
        "key": "sessionCost",
        "label": "Estimated session cost",
        "description": "Show what the open session has cost so far, priced from recorded usage at the published DeepSeek rates.",
        "defaultOn": true
      }
    ]
    const ROW_ID = "polish"
    const ROW_KEY = "@aryacode/dsh-aryacode-polish" + '#' + ROW_ID

    /**
     * AryaCode Polish — the browser face.
     *
     * This file is deliberately not a module. `scripts/build-client.mjs` wraps it in
     * the Shell's `__ModuleLoader__.load({ id, factory })` factory and prepends the
     * switch list from `client/switches.json`, so `require` is the Shell's frozen
     * module table and never Node's `require`. Keep `require(...)` limited to names
     * the Shell answers; anything else must be inlined here.
     *
     * The Configure page is the point of this package: one boolean per feature, on
     * by default, and the host half of a feature is disposed when its switch turns
     * off. The page reads the row's live config form, so adding a feature needs no
     * second registration here — one line in `client/switches.json` and a matching
     * entry in `entries/registry.js`, and the tests fail if the two disagree.
     */

    const React = require('react')

    /** Shared spacing for the page's prose. */
    const SPACING = { margin: '0 0 10px', opacity: 0.85, lineHeight: '1.5' }

    /**
     * Read one switch out of a configuration object.
     * @param value - the row's configuration object, when it has loaded.
     * @param entry - the declared switch.
     * @returns the boolean the switch holds, falling back to its declared default.
     */
    function switchValue(value, entry) {
      const current = value === undefined || value === null ? undefined : value[entry.key]
      if (typeof current === 'boolean') return current
      return entry.defaultOn !== false
    }

    /**
     * Subscribe to one switch of this row's live configuration.
     * @param configForms - the Shell's config-form service, or a getter for it.
     * @param key - the switch to read.
     * @param fallback - the value to use while the row's configuration has not loaded.
     * @returns the switch's boolean value.
     */
    function useSwitch(configForms, key, fallback) {
      const resolved = typeof configForms === 'function' ? configForms() : configForms
      const live = resolved === undefined ? undefined : resolved.get(ROW_ID)
      const subscribe = React.useCallback(
        listener => (live === undefined ? () => {} : live.subscribe(listener)),
        [live],
      )
      const snapshot = React.useCallback(
        () => (live === undefined ? undefined : live.getSnapshot()),
        [live],
      )
      const state = React.useSyncExternalStore(subscribe, snapshot)
      const value = state?.value
      const current = value === undefined || value === null ? undefined : value[key]
      return typeof current === 'boolean' ? current : fallback
    }

    /**
     * The row's Configure page and its one-line summary.
     * @param props - the page's `view`, the Host's `form`, and our lazy `configForms`.
     * @returns the page node, the summary node, or a status line.
     */
    function PolishConfig(props) {
      const { form, view } = props

      // Resolved lazily: the Settings page's own client half may load after this face.
      const configForms = typeof props.configForms === 'function' ? props.configForms() : props.configForms
      const live = configForms === undefined ? undefined : configForms.get(ROW_ID)
      const subscribe = React.useCallback(
        listener => (live === undefined ? () => {} : live.subscribe(listener)),
        [live],
      )
      const snapshot = React.useCallback(
        () => (live === undefined ? form?.state : live.getSnapshot()),
        [live, form],
      )
      const state = React.useSyncExternalStore(subscribe, snapshot)
      const [draft, setDraft] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [notice, setNotice] = React.useState('')

      const count = SWITCHES.length
      const summary = count === 0 ? 'No switch registered yet.' : count === 1 ? '1 switch.' : count + ' switches.'

      if (view === 'summary') return React.createElement('span', null, summary)

      if (count === 0) {
        return React.createElement('div', null,
          React.createElement('p', { style: SPACING },
            'No switch is registered yet. This page grows one checkbox per feature as features land; '
            + 'there is nothing here that can be toggled into a half-installed state.'),
          React.createElement('p', { style: SPACING },
            'A feature needs two lines: an entry in ',
            React.createElement('code', null, 'entries/registry.js'),
            ' that declares its switch and host half, and a matching entry in ',
            React.createElement('code', null, 'client/switches.json'),
            ' that names it here. The tests fail if the two disagree.'),
        )
      }

      if (state === undefined) {
        return React.createElement('p', { style: SPACING }, 'This row does not expose its configuration to the Plugins page.')
      }
      const value = state.value
      if (value === undefined) {
        return React.createElement('p', { style: SPACING },
          state.status === 'unavailable' ? 'This row has no configuration to change.' : 'Loading configuration…')
      }

      const current = draft === null ? value : draft
      const dirty = SWITCHES.some(entry => switchValue(current, entry) !== switchValue(value, entry))
      const writable = state.writable === true
      const setSwitch = (key, next) => {
        setDraft({ ...current, [key]: next })
        setNotice('')
      }
      const save = async () => {
        if (saving || !dirty) return
        setSaving(true)
        setNotice('')
        try {
          const ops = SWITCHES.map(entry => ({ op: 'set', path: [entry.key], value: switchValue(current, entry) }))
          const owner = live === undefined ? form : live
          const accepted = await owner.mutate(ops, state.revision)
          if (accepted) {
            setDraft(null)
            setNotice('Saved. A feature switched off stops running now, not after a restart.')
          } else {
            setNotice('The Host refused the change.')
          }
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error))
        }
        setSaving(false)
      }

      return React.createElement('div', { style: { display: 'grid', gap: '16px' } },
        React.createElement('p', { style: SPACING },
          'Every switch is additive and on by default. Switching one off disposes that feature only — '
          + 'it stops costing the app instead of merely hiding.'),
        React.createElement('div', { style: { display: 'grid', gap: '14px' } },
          SWITCHES.map(entry => React.createElement('label', {
            key: entry.key,
            style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', alignItems: 'start', cursor: writable ? 'pointer' : 'default' },
          },
          React.createElement('input', {
            type: 'checkbox',
            checked: switchValue(current, entry),
            disabled: !writable || saving,
            onChange: event => setSwitch(entry.key, event.target.checked),
          }),
          React.createElement('span', null,
            React.createElement('span', { style: { display: 'block', fontWeight: 600 } }, entry.label),
            React.createElement('span', { style: { display: 'block', opacity: 0.8, lineHeight: '1.45' } }, entry.description),
          ))),
        ),
        React.createElement('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
          React.createElement('button', {
            type: 'button',
            disabled: !writable || saving || !dirty,
            onClick: save,
          }, saving ? 'Saving…' : 'Save'),
          React.createElement('span', { style: { opacity: 0.8 } },
            notice !== '' ? notice : writable ? '' : 'This row is read-only in the current composition.')),
      )
    }

    /** Money from the wire view, which already did the arithmetic host-side. */
    function formatMoney(value) {
      const amount = Number(value)
      if (!Number.isFinite(amount) || amount <= 0) return ''
      // Pennies matter at the top and single tokens matter at the bottom: a small
      // turn really does cost a fraction of a cent, and "$0" would hide it.
      const fixed = amount >= 1 ? amount.toFixed(2)
        : amount >= 0.01 ? amount.toFixed(3)
          : amount.toPrecision(2)
      const text = fixed.includes('e') ? amount.toFixed(8) : fixed
      return '$' + text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    }

    /** Token counts, grouped, the way the harness pill next to ours reads. */
    function formatTokens(value) {
      const count = Number(value)
      return Number.isFinite(count) ? new Intl.NumberFormat('en-US').format(count) + ' tok' : ''
    }

    /** One label/value line of the breakdown card. */
    function detailRow(label, value, key) {
      return React.createElement('div', {
        key,
        style: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '2px 0' },
      },
      React.createElement('span', { style: { opacity: 0.75 } }, label),
      React.createElement('span', null, value))
    }

    /** The small text under the card that keeps the number honest. */
    const COST_FOOTNOTE = 'Based on recorded usage and published rates. Your provider\'s bill is authoritative.'

    /**
     * The composer-dock pill, and the breakdown card it opens.
     * Reads the priced projection the Host registers, so no rate table or money
     * arithmetic runs in the browser.
     * @param props - standard session props plus our lazy `configForms`.
     * @returns the pill, or nothing while the feature is off or the session has no usage.
     */
    function CostPill(props) {
      const switched = useSwitch(props.configForms, 'sessionCost', true)
      const usage = typeof props.useProjection === 'function' ? props.useProjection('polishCost') : undefined
      const [open, setOpen] = React.useState(false)
      const root = React.useRef(null)

      React.useEffect(() => {
        if (!open) return undefined
        const close = event => {
          if (root.current !== null && !root.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('pointerdown', close)
        return () => document.removeEventListener('pointerdown', close)
      }, [open])

      if (!switched) return null
      const tokens = typeof usage?.tokens === 'number' ? usage.tokens : 0
      if (tokens === 0) return null
      const money = formatMoney(usage.costUsd)
      const label = money === '' ? 'Not priced' : (usage.incomplete ? '≈' + money + ' partially priced' : '≈' + money)
      const cacheHit = tokens === 0 ? 0 : Math.round((usage.cacheRead ?? 0) / tokens * 100)
      const models = Array.isArray(usage.models) ? usage.models : []

      const modelName = models.length === 0 ? 'unknown'
        : models.length === 1 ? models[0].model
          : models.length + ' models'
      const providerName = models.length === 0 ? 'unknown'
        : models.length === 1 ? models[0].provider
          : models.length + ' providers'
      const segment = (value, shade, key) => {
        const countValue = Number(value ?? 0)
        if (!Number.isFinite(countValue) || countValue <= 0) return null
        return React.createElement('div', {
          key,
          style: { flexGrow: countValue, background: 'color-mix(in srgb, CanvasText ' + shade + '%, transparent)' },
        })
      }
      const bar = React.createElement('div', {
        style: {
          display: 'flex',
          height: '6px',
          margin: '10px 0 12px',
          borderRadius: '999px',
          overflow: 'hidden',
          background: 'color-mix(in srgb, CanvasText 10%, transparent)',
        },
      },
      segment(usage.cacheRead, 22, 'bar-cached'),
      segment(usage.uncached, 48, 'bar-uncached'),
      segment(usage.cacheWrite, 62, 'bar-cache-write'),
      segment(usage.output, 82, 'bar-output'))

      return React.createElement('div', {
        ref: root,
        style: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
      },
      React.createElement('button', {
        type: 'button',
        onClick: () => setOpen(!open),
        title: 'Estimated session cost',
        style: {
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          padding: '0 2px',
          opacity: 0.8,
        },
      }, label),
      open
        ? React.createElement('div', {
          style: {
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '8px',
            width: '320px',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid color-mix(in srgb, CanvasText 16%, transparent)',
            background: 'Canvas',
            color: 'CanvasText',
            boxShadow: '0 10px 30px color-mix(in srgb, CanvasText 18%, transparent)',
            fontSize: '12px',
            lineHeight: '1.5',
            zIndex: 40,
          },
        },
        React.createElement('div', {
          style: { display: 'flex', justifyContent: 'space-between', gap: '16px', fontWeight: 500 },
        },
        React.createElement('span', null, 'Estimated session cost'),
        React.createElement('span', null, label)),
        bar,
        detailRow('Cache hit', cacheHit + '%', 'cache-hit'),
        detailRow('Uncached input', formatTokens(usage.uncached), 'uncached'),
        detailRow('Cached input', formatTokens(usage.cacheRead), 'cached'),
        (usage.cacheWrite ?? 0) > 0 ? detailRow('Cache write', formatTokens(usage.cacheWrite), 'cache-write') : null,
        detailRow('Output', formatTokens(usage.output), 'output'),
        detailRow('Model', modelName, 'model'),
        detailRow('Provider', providerName, 'provider'),
        detailRow('Requests', String(usage.requests ?? 0), 'requests'),
        React.createElement('div', { style: { borderTop: '1px solid color-mix(in srgb, CanvasText 12%, transparent)', margin: '8px 0' } }),
        detailRow('Estimated session cost', money === '' ? 'Not priced' : money, 'cost'),
        React.createElement('p', { style: { margin: '10px 0 0', opacity: 0.7, fontSize: '11px' } }, COST_FOOTNOTE))
        : null)
    }

    return {
      inject: ['slots'],
      /**
       * Register this bundle's surfaces.
       * @param ctx - the browser plugin context.
       */
      apply(ctx) {
        const configForms = () => {
          try {
            return ctx.get('configForms')
          } catch {
            return undefined
          }
        }
        ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
          name: 'plugins.row.config',
          key: ROW_KEY,
          inject: () => ({ configForms }),
        }, PolishConfig))
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'polish-cost',
          order: 2,
          inject: () => ({ configForms }),
        }, CostPill))
      },
    }
  },
})
