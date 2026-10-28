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
const ReactDOM = require('react-dom')

/**
 * The Shell's own UI primitives. Guarded because the menu row degrades to a plain
 * button when a Shell answers no primitives, and a bundle that throws on load
 * would take every other surface down with it.
 */
const primitives = (() => {
  try {
    return require('@deepseek-ai/dsh-client-ui-primitives')
  } catch {
    return undefined
  }
})()

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

/**
 * One label/value line of the breakdown card.
 *
 * Native stat dialogs are a two-column `<dl>`; a flex div per row looks the same
 * until the labels differ in width, so this emits the grid's own children.
 *
 * @param label - the row name.
 * @param value - the reading.
 * @param key - React key.
 * @returns the `dt`/`dd` pair.
 */
function detailRow(label, value, key) {
  return React.createElement(React.Fragment, { key },
    React.createElement('dt', null, label),
    React.createElement('dd', null, value))
}

/** The small text under the card that keeps the number honest. */
const COST_FOOTNOTE = 'Based on recorded usage and published rates. Your provider\'s bill is authoritative.'

/**
 * The dock pill's skin, copied from the harness statistics pills
 * (`StatsPills.module.css`) so this one sits in the row instead of looking
 * foreign: same size, same tertiary color, same 14px glyph, never wrapped.
 */
const PILL_ANCHOR_STYLE = {
  display: 'inline-flex',
  minWidth: 0,
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',
  lineHeight: 'calc(20px + var(--dsh-content-font-delta-secondary, 0px))',
}

/** The resting pill; hover and open states swap only background and color. */
const PILL_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  boxSizing: 'border-box',
  maxWidth: '100%',
  padding: '1px 8px',
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 4px)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary, inherit)',
  font: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 'inherit',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

/** The label half of the pill, cut with an ellipsis rather than wrapped. */
const PILL_LABEL_STYLE = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

/** The dialog surface, copied from the harness `stat-dialog.module.css` skin. */
const PANEL_STYLE = {
  position: 'fixed',
  zIndex: 1100,
  boxSizing: 'border-box',
  width: 'max-content',
  minWidth: 'min(300px, calc(100vw - 24px))',
  maxWidth: 'min(440px, calc(100vw - 24px))',
  padding: '16px',
  border: 0,
  borderRadius: 'var(--dsw-radius-lg, 12px)',
  background: 'var(--dsw-specific-menu, Canvas)',
  backdropFilter: 'var(--dsw-menu-backdrop-filter, none)',
  boxShadow: 'var(--dsw-elevation-prominent, 0 10px 30px rgba(0, 0, 0, 0.18))',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary, inherit)',
  cursor: 'default',
}

/** Dialog heading row: section name left, headline value right. */
const PANEL_TITLE_STYLE = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  marginBottom: '8px',
  color: 'var(--dsw-alias-label-primary, inherit)',
  fontWeight: 500,
}

/** The rule under a section heading. */
const PANEL_RULE_STYLE = { marginBottom: '10px', borderTop: '0.5px solid var(--dsw-alias-border-l2, currentColor)' }

/** The two-column readings grid. */
const PANEL_DETAILS_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'minmax(76px, auto) minmax(0, 1fr)',
  gap: '6px 16px',
  margin: 0,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
}

/**
 * A 14px coin glyph, the same weight as the harness pill icons. Drawn inline
 * because a plugin face cannot require the icon package without adding it to the
 * frozen module list.
 * @returns the svg element.
 */
function CoinGlyph() {
  return React.createElement('svg', {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    'aria-hidden': true,
    style: { flex: 'none' },
  },
  React.createElement('circle', { cx: 8, cy: 8, r: 6.2 }),
  React.createElement('path', { d: 'M9.6 6.1c-.35-.5-1.85-.86-2.6-.3-.9.66-.35 1.5.75 1.72 1.1.22 2.1.5 1.85 1.5-.3 1.2-2.6 1.3-3.4.5' }),
  React.createElement('path', { d: 'M8 4.4v7.2' }))
}

/**
 * The composer-dock pill, and the breakdown card it opens.
 *
 * Reads the priced projection the Host registers, so no rate table or money
 * arithmetic runs in the browser. The pill is skinned from the harness's own
 * statistics pill so it joins that row instead of standing out of it.
 *
 * @param props - standard session props plus our lazy `configForms`.
 * @returns the pill, or nothing while the feature is off or the session has no usage.
 */
