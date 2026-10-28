/**
 * Better workspace - our own sidebar browser, registered into `sidebar.workspaces`
 * at `priority: -1` so it shadows the shipped one while the switch is on.
 *
 * Two rules shape this file:
 *
 * 1. No `children` declaration. A child-hole declaration is exclusive: the shipped
 *    entry already owns `session.menu.item` and its siblings, so re-declaring them
 *    throws and the seat is silently dropped. We read the shipped occupants off the
 *    slots service instead and render them ourselves, reproducing the two props the
 *    renderer would have synthesised - `t` (bound to the occupant's own namespace)
 *    and `useMenuOpenState` (the row's open-state pair, through the owner's declared
 *    hook factory).
 *
 * 2. The stock browser has to come back the moment the switch goes off, so the seat
 *    is added and disposed with the switch rather than always registered.
 */

/** Session rows read newest first, then by title, so the tree never reshuffles. */
export function sessionRank(a, b) {
  const left = a && a.updatedAt
  const right = b && b.updatedAt
  // Only a real timestamp may reorder: SessionSummary carries none in this Shell,
  // and the Host's own list order is the display order.
  if (typeof left === 'number' && typeof right === 'number' && left !== right) return right - left
  return 0
}

/** Pair each workspace with the session summaries it owns, in display order. */
export function workspaceRows(workspaces, sessions) {
  const byId = new Map()
  for (const session of sessions || []) {
    if (session && session.id !== undefined) byId.set(String(session.id), session)
  }
  return (workspaces || []).map(workspace => ({
    workspace,
    sessions: (workspace && workspace.sessionIds ? workspace.sessionIds : [])
      .map(id => byId.get(String(id)))
      .filter(Boolean)
      .sort(sessionRank),
  }))
}

/** Snapshot of an observable source (`{ subscribe, getSnapshot }`) as React state. */
export function useLive(source) {
  const read = React.useCallback(() => {
    try {
      return source.getSnapshot()
    } catch {
      return undefined
    }
  }, [source])
  const subscribe = React.useCallback(listener => {
    try {
      return source.subscribe(listener)
    } catch {
      return () => {}
    }
  }, [source])
  return React.useSyncExternalStore(subscribe, read, read)
}

/**
 * The shipped `sidebar.workspaces` registration, which is the only place the child
 * menu declaration lives. Returns undefined before the shipped package has
 * registered or after we shadow it away at a different priority.
 */
export function shippedBrowserEntry(slots) {
  try {
    const entries = slots.entries('sidebar.workspaces') || []
    return entries.find(entry => entry && entry.options && !(Number(entry.options.priority) < 0)) || undefined
  } catch {
    return undefined
  }
}

/** Everything a row menu needs to render the shipped occupant list faithfully. */
export function menuRuntime(ctx, slots, standard) {
  const owner = shippedBrowserEntry(slots)
  const children = owner && owner.children ? owner.children : undefined
  const spec = children ? children['sidebar.workspaces.session.menu.item'] : undefined
  const hooks = spec && spec.inject ? spec.inject.hooks : undefined
  let injected = {}
  if (owner && typeof owner.inject === 'function') {
    try {
      injected = owner.inject(standard) || {}
    } catch {
      injected = {}
    }
  }
  let locale
  try {
    locale = ctx.get('locale')
  } catch {
    locale = undefined
  }
  return {
    hooks,
    injected,
    standard,
    bindHook: (hookContext) => {
      if (!hooks || typeof hooks.menuOpenState !== 'function') return () => hookContext
      try {
        return hooks.menuOpenState(standard, hookContext)
      } catch {
        return () => hookContext
      }
    },
    /**
     * The standard hooks the shipped rows call. The slot renderer synthesises them
     * from the Shell's own sources; we derive the same answers from the snapshots we
     * already subscribe to, so Pin/Rename/Fork/Archive render instead of throwing.
     */
    standards: (workspacesSnapshot) => {
      const snapshot = workspacesSnapshot || {}
      const pinned = new Set(snapshot.pinnedSessionIds || [])
      const archived = new Set(snapshot.archivedSessionIds || [])
      const shortcuts = hooks && hooks.shortcuts && typeof hooks.shortcuts.getSnapshot === 'function'
        ? hooks.shortcuts.getSnapshot()
        : []
      return {
        usePinned: selector => (selector ? selector(pinned) : pinned),
        useArchived: selector => (selector ? selector(archived) : archived),
        // Access is the Shell's answer to give; offering the row and letting the
        // call fail is friendlier than hiding a menu that would have worked.
        useSessionAccess: () => true,
        useShortcuts: selector => (selector ? selector(shortcuts) : shortcuts),
      }
    },
    injectFor: (entry, standard) => {
      const own = entry && typeof entry.inject === 'function' ? entry.inject(standard) : undefined
      return Object.assign({}, injected, own || {})
    },
    translate: (ns) => {
      if (locale && typeof locale.bind === 'function') {
        try {
          return locale.bind(ns)
        } catch {
          return undefined
        }
      }
      return undefined
    },
  }
}

