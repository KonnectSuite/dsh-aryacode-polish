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
 * The row's Configure page and its one-line summary.
 * @param props - the page's `view`, the Host's `form`, and our lazy `configForms`.
 * @returns the page node, the summary node, or a status line.
 */
function PolishConfig(props) {
  const React = require('react')
  const { form, view } = props

  // Resolved lazily: the Settings page's own client half may load after this face.
  const configForms = typeof props.configForms === 'function' ? props.configForms() : props.configForms
  const live = configForms === undefined ? undefined : configForms.get(ROW_KEY)
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

return {
  inject: ['slots'],
  /**
   * Register this bundle's row configuration page.
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
  },
}