function CostPill(props) {
  const switched = useSwitch(props.configForms, 'sessionCost', true)
  const usage = typeof props.useProjection === 'function' ? props.useProjection('polishCost') : undefined
  const [open, setOpen] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  const [pos, setPos] = React.useState(null)
  const root = React.useRef(null)
  const panel = React.useRef(null)

  // Anchored like the native dialogs: fixed in the viewport, clamped to a 12px
  // margin so a pill near the window edge cannot push the card off screen.
  React.useEffect(() => {
    if (!open) {
      setPos(null)
      return undefined
    }
    if (root.current === null || typeof window === 'undefined') return undefined
    const rect = root.current.getBoundingClientRect()
    const width = Math.min(440, window.innerWidth - 24)
    setPos({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 12 - width)),
      bottom: Math.max(12, window.innerHeight - rect.top + 8),
    })
    return undefined
  }, [open])

  React.useEffect(() => {
    if (!open) return undefined
    const onPointer = event => {
      const insidePill = root.current !== null && root.current.contains(event.target)
      const insidePanel = panel.current !== null && panel.current.contains(event.target)
      if (!insidePill && !insidePanel) setOpen(false)
    }
    const onKey = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!switched) return null
  const tokens = typeof usage?.tokens === 'number' ? usage.tokens : 0
  if (tokens === 0) return null
  const money = formatMoney(usage.costUsd)
  const unpriced = usage.incomplete === true || money === ''
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
      margin: '0 0 12px',
      borderRadius: '999px',
      overflow: 'hidden',
      background: 'color-mix(in srgb, CanvasText 10%, transparent)',
    },
  },
  segment(usage.cacheRead, 22, 'bar-cached'),
  segment(usage.uncached, 48, 'bar-uncached'),
  segment(usage.cacheWrite, 62, 'bar-cache-write'),
  segment(usage.output, 82, 'bar-output'))

  const reading = money === '' ? 'Not priced' : '≈' + money
  const full = reading + (unpriced ? ' — partially priced: some usage has no published rate' : '')
  const pillStyle = { ...PILL_STYLE, ...(hovered || open
    ? { background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.12))', color: 'var(--dsw-alias-label-secondary, inherit)' }
    : {}) }

  const card = React.createElement('div', {
    ref: panel,
    role: 'dialog',
    'aria-label': 'Estimated session cost',
    'data-polish-cost-card': '',
    style: { ...PANEL_STYLE, ...(pos === null ? { left: 12, bottom: 12, visibility: 'hidden' } : pos) },
  },
  React.createElement('div', { style: PANEL_TITLE_STYLE },
    React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
      React.createElement(CoinGlyph),
      'Estimated session cost'),
    React.createElement('span', { style: { fontVariantNumeric: 'tabular-nums' } }, money === '' ? 'Not priced' : money)),
  React.createElement('div', { style: PANEL_RULE_STYLE, 'aria-hidden': true }),
  bar,
  React.createElement('dl', { style: PANEL_DETAILS_STYLE },
    detailRow('Cache hit', cacheHit + '%', 'cache-hit'),
    detailRow('Uncached input', formatTokens(usage.uncached), 'uncached'),
    detailRow('Cached input', formatTokens(usage.cacheRead), 'cached'),
    (usage.cacheWrite ?? 0) > 0 ? detailRow('Cache write', formatTokens(usage.cacheWrite), 'cache-write') : null,
    detailRow('Output', formatTokens(usage.output), 'output'),
    detailRow('Model', modelName, 'model'),
    detailRow('Provider', providerName, 'provider'),
    detailRow('Requests', String(usage.requests ?? 0), 'requests')),
  unpriced
    ? React.createElement('p', { style: { margin: '10px 0 0', color: 'var(--dsw-alias-label-tertiary, inherit)' } },
      'Partially priced: some usage in this session has no published rate, so this is a lower bound.')
    : null,
  React.createElement('p', { style: { margin: '10px 0 0', color: 'var(--dsw-alias-label-tertiary, inherit)' } }, COST_FOOTNOTE))

  return React.createElement('span', { ref: root, style: PILL_ANCHOR_STYLE, 'data-composer-stat': 'polish-cost' },
    React.createElement('button', {
      type: 'button',
      className: undefined,
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-label': full,
      title: full,
      onClick: () => setOpen(!open),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: pillStyle,
    },
    React.createElement(CoinGlyph),
    React.createElement('span', { style: PILL_LABEL_STYLE }, reading),
    unpriced ? React.createElement('span', { style: { color: 'var(--dsw-alias-separator-primary, inherit)' } }, '*') : null),
    open && typeof document !== 'undefined' ? ReactDOM.createPortal(card, document.body) : null)
}