/** One shipped occupant, mounted per row so it keeps its own state across renders. */
function ShippedMenuRow({ entry, session, runtime, workspacesSnapshot }) {
  const menuOpenState = React.useState([false, () => {}])
  const useMenuOpenState = React.useMemo(
    () => runtime.bindHook(menuOpenState),
    [runtime, menuOpenState],
  )
  const t = React.useMemo(() => runtime.translate(entry.locale), [runtime, entry.locale])
  runtime.workspacesSnapshot = workspacesSnapshot
  const props = Object.assign({}, session, runtime.injectFor(entry, runtime.standard), runtime.standards(runtime.workspacesSnapshot), { useMenuOpenState })
  if (t !== undefined) props.t = t
  return React.createElement(entry.component, props)
}

/**
 * Keeps one broken third-party row from blanking the whole tree. Built lazily so
 * this file stays importable from a plain Node test, where React is absent.
 */
function rowBoundary() {
  if (typeof React === 'undefined') {
    return function Passthrough(props) {
      return props.children
    }
  }
  return class RowBoundary extends React.Component {
    constructor(props) {
      super(props)
      this.state = { failed: false }
    }

    static getDerivedStateFromError() {
      return { failed: true }
    }

    render() {
      return this.state.failed ? null : this.props.children
    }
  }
}

/** Our own chrome for a row menu: the shipped occupants, in their declared order. */
export function rowMenuEntries(slots) {
  try {
    return (slots.entries('sidebar.workspaces.session.menu.item') || [])
      .slice()
      .sort((a, b) => (Number(a.options && a.options.order) || 0) - (Number(b.options && b.options.order) || 0))
  } catch {
    return []
  }
}

const WS_FONT = 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)'
const WS_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  boxSizing: 'border-box',
  width: '100%',
  height: '28px',
  padding: '0 6px',
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, #61666b)',
  fontSize: WS_FONT,
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
}
const WS_TITLE = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }
const WS_COUNT = { flex: 'none', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)', fontVariantNumeric: 'tabular-nums' }
const WS_MENU = {
  position: 'fixed',
  zIndex: 1200,
  minWidth: '180px',
  padding: '4px',
  borderRadius: 'var(--dsw-radius-md, 8px)',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
  backgroundColor: 'Canvas',
  backgroundImage:
    'linear-gradient(var(--dsw-specific-menu, rgba(248,249,250,0.94)), var(--dsw-specific-menu, rgba(248,249,250,0.94)))',
  boxShadow: 'var(--dsw-elevation-prominent, 0 3px 8px rgba(0,0,0,0.06))',
  color: 'var(--dsw-alias-label-secondary, #61666b)',
  fontSize: WS_FONT,
}
const WS_MENU_ITEM = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  boxSizing: 'border-box',
  width: '100%',
  height: '28px',
  padding: '0 8px',
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

