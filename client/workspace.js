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

export function filterTree(rows, query, pinned) {
  const needle = String(query || '').trim().toLowerCase()
  const ordered = rows.map(({ workspace, sessions }) => {
    const hoisted = []
    const rest = []
    ;(sessions || []).forEach(row => {
      if (pinned && pinned.has(row.id)) hoisted.push(row)
      else rest.push(row)
    })
    return { workspace, sessions: hoisted.concat(rest) }
  })
  if (!needle) return ordered
  const matched = []
  ordered.forEach(({ workspace, sessions }) => {
    const label = workspaceLabel(workspace).toLowerCase()
    if (label.includes(needle)) {
      matched.push({ workspace, sessions })
      return
    }
    const hits = sessions.filter(row => String(row.displayTitle || row.id).toLowerCase().includes(needle))
    if (hits.length > 0) matched.push({ workspace, sessions: hits })
  })
  return matched
}

/**
 * The rows a keyboard walk visits, in the order they are drawn. A filter opens every
 * group it kept, because a match you cannot see is not a match.
 */
export function flattenRows(rows, expanded, query) {
  const filtering = String(query || '').trim().length > 0
  const flat = []
  rows.forEach(({ workspace, sessions }) => {
    flat.push({ kind: 'workspace', id: workspace.workspaceId, workspaceId: workspace.workspaceId })
    const open = filtering || expanded[workspace.workspaceId] !== false
    if (!open) return
    ;(sessions || []).forEach(row => {
      flat.push({ kind: 'session', id: row.id, workspaceId: workspace.workspaceId })
    })
  })
  return flat
}

export function moveBefore(list, movingId, beforeId) {
  const from = list.findIndex(item => item.id === movingId)
  const to = list.findIndex(item => item.id === beforeId)
  if (from < 0 || to < 0 || from === to) return list
  const next = list.slice()
  const [moving] = next.splice(from, 1)
  const target = next.findIndex(item => item.id === beforeId)
  next.splice(target < 0 ? next.length : target, 0, moving)
  return next
}

const WS_FILTER = {
  margin: '2px 2px 6px',
  padding: '4px 8px',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))',
  borderRadius: 'var(--dsw-radius-sm)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, inherit)',
  font: 'inherit',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 2px)',
  outline: 'none',
}

const WS_ROW_ACTION = {
  flex: 'none',
  width: '20px',
  height: '20px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  cursor: 'pointer',
}

const WS_DOT = {
  flex: 'none',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  marginRight: '2px',
  background: 'var(--dsw-alias-label-success, #12b76a)',
}

const WS_PIN = {
  flex: 'none',
  fontSize: '9px',
  lineHeight: 1,
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
}

const WS_PIN_COUNT = WS_PIN