/**
 * How long to wait before trying the balance again, in milliseconds. A Shell that
 * has not finished signing in answers the first read with nothing, and a line that
 * gives up after one attempt would stay empty for the life of the page.
 */
const BALANCE_RETRY_DELAYS = [1500, 5000, 15000, 30000]

/**
 * The remaining-balance line in the sidebar foot.
 *
 * It renders nothing at all when the switch is off, the account exposes no
 * wallet, or the read was refused — an empty line is better than a line that
 * claims a number the Host did not give us.
 *
 * @param props - the slot's `wide` flag, our lazy `configForms`, and the balance reader.
 * @returns the balance line, or null.
 */
function BalanceLine(props) {
  const enabled = useSwitch(props.configForms, 'accountBalance', true)
  const [wallet, setWallet] = React.useState(undefined)
  const read = props.loadBalance
  React.useEffect(() => {
    if (!enabled || typeof read !== 'function') return undefined
    let live = true
    let attempt = 0
    let timer
    const look = () => {
      Promise.resolve()
        .then(() => read())
        .then(view => {
          if (!live) return
          const next = walletOf(view)
          if (next !== undefined) {
            setWallet(next)
            return
          }
          if (attempt < BALANCE_RETRY_DELAYS.length) {
            timer = setTimeout(look, BALANCE_RETRY_DELAYS[attempt])
            attempt += 1
          }
        }, () => {
          if (!live) return
          if (attempt < BALANCE_RETRY_DELAYS.length) {
            timer = setTimeout(look, BALANCE_RETRY_DELAYS[attempt])
            attempt += 1
          }
        })
    }
    look()
    // A window that was hidden through sign-in comes back with an answer the
    // first attempt could not have had; retry from the start when it regains focus.
    const onFocus = () => {
      attempt = 0
      clearTimeout(timer)
      look()
    }
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)
    return () => {
      live = false
      clearTimeout(timer)
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus)
    }
  }, [enabled, read])
  if (!enabled) return null
  // The wrapper stays in the DOM even when there is no number to show, so a
  // reader (and the verification script) can tell "registered but empty" from
  // "not registered at all". An empty flex line costs the layout nothing.
  if (wallet === undefined) {
    return React.createElement('div', { 'data-polish-balance': 'empty', style: { display: 'none' } })
  }
  const money = formatBalance(wallet)
  // The foot is a single row shared with the GitHub entry, so the amount stays
  // bare: a tooltip names it, and nothing here competes for width.
  return React.createElement('div', {
    title: 'Remaining account balance',
    'data-polish-balance': 'ready',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 4px 4px 8px',
      fontSize: '12px',
      lineHeight: '16px',
      flex: '0 0 auto',
      whiteSpace: 'nowrap',
      opacity: 0.75,
      fontVariantNumeric: 'tabular-nums',
    },
  }, money)
}

/**
 * The workspace a Session belongs to.
 *
 * Occupants of `sidebar.workspaces.session.menu.item` address their data by
 * Session id and must not bind or retain the Session, so the workspace is read
 * from the Workspace snapshot at render time and never memoized.
 *
 * @param workspaces - the Shell's Workspace service, when it is loaded.
 * @param sessionId - the row's Session.
 * @returns the owning workspace, or undefined when it cannot be resolved.
 */
function workspaceOf(workspaces, sessionId) {
  if (workspaces === undefined || workspaces === null || sessionId === undefined) return undefined
  let items
  try {
    items = workspaces.list.getSnapshot().items
  } catch {
    return undefined
  }
  if (!Array.isArray(items)) return undefined
  return items.find(item => Array.isArray(item.sessionIds)
    && item.sessionIds.indexOf(sessionId) !== -1
    && typeof item.path === 'string'
    && item.path !== '')
}

/**
 * "Open workspace folder": one row in a Session's "…" menu.
 *
 * It renders nothing when the switch is off or the Session has no workspace the
 * Host could open, because a menu row that cannot act is worse than no row.
 *
 * @param props - the row's Session id, our lazy `configForms`/`workspaces`, the
 *   opener, and the slot's injected `useMenuOpenState` hook.
 * @returns the menu row, or null.
 */