function CaretGlyph({ open }) {
  return React.createElement('svg', {
    viewBox: '0 0 16 16',
    width: 12,
    height: 12,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    style: { flex: 'none', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' },
  }, React.createElement('path', { d: 'M6 3.5 10.5 8 6 12.5' }))
}

function FolderGlyph() {
  return React.createElement('svg', {
    viewBox: '0 0 16 16',
    width: 14,
    height: 14,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.1,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    style: { flex: 'none' },
  }, React.createElement('path', { d: 'M2 4.5h4l1.2 1.5H14v6.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z' }))
}

function DotsGlyph() {
  return React.createElement('svg', {
    viewBox: '0 0 16 16',
    width: 14,
    height: 14,
    fill: 'currentColor',
    'aria-hidden': true,
  }, [3.5, 8, 12.5].map(x => React.createElement('circle', { key: x, cx: x, cy: 8, r: 1.1 })))
}

/** A small anchored menu; every row is the caller's, so the tree owns no policy. */
function RowMenu({ anchor, onClose, children }) {
  const style = Object.assign({}, WS_MENU, {
    top: Math.round(anchor.top),
    left: Math.round(anchor.left),
  })
  React.useEffect(() => {
    const close = event => {
      if (event && event.type === 'keydown' && event.key !== 'Escape') return
      onClose()
    }
    const pointer = event => {
      if (event && event.target && event.target.closest && event.target.closest('[data-polish-ws-menu]')) return
      onClose()
    }
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', close, true)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', close, true)
    }
  }, [onClose])
  return ReactDOM.createPortal(
    React.createElement('div', { 'data-polish-ws-menu': 'row', style }, children),
    document.body,
  )
}

