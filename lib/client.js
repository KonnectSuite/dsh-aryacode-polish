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
      },
      {
        "key": "accountBalance",
        "label": "Account balance",
        "description": "Show the remaining account balance in the sidebar foot, above the account row.",
        "defaultOn": true
      },
      {
        "key": "openWorkspaceFolder",
        "label": "Open workspace folder",
        "description": "Add an “Open workspace folder” row to a Session’s menu that opens its workspace in the file browser.",
        "defaultOn": true
      }
    ]
    const ROW_ID = "polish"
    const ROW_KEY = "@aryacode/dsh-aryacode-polish" + '#' + ROW_ID
    const CLIENT_VERSION = "0.4.4"

    /**
     * The two pure decisions behind the balance line: which wallet to show, and how
     * to render it.
     *
     * They live in their own file because the browser face bundle is only ever run
     * inside the Shell, where nothing can be imported and asserted — so the build
     * inlines this module into `lib/client.js` (with the `export` keywords dropped)
     * while `test/money.spec.mjs` imports it directly. What the test covers is
     * therefore the same source the browser runs, not a copy of it.
     */

    /**
     * Pick the wallet a balance line should show.
     * @param view - the balance view the account Remote returned.
     * @returns the first wallet carrying a balance, or undefined when the view has none.
     */
    function walletOf(view) {
      if (view === undefined || view === null || view.status !== 'ready' || !Array.isArray(view.value)) return undefined
      return view.value.find(wallet => wallet !== null && typeof wallet === 'object' && typeof wallet.balance === 'string')
    }

    /**
     * Format one wallet as money.
     * @param wallet - a wallet with `currency` and `balance`.
     * @returns the amount with its currency symbol, at two decimals.
     */
    function formatBalance(wallet) {
      const symbol = wallet.currency === 'CNY' ? '\u00A5' : '$'
      const amount = Number(wallet.balance)
      return Number.isFinite(amount) ? symbol + amount.toFixed(2) : symbol + String(wallet.balance)
    }

    /**
     * Reading the account balance from a plugin face.
     *
     * The account Remote methods are the same ones the shipped account row uses. An
     * earlier version waited for the host account bundle's own access grant before
     * reading, on the theory that the grant proves the call is allowed. It does not:
     * that grant belongs to the bundle that owns the account stream, and a plugin
     * that waits for it can wait forever — the sidebar line then stays empty with no
     * error anywhere, which is exactly what a user reports as "I don't see the
     * balance".
     *
     * So this reads directly. The Host still decides: an unauthorised call comes back
     * `{ ok: false }` (or throws) and this resolves to `undefined`. Every failure — no
     * account namespace in this Shell, a refused call, a failed call — resolves to
     * `undefined` instead of throwing, because a sidebar line is never worth breaking
     * the shell over.
     *
     * This module is inlined into `lib/client.js` by `scripts/build-client.mjs` and
     * imported directly by `test/account.spec.mjs`, so the tested source is the one
     * the browser runs.
     */

    /**
     * Build the account request identity for one balance read.
     *
     * The shipped account bundle inlines `DSH_CLIENT_VERSION` at build time; a plugin
     * bundle has no such define, so the build stamps this package's own version and
     * prefers the shell's value when one is inlined.
     *
     * @param version - the version this build stamps.
     * @returns the metadata the account Remote methods carry.
     */
    function clientMetadata(version) {
      const stamped = typeof process !== 'undefined' && process.env !== undefined ? process.env.DSH_CLIENT_VERSION : undefined
      return {
        version: typeof stamped === 'string' && stamped !== '' ? stamped : version,
        locale: typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language !== ''
          ? navigator.language
          : 'en',
        timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
      }
    }

    /**
     * The account Remote namespace, or undefined when this Shell has none.
     *
     * @param ctx - the browser plugin context; the balance surface is registered
     *   inside `ctx.inject(['remote', 'remote.account'], …)` so this normally resolves.
     * @returns the namespace, or undefined.
     */
    function accountService(ctx) {
      try {
        const remote = ctx.remote !== undefined ? ctx.remote : ctx.get('remote')
        const account = remote !== undefined && remote !== null ? remote.account : undefined
        return account !== undefined && account !== null && typeof account.getBalance === 'function' ? account : undefined
      } catch {
        return undefined
      }
    }

    /**
     * Read the balance once.
     *
     * @param ctx - the browser plugin context.
     * @param version - the version this build stamps into the account metadata.
     * @param options - `timeoutMs` bounds a call that never settles.
     * @returns the ready balance view, or undefined when there is no number to show.
     */
    async function readBalance(ctx, version, { timeoutMs = 15000 } = {}) {
      const account = accountService(ctx)
      if (account === undefined) return undefined
      const call = (async () => {
        const result = await account.getBalance(clientMetadata(version))
        if (result === undefined || result === null || result.ok !== true) return undefined
        const value = result.value
        return value !== undefined && value !== null && value.status === 'ready' ? value : undefined
      })().catch(() => undefined)
      let timer
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve(undefined), timeoutMs)
        // A pending balance read must not keep a Node process alive during tests.
        if (typeof timer === 'object' && timer !== null && typeof timer.unref === 'function') timer.unref()
      })
      try {
        return await Promise.race([call, timeout])
      } finally {
        clearTimeout(timer)
      }
    }

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
      return React.createElement('div', {
        title: 'Remaining account balance',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px 4px',
          fontSize: '12px',
          lineHeight: '16px',
          minWidth: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          opacity: 0.75,
        },
      }, props.wide === false ? money : 'Balance ' + money)
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
      },
    }
  },
})