function OpenFolderMenuItem(props) {
  const enabled = useSwitch(props.configForms, 'openWorkspaceFolder', true)
  // Hooks run unconditionally; the row simply renders nothing when it cannot act.
  const menu = typeof props.useMenuOpenState === 'function' ? props.useMenuOpenState() : undefined
  const closeMenu = Array.isArray(menu) && typeof menu[1] === 'function' ? menu[1] : undefined
  const workspace = enabled ? workspaceOf(props.workspaces, props.sessionId) : undefined
  if (!enabled || workspace === undefined) return null
  const label = 'Open workspace folder'
  const onSelect = () => {
    if (closeMenu !== undefined) closeMenu(false)
    const open = props.openFolder
    if (typeof open !== 'function') return
    void Promise.resolve()
      .then(() => open(workspace))
      .catch(error => {
        // A menu row that silently does nothing is unfixable in the field, so the
        // failure is reported instead of dropped. This is the only diagnostic the
        // bundle writes.
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('[aryacode-polish] open workspace folder failed:', error && error.message ? error.message : error)
        }
      })
  }
  if (primitives !== undefined && typeof primitives.MenuItemButton === 'function') {
    const icon = typeof primitives.IconFolderOpenRegular === 'function'
      ? React.createElement(primitives.IconFolderOpenRegular)
      : undefined
    return React.createElement(primitives.MenuItemButton, { icon, onSelect }, label)
  }
  return React.createElement('button', { type: 'button', role: 'menuitem', onClick: onSelect }, label)
}

/** The Host route the GitHub halves talk over. Document-relative, like every app route. */
const GITHUB_ROUTE = 'api/polish.github'

/**
 * Whether the GitHub panel is open. One store for the whole bundle: the footer
 * row opens it, and the overlay panel is the only reader.
 */
const githubStore = (() => {
  let open = false
  const listeners = new Set()
  return {
    isOpen: () => open,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next) {
      if (open === next) return
      open = next
      for (const listener of listeners) listener()
    },
  }
})()

/**
 * Post one action to the GitHub route.
 * @param action - `status`, `repos` or `clone`.
 * @param extra - fields the action needs.
 * @returns the route's `value`, or throws with its own message.
 */
async function githubCall(action, extra) {
  const response = await fetch(GITHUB_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...(extra ?? {}) }),
  })
  const payload = await response.json().catch(() => undefined)
  if (payload === undefined || typeof payload !== 'object') {
    throw new Error(`the Host answered ${String(response.status)}`)
  }
  if (payload.ok !== true) throw new Error(payload.error || 'GitHub request failed')
  return payload.value
}

/** Modal backdrop and panel skin, matching the Shell's own dialogs. */
const GITHUB_BACKDROP_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(16, 18, 22, 0.32)',
}

const GITHUB_CARD_STYLE = {
  ...PANEL_STYLE,
  position: 'static',
  width: 'min(560px, calc(100vw - 32px))',
  maxHeight: 'min(560px, calc(100vh - 64px))',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const GITHUB_LIST_STYLE = {
  marginTop: '10px',
  overflowY: 'auto',
  borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
}

const GITHUB_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '8px 4px',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))',
}

const GITHUB_INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.2))',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
}

/**
 * The add-a-workspace-from-GitHub dialog.
 *
 * Sign-in is the GitHub CLI's own session: the Host asks `gh` for the token it
 * already holds, so this dialog never collects a credential. A clone becomes a
 * workspace through the Workspace Remote, which is the same call the "+" menu
 * makes after its folder picker returns a path.
 *
 * @param props - our lazy `configForms` and the `createWorkspace` opener.
 * @returns the dialog, or null while it is closed or switched off.
 */