export function workspaceLabel(workspace) {
  const title = workspace && typeof workspace.title === 'string' ? workspace.title.trim() : ''
  const id = String((workspace && workspace.workspaceId) || '')
  // The Host sets the default workspace's title to its own id, so a title that
  // merely repeats the id is not a name a reader wants to see.
  if (title && title !== id) return title
  const words = id.replace(/[-_]+/g, ' ').trim()
  if (!words) return 'Workspace'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function BetterWorkspace(props) {
  const services = props.services || {}
  const { ctx, slots } = services
  const standard = { wide: props.wide === true, expandSidebar: props.expandSidebar }
  const [expanded, setExpanded] = React.useState({})
  const [menu, setMenu] = React.useState(null)
  const [armed, setArmed] = React.useState(null)
  const [adding, setAdding] = React.useState(false)
  const [notice, setNotice] = React.useState('')

  const workspaceState = useLive(services.workspacesLive)
  const sessionState = useLive(services.sessionsLive)
  const workspaceList = (workspaceState && (workspaceState.items || workspaceState.workspaces)) || []
  const sessionList = sessionState && sessionState.ids && sessionState.byId
    ? sessionState.ids.map(id => sessionState.byId[id]).filter(Boolean)
    : (sessionState && (sessionState.items || sessionState.sessions)) || []
  const rows = workspaceRows(workspaceList, sessionList)
  const runtime = React.useMemo(() => menuRuntime(ctx, slots, standard), [ctx, slots, standard.wide])
  const RowBoundary = React.useMemo(() => rowBoundary(), [])
  const entries = React.useMemo(() => rowMenuEntries(slots), [slots, workspaceList.length, sessionList.length])

  const openMenu = (event, row, workspace) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ kind: 'session', row, workspace, anchor: { top: event.clientY, left: event.clientX } })
  }
  const openWorkspaceMenu = (event, workspace) => {
    event.preventDefault()
    event.stopPropagation()
    setArmed(null)
    setMenu({ kind: 'workspace', workspace, anchor: { top: event.clientY, left: event.clientX } })
  }

  const closeMenu = React.useCallback(() => setMenu(null), [])

  const workspaceMenu = menu && menu.kind === 'workspace'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('button', {
        type: 'button',
        style: WS_MENU_ITEM,
        onClick: async () => {
          closeMenu()
          try {
            await services.openFolder(menu.workspace.path)
          } catch {}
        },
      }, 'Open in File Explorer'),
      React.createElement('button', {
        type: 'button',
        style: WS_MENU_ITEM,
        onClick: async () => {
          closeMenu()
          try {
            await navigator.clipboard.writeText(menu.workspace.path)
          } catch {}
        },
      }, 'Copy path'),
      React.createElement('button', {
        type: 'button',
        style: Object.assign({}, WS_MENU_ITEM, { color: 'var(--dsw-alias-label-error, #d92d20)' }),
        onClick: async () => {
          const workspace = menu.workspace
          if (!armed || armed !== workspace.workspaceId) {
            setArmed(workspace.workspaceId)
            setMenu(Object.assign({}, menu, { anchor: menu.anchor }))
            return
          }
          closeMenu()
          try {
            await services.removeWorkspace(workspace.workspaceId)
          } catch {}
        },
      }, armed && armed === menu.workspace.workspaceId ? 'Remove workspace?' : 'Remove workspace'),
    )
    : null

  const sessionMenu = menu && menu.kind === 'session'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      entries.map((entry, index) => React.createElement(RowBoundary, { key: (entry.options && entry.options.id) || index },
        React.createElement(ShippedMenuRow, {
          entry,
          runtime,
          workspacesSnapshot: workspaceState,
          session: { sessionId: menu.row.id, displayTitle: menu.row.displayTitle, session: menu.row },
        }))),
    )
    : null

  return React.createElement('div', {
    'data-polish-ws': 'tree',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      minHeight: 0,
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '2px 6px 12px',
    },
  },
    React.createElement('div', { 'data-polish-ws': 'header', style: WS_HEADER },
      React.createElement('span', { style: WS_HEADER_TITLE }, 'Workspaces'),
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-add': 'true',
        title: 'Add a workspace',
        'aria-label': 'Add a workspace',
        style: WS_ADD,
        onClick: () => { setAdding(true); setNotice('') },
      }, '+')),
    notice ? React.createElement('div', { 'data-polish-ws': 'notice', style: WS_NOTICE }, notice) : null,
    adding && services.sourceFlow
      ? React.createElement(services.sourceFlow, {
        configForms: services.configForms(),
        open: true,
        onPicked: async (path) => {
          if (!path) return
          try {
            await services.createWorkspace(path)
            setAdding(false)
          } catch (error) {
            setNotice((error && error.message) || 'Could not add that folder.')
          }
        },
        onCancel: () => setAdding(false),
        onError: (message) => setNotice(message || 'Could not add that folder.'),
      })
      : null,
  rows.length === 0
    ? React.createElement('div', { style: { padding: '8px 6px', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)' } }, 'No workspace yet.')
    : rows.map(({ workspace, sessions }) => {
      const open = expanded[workspace.workspaceId] !== false
      return React.createElement('div', { key: workspace.workspaceId, style: { display: 'flex', flexDirection: 'column' } },
        React.createElement('div', {
          'data-polish-ws-row': workspace.workspaceId,
          style: Object.assign({}, WS_ROW, { fontWeight: 500 }),
          onClick: () => setExpanded(prev => Object.assign({}, prev, { [workspace.workspaceId]: prev[workspace.workspaceId] === false })),
          onContextMenu: event => openWorkspaceMenu(event, workspace),
        },
        React.createElement(CaretGlyph, { open }),
        React.createElement(FolderGlyph),
        React.createElement('span', { style: WS_TITLE, title: workspace.path || workspace.title }, workspaceLabel(workspace)),
        React.createElement('span', { style: WS_COUNT }, String(sessions.length))),
        open
          ? sessions.map(row => React.createElement('div', {
            key: row.id,
            'data-polish-ws-session': row.id,
            style: Object.assign({}, WS_ROW, { paddingLeft: '24px' }),
            onClick: () => services.openSession(row.id),
            onContextMenu: event => openMenu(event, row, workspace),
          },
          React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
          React.createElement('button', {
            type: 'button',
            'aria-label': 'Session menu',
            style: Object.assign({}, WS_MENU_ITEM, { width: '20px', height: '20px', padding: 0, justifyContent: 'center', flex: 'none' }),
            onClick: event => openMenu(event, row, workspace),
          }, React.createElement(DotsGlyph))))
          : null)
    }),
  sessionMenu,
  workspaceMenu)
}