const WS_COUNT_NOTE = {
  margin: '2px 4px 0',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 3px)',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
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
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(-1)
  const [hover, setHover] = React.useState(null)
  const [drag, setDrag] = React.useState(null)
  const [dropping, setDropping] = React.useState(null)
  const filterRef = React.useRef(null)

  const workspaceState = useLive(services.workspacesLive)
  const sessionState = useLive(services.sessionsLive)
  const workspaceList = (workspaceState && (workspaceState.items || workspaceState.workspaces)) || []
  const sessionList = sessionState && sessionState.ids && sessionState.byId
    ? sessionState.ids.map(id => sessionState.byId[id]).filter(Boolean)
    : (sessionState && (sessionState.items || sessionState.sessions)) || []
  const pinned = React.useMemo(
    () => new Set((workspaceState && workspaceState.pinnedSessionIds) || []),
    [workspaceState],
  )
  const allRows = workspaceRows(workspaceList, sessionList)
  const rows = filterTree(allRows, query, pinned)
  const walk = flattenRows(rows, expanded, query)
  const runtime = React.useMemo(() => menuRuntime(ctx, slots, standard), [ctx, slots, standard.wide])
  const RowBoundary = React.useMemo(() => rowBoundary(), [])
  const entries = React.useMemo(() => rowMenuEntries(slots), [slots, workspaceList.length, sessionList.length])
  const totalCount = allRows.reduce((sum, row) => sum + row.sessions.length, 0)
  const shownCount = rows.reduce((sum, row) => sum + row.sessions.length, 0)
  const allFolded = rows.length > 0 && rows.every(row => expanded[row.workspace.workspaceId] === false)

  React.useEffect(() => {
    if (cursor >= walk.length) setCursor(walk.length - 1)
  }, [walk.length, cursor])

  React.useEffect(() => {
    const onShortcut = (event) => {
      const node = event.target
      const typing = node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        if (filterRef.current && filterRef.current.focus) filterRef.current.focus()
      }
    }
    document.addEventListener('keydown', onShortcut)
    return () => document.removeEventListener('keydown', onShortcut)
  }, [])

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

  const toggleWorkspace = (workspaceId) => {
    setExpanded((prev) => {
      const next = Object.assign({}, prev)
      next[workspaceId] = prev[workspaceId] === false
      return next
    })
  }
  const foldAll = () => {
    if (allFolded) { setExpanded({}); return }
    const next = {}
    rows.forEach((row) => { next[row.workspace.workspaceId] = false })
    setExpanded(next)
  }

  const reorderWorkspace = async (movingId, beforeId) => {
    if (!services.reorderWorkspace || !movingId || movingId === beforeId) return
    try { await services.reorderWorkspace(movingId, beforeId) } catch { setNotice('Could not reorder workspaces.') }
  }
  const reorderSession = async (workspaceId, movingId, beforeId) => {
    if (!services.reorderSession || !movingId || movingId === beforeId) return
    try { await services.reorderSession(workspaceId, movingId, beforeId) } catch { setNotice('Could not reorder sessions.') }
  }
  const dropOnWorkspace = (targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'workspace') return
    void reorderWorkspace(moving.id, targetId)
  }
  const dropOnSession = (workspaceId, targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'session' || moving.id === targetId) return
    if (moving.workspaceId !== workspaceId) {
      // A session cannot change workspace from a plugin: the Host's remote
      // namespace exposes create/rename/delete/insertBefore/insertSessionBefore
      // and no attachSession or detachSession, and a workspace's own
      // insertSessionBefore only reorders the sessions already in it.
      setNotice('A session stays in its workspace; drag it within that workspace to reorder.')
      return
    }
    void reorderSession(workspaceId, moving.id, targetId)
  }

  const activate = (item) => {
    if (!item) return
    if (item.kind === 'workspace') toggleWorkspace(item.workspaceId)
    else services.openSession(item.id)
  }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (walk.length === 0) return
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setCursor(Math.min(walk.length - 1, Math.max(0, cursor + step)))
      return
    }
    if (event.key === 'Enter') {
      if (cursor < 0) return
      event.preventDefault()
      activate(walk[cursor])
      return
    }
    if (event.key === 'Escape') {
      if (query) { setQuery(''); return }
      if (menu) { closeMenu(); return }
      setCursor(-1)
    }
  }

  const workspaceMenu = menu && menu.kind === 'workspace'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('button', {
        type: 'button',
        style: WS_MENU_ITEM,
        onClick: async () => {
          closeMenu()
          try { await services.openFolder(menu.workspace.path) } catch {}
        },
      }, 'Open in File Explorer'),
      React.createElement('button', {
        type: 'button',
        style: WS_MENU_ITEM,
        onClick: async () => {
          closeMenu()
          try { await navigator.clipboard.writeText(menu.workspace.path) } catch {}
        },
      }, 'Copy path'),
      React.createElement('button', {
        type: 'button',
        style: Object.assign({}, WS_MENU_ITEM, { color: 'var(--dsw-alias-label-error, #d92d20)' }),
        onClick: async () => {
          const workspace = menu.workspace
          if (!armed || armed !== workspace.workspaceId) {
            setArmed(workspace.workspaceId)
            setMenu(Object.assign({}, menu))
            return
          }
          closeMenu()
          try { await services.removeWorkspace(workspace.workspaceId) } catch {}
        },
      }, armed && armed === menu.workspace.workspaceId ? 'Remove workspace?' : 'Remove workspace'))
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
      null)
    : null

  const children = []

  children.push(React.createElement('div', { key: 'header', 'data-polish-ws': 'header', style: WS_HEADER },
    React.createElement('span', { style: WS_HEADER_TITLE }, 'Workspaces'),
    React.createElement('button', {
      key: 'fold',
      type: 'button',
      'data-polish-ws-fold': 'true',
      title: allFolded ? 'Expand all' : 'Collapse all',
      'aria-label': allFolded ? 'Expand all workspaces' : 'Collapse all workspaces',
      style: WS_ADD,
      onClick: foldAll,
    }, allFolded ? '⌄' : '⌃'),
    React.createElement('button', {
      key: 'add',
      type: 'button',
      'data-polish-ws-add': 'true',
      title: 'Add a workspace',
      'aria-label': 'Add a workspace',
      style: WS_ADD,
      onClick: () => { setAdding(true); setNotice('') },
    }, '+')))

  children.push(React.createElement('input', {
    key: 'filter',
    ref: filterRef,
    'data-polish-ws-filter': 'true',
    type: 'search',
    value: query,
    placeholder: 'Filter workspaces and sessions',
    'aria-label': 'Filter workspaces and sessions',
    style: WS_FILTER,
    onChange: (event) => { setQuery(event.target.value); setCursor(-1) },
    onKeyDown: (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); setQuery('') }
    },
  }))

  if (notice) {
    children.push(React.createElement('div', { key: 'notice', 'data-polish-ws': 'notice', style: WS_NOTICE }, notice))
  }

  if (adding && services.sourceFlow) {
    children.push(React.createElement(services.sourceFlow, {
      key: 'flow',
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
    }))
  }

  if (rows.length === 0) {
    children.push(React.createElement('div', {
      key: 'empty',
      style: { padding: '8px 6px', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)' },
    }, query ? 'Nothing matches "' + query + '".' : 'No workspace yet.'))
  }

  let index = -1
  rows.forEach((group) => {
    const workspace = group.workspace
    const sessions = group.sessions
    index += 1
    const open = expanded[workspace.workspaceId] !== false
    const focused = cursor === index
    const hovered = hover === 'workspace:' + workspace.workspaceId
    const dropHere = dropping === 'workspace:' + workspace.workspaceId

    children.push(React.createElement('div', {
      key: 'workspace:' + workspace.workspaceId,
      style: { display: 'flex', flexDirection: 'column' },
    },
    React.createElement('div', {
      'data-polish-ws-row': workspace.workspaceId,
      draggable: true,
      title: workspace.path || workspaceLabel(workspace),
      style: Object.assign({}, WS_ROW, {
        fontWeight: 500,
        background: dropHere
          ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
          : (focused ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04))' : undefined),
        boxShadow: focused ? 'inset 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))' : undefined,
      }),
      onClick: () => toggleWorkspace(workspace.workspaceId),
      onContextMenu: (event) => openWorkspaceMenu(event, workspace),
      onMouseEnter: () => setHover('workspace:' + workspace.workspaceId),
      onMouseLeave: () => setHover(null),
      onDragStart: () => setDrag({ kind: 'workspace', id: workspace.workspaceId }),
      onDragOver: (event) => {
        if (!drag || drag.kind !== 'workspace' || drag.id === workspace.workspaceId) return
        event.preventDefault()
        setDropping('workspace:' + workspace.workspaceId)
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event) => { event.preventDefault(); dropOnWorkspace(workspace.workspaceId) },
    },
    React.createElement(CaretGlyph, { open }),
    React.createElement(FolderGlyph),
    React.createElement('span', { style: WS_TITLE }, workspaceLabel(workspace)),
    React.createElement('span', { style: WS_COUNT }, String(sessions.length)),
    hovered || focused
      ? React.createElement('button', {
        type: 'button',
        'data-polish-ws-menu': 'workspace',
        'aria-label': 'Workspace menu',
        style: WS_ROW_ACTION,
        onClick: (event) => openWorkspaceMenu(event, workspace),
      }, React.createElement(DotsGlyph))
      : null)))

    if (open) {
      sessions.forEach((row) => {
        index += 1
        const rowFocused = cursor === index
        const rowHovered = hover === 'session:' + row.id
        const lifted = dropping === 'session:' + row.id
        children.push(React.createElement('div', {
          key: 'session:' + row.id,
          'data-polish-ws-session': row.id,
          draggable: true,
          style: Object.assign({}, WS_ROW, {
            paddingLeft: '24px',
            opacity: drag && drag.kind === 'session' && drag.id === row.id ? 0.5 : undefined,
            background: lifted
              ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
              : (rowFocused ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04))' : undefined),
            boxShadow: rowFocused ? 'inset 0 0 0 1px var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))' : undefined,
          }),
          onClick: () => services.openSession(row.id),
          onContextMenu: (event) => openMenu(event, row, workspace),
          onMouseEnter: () => setHover('session:' + row.id),
          onMouseLeave: () => setHover(null),
          onDragStart: () => setDrag({ kind: 'session', id: row.id, workspaceId: workspace.workspaceId }),
          onDragOver: (event) => {
            if (!drag || drag.kind !== 'session' || drag.id === row.id) return
            event.preventDefault()
            setDropping('session:' + row.id)
          },
          onDragLeave: () => setDropping(null),
          onDrop: (event) => { event.preventDefault(); dropOnSession(workspace.workspaceId, row.id) },
        },
        row.running ? React.createElement('span', { style: WS_DOT, title: 'Running' }) : null,
        pinned.has(row.id) ? React.createElement('span', { style: WS_PIN, title: 'Pinned' }, '\u2605') : null,
        React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
        rowHovered || rowFocused
          ? React.createElement('button', {
            type: 'button',
            'data-polish-ws-menu': 'session',
            'aria-label': 'Session menu',
            style: WS_ROW_ACTION,
            onClick: (event) => openMenu(event, row, workspace),
          }, React.createElement(DotsGlyph))
          : null))
      })
    }
  })

  return React.createElement('div', {
    'data-polish-ws': 'tree',
    tabIndex: 0,
    role: 'tree',
    'aria-label': 'Workspaces',
    onKeyDown: onKeyDown,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      minHeight: 0,
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '2px 6px 12px',
      outline: 'none',
    },
  },
  children,
  shownCount < totalCount
    ? React.createElement('div', { key: 'count', style: WS_COUNT_NOTE }, String(shownCount) + ' of ' + String(totalCount) + ' sessions')
    : null,
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
            reorderWorkspace: (movingId, beforeId) => seated.workspaces.insertBefore(movingId, beforeId),
            reorderSession: (workspaceId, movingId, beforeId) => seated.workspaces.insertSessionBefore(workspaceId, movingId, beforeId),
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