function GitHubPanel(props) {
  const open = React.useSyncExternalStore(githubStore.subscribe, githubStore.isOpen)
  const enabled = useSwitch(props.configForms, 'githubWorkspace', true)
  const [phase, setPhase] = React.useState('idle')
  const [account, setAccount] = React.useState(undefined)
  const [repos, setRepos] = React.useState([])
  const [query, setQuery] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState('')

  React.useEffect(() => {
    if (!open || !enabled) return undefined
    let live = true
    setPhase('loading')
    setError('')
    setBusy('')
    setQuery('')
    Promise.resolve()
      .then(() => githubCall('status'))
      .then(status => {
        if (!live) return undefined
        setAccount(status)
        if (status.signedIn !== true) return undefined
        return githubCall('repos').then(list => {
          if (!live) return
          setRepos(Array.isArray(list.repos) ? list.repos : [])
        })
      })
      .then(() => { if (live) setPhase('ready') })
      .catch(reason => {
        if (!live) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setPhase('ready')
      })
    return () => { live = false }
  }, [open, enabled])

  React.useEffect(() => {
    if (!open) return undefined
    const onKey = event => { if (event.key === 'Escape') githubStore.set(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !enabled) return null

  const signedIn = account !== undefined && account.signedIn === true
  const needle = query.trim().toLowerCase()
  const visible = needle === ''
    ? repos
    : repos.filter(repo => `${repo.fullName} ${repo.description}`.toLowerCase().includes(needle))
  const root = account !== undefined && typeof account.root === 'string' ? account.root : ''

  const clone = repo => {
    if (busy !== '') return
    setBusy(repo.fullName)
    setError('')
    Promise.resolve()
      .then(() => githubCall('clone', { owner: repo.owner, name: repo.name }))
      .then(result => Promise.resolve(props.createWorkspace(result.path)).then(() => result))
      .then(result => {
        setBusy('')
        githubStore.set(false)
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info('[aryacode-polish] workspace ready:', result.path)
        }
      })
      .catch(reason => {
        setBusy('')
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  const rows = visible.slice(0, 200).map(repo => React.createElement('button', {
    key: repo.fullName,
    type: 'button',
    style: GITHUB_ROW_STYLE,
    disabled: busy !== '',
    onClick: () => clone(repo),
    title: repo.description === '' ? repo.fullName : `${repo.fullName} — ${repo.description}`,
    'data-polish-github-row': repo.fullName,
  },
  React.createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
    repo.fullName,
    repo.isPrivate ? React.createElement('span', { style: { marginLeft: '6px', opacity: 0.6 } }, 'private') : null,
    repo.isFork ? React.createElement('span', { style: { marginLeft: '6px', opacity: 0.6 } }, 'fork') : null),
  repo.cloned === true
    ? React.createElement('span', { style: { opacity: 0.6 } }, 'cloned')
    : null,
  busy === repo.fullName ? React.createElement('span', { style: { opacity: 0.7 } }, 'cloning…') : null))

  return ReactDOM.createPortal(
    React.createElement('div', {
      style: GITHUB_BACKDROP_STYLE,
      'data-polish-github': 'dialog',
      onPointerDown: event => { if (event.target === event.currentTarget) githubStore.set(false) },
    },
    React.createElement('div', { style: GITHUB_CARD_STYLE, role: 'dialog', 'aria-label': 'Add a workspace from GitHub' },
      React.createElement('div', { style: { ...PANEL_TITLE_STYLE, marginBottom: '4px' } },
        React.createElement('span', null, 'Add a workspace from GitHub'),
        React.createElement('button', {
          type: 'button',
          onClick: () => githubStore.set(false),
          style: { border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', opacity: 0.7 },
          'aria-label': 'Close',
        }, '×')),
      React.createElement('div', { style: { opacity: 0.75, minHeight: '18px' } },
        phase === 'loading' && !signedIn ? 'Checking the GitHub CLI session…' : null,
        signedIn ? `Signed in as ${String(account.login)} · cloning into ${root}` : null,
        !signedIn && phase !== 'loading'
          ? 'The GitHub CLI is not signed in. Run `gh auth login` in a terminal, then reopen this dialog.'
          : null),
      signedIn
        ? React.createElement('input', {
          style: { ...GITHUB_INPUT_STYLE, marginTop: '10px' },
          value: query,
          placeholder: 'Search your repositories',
          'aria-label': 'Search your repositories',
          autoFocus: true,
          onChange: event => setQuery(event.target.value),
        })
        : null,
      error !== ''
        ? React.createElement('div', { style: { marginTop: '10px', color: 'var(--dsw-alias-label-error, #b42318)' } }, error)
        : null,
      signedIn
        ? React.createElement('div', { style: GITHUB_LIST_STYLE, 'data-polish-github-list': String(visible.length) },
          phase === 'loading' && visible.length === 0 ? React.createElement('div', { style: { padding: '10px 4px', opacity: 0.7 } }, 'Loading repositories…') : null,
          phase === 'ready' && visible.length === 0 ? React.createElement('div', { style: { padding: '10px 4px', opacity: 0.7 } }, 'No repository matches that search.') : null,
          ...rows)
        : null,
      React.createElement('p', { style: { margin: '10px 0 0', color: 'var(--dsw-alias-label-tertiary, inherit)' } },
        'The clone is added as a workspace. Sign-in comes from the GitHub CLI, so this plugin stores no token.')))
    , document.body)
}

/**
 * The footer row that opens the GitHub dialog.
 * @param props - our lazy `configForms`.
 * @returns the row, or null when the feature is switched off.
 */
function GithubEntry(props) {
  const enabled = useSwitch(props.configForms, 'githubWorkspace', true)
  if (!enabled) return null
  return React.createElement('div', { style: { padding: '2px 8px 4px', minWidth: 0 } },
    React.createElement('button', {
      type: 'button',
      'data-polish-github': 'entry',
      title: 'Add a workspace from GitHub',
      'aria-label': 'Add a workspace from GitHub',
      onClick: () => githubStore.set(true),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        maxWidth: '100%',
        minWidth: 0,
        padding: '2px 6px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary, inherit)',
        font: 'inherit',
        fontSize: '12px',
        lineHeight: '18px',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
      },
      onMouseEnter: event => { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))' },
      onMouseLeave: event => { event.currentTarget.style.background = 'transparent' },
    },
    React.createElement('svg', {
      width: 14,
      height: 14,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      style: { flex: 'none' },
    },
    React.createElement('path', { d: 'M2.5 5.5h4l1.2 1.5h5.8v6.5h-11z' }),
    React.createElement('path', { d: 'M8 9.8v3.4M6.3 11.5h3.4' })),
    'Add from GitHub'))
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
    // The account Remote namespace is optional: a Shell with no account still gets
    // the Configure page and the cost pill, and only loses the balance line.
    ctx.inject(['remote', 'remote.account'], (accountCtx) => {
      const loadBalance = () => readBalance(accountCtx, CLIENT_VERSION)
      accountCtx.slots.inject('sidebar.footer.action', () => accountCtx.slots.register({
        name: 'sidebar.footer.action',
        id: 'polish-balance',
        order: 3,
        inject: () => ({ configForms, loadBalance }),
      }, BalanceLine))
    })
    // The Workspace service and the Session Remote are both required for the menu
    // row: it reads the folder from the first and opens it through the second.
    // They are declared on the inject list because a Remote namespace may not be
    // read through `ctx.get` — the Shell's guard refuses it.
    ctx.inject(['workspaces', 'remote', 'remote.session'], (workspaceCtx) => {
      const openFolder = async (workspace) => {
        const remote = workspaceCtx.remote.session
        // A Remote method answers an envelope (`{ ok, value }`), not the bare
        // return value; a Shell that answered a plain boolean is tolerated too.
        const answer = await remote.canOpenWorkspacePath()
        const available = answer !== null && typeof answer === 'object'
          ? answer.ok === true && answer.value === true
          : answer === true
        if (!available) throw new Error('this Host cannot open a folder')
        const result = await remote.openWorkspacePath({ path: workspace.path })
        if (result !== null && typeof result === 'object' && 'ok' in result && result.ok !== true) {
          throw new Error('the Host refused to open the folder')
        }
      }
      workspaceCtx.slots.inject('sidebar.workspaces.session.menu.item', () => workspaceCtx.slots.register({
        name: 'sidebar.workspaces.session.menu.item',
        id: 'polish-open-folder',
        order: 460,
        inject: () => ({ configForms, openFolder, workspaces: workspaceCtx.get('workspaces') }),
      }, OpenFolderMenuItem))
    })
    // Adding a workspace from GitHub goes through the Workspace service's own
    // create call — the same one the "+" menu makes once its folder picker
    // returns a path — so a clone lands in the sidebar exactly like a picked
    // folder does, with no Harness change anywhere. The service takes the plain
    // path and throws on refusal; the Remote namespace underneath it is
    // `ctx.remote.workspace` (singular), which is why this injects the service.
    ctx.inject(['workspaces'], (githubCtx) => {
      const createWorkspace = async (path) => {
        const workspace = await githubCtx.workspaces.create({ path })
        return workspace
      }
      githubCtx.slots.inject('shell.overlay', () => githubCtx.slots.register({
        name: 'shell.overlay',
        id: 'polish-github',
        inject: () => ({ configForms, createWorkspace }),
      }, GitHubPanel))
      githubCtx.slots.inject('sidebar.footer.action', () => githubCtx.slots.register({
        name: 'sidebar.footer.action',
        id: 'polish-github-entry',
        order: 4,
        inject: () => ({ configForms }),
      }, GithubEntry))
    })
  },
}