/**
 * Add and dispose the seat with the switch. A `single` slot renders its LOWEST
 * priority occupant, so presence is the only way to stand aside: without this the
 * stock browser would be shadowed even while the switch is off.
 */
export function installWorkspaceSeat(ctx, configForms, extras = {}) {
  let dispose
  let unlisten
  const scope = () => {
    try {
      return configForms()
    } catch {
      return undefined
    }
  }
  const readSwitch = () => {
    const forms = scope()
    if (!forms || typeof forms.get !== 'function') return true
    const live = forms.get(ROW_ID)
    if (!live || typeof live.getSnapshot !== 'function') return true
    let snapshot
    try {
      snapshot = live.getSnapshot()
    } catch {
      return true
    }
    const value = snapshot && (snapshot.value || (snapshot.state && snapshot.state.value))
    if (!value || typeof value !== 'object') return true
    if (value.betterWorkspace === undefined) return true
    return value.betterWorkspace === true || (value.betterWorkspace && value.betterWorkspace.get && value.betterWorkspace.get() === true)
  }
  const install = () => {
    if (dispose !== undefined) return
    try {
      dispose = ctx.inject(
        ['slots', 'sessions', 'workspaces', 'uiWorkspace', 'locale', 'remote', 'remote.session'],
        (seated) => {
          const services = {
            ctx: seated,
            configForms,
            sourceFlow: extras.sourceFlow,
            slots: seated.slots,
            workspacesLive: seated.workspaces.list,
            sessionsLive: seated.sessions.list,
            openSession: (id) => seated.uiWorkspace.openSession(id),
            createWorkspace: (path) => seated.workspaces.create({ path }),
            removeWorkspace: (id) => seated.workspaces.delete(id),
            openFolder: async (path) => {
              const answer = await seated.remote.session.openWorkspacePath({ path })
              if (answer && answer.ok === false) throw new Error('cannot open the folder')
            },
          }
          seated.slots.inject('sidebar.workspaces', () => seated.slots.register({
            name: 'sidebar.workspaces',
            priority: -1,
            inject: () => ({ services }),
          }, BetterWorkspace))
        },
      )
    } catch (error) {
      console.warn('[aryacode-polish] better workspace seat skipped:', error && error.message)
      dispose = undefined
    }
  }
  const sync = () => {
    if (readSwitch()) {
      install()
      return
    }
    if (typeof dispose === 'function') {
      try {
        dispose()
      } catch {}
    }
    dispose = undefined
  }
  sync()
  const forms = scope()
  if (forms && typeof forms.get === 'function') {
    const live = forms.get(ROW_ID)
    if (live && typeof live.subscribe === 'function') {
      unlisten = live.subscribe(() => sync())
    }
  }
  return () => {
    if (typeof unlisten === 'function') unlisten()
    if (typeof dispose === 'function') dispose()
  }
}
const WS_HEADER = { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px 4px' }
const WS_HEADER_TITLE = { flex: 1, minWidth: 0, fontSize: 'calc(' + "var(--dsh-content-font-size-secondary, 13px)" + ' - 2px)', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)' }
const WS_ADD = { flex: 'none', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', fontSize: '15px', lineHeight: 1, borderRadius: 'var(--dsw-radius-sm)', cursor: 'pointer' }
const WS_NOTICE = { margin: '0 4px 6px', fontSize: 'calc(' + "var(--dsh-content-font-size-secondary, 13px)" + ' - 2px)', color: 'var(--dsw-alias-label-secondary)' }
