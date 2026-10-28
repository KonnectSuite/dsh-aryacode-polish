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
  height: 'var(--polish-ws-row, 28px)',
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

/** Where the cursor lands when hopping to the next or previous workspace head. */
export function jumpWorkspace(list, cursor, step) {
  const flat = Array.isArray(list) ? list : []
  const heads = []
  flat.forEach((item, index) => {
    if (item && item.kind === 'workspace') heads.push(index)
  })
  if (heads.length === 0) return -1
  if (cursor === undefined || cursor < 0) return step > 0 ? heads[0] : heads[heads.length - 1]
  if (step > 0) {
    const after = heads.find(index => index > cursor)
    return after === undefined ? heads[0] : after
  }
  const before = heads.filter(index => index < cursor)
  return before.length === 0 ? heads[heads.length - 1] : before[before.length - 1]
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

const LOOK_KEY = 'aryacode-polish:workspace-appearance.v1'
const PRESET_KEY = 'aryacode-polish:workspace-presets.v1'

/** The part of a look worth keeping: tone, weight and glyph, never the note. */
export function lookOf(map, workspaceId) {
  const look = appearanceOf(map, workspaceId)
  return { tone: look.tone, strong: look.strong, glyph: look.glyph }
}

export function readPresets(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return {}
    const parsed = JSON.parse(store.getItem(PRESET_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writePresets(map, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(PRESET_KEY, JSON.stringify(map || {}))
  } catch {
    /* a preset is a convenience */
  }
}

/** Add or replace a preset; the name is trimmed and capped, and empty looks are refused. */
export function withPreset(map, name, look) {
  const key = String(name || '').trim().slice(0, 24)
  if (!key) return map || {}
  const clean = { tone: look && look.tone, strong: look && look.strong === true, glyph: look && look.glyph }
  if (!clean.tone && !clean.glyph && !clean.strong) return map || {}
  return Object.assign({}, map || {}, { [key]: clean })
}

export function withoutPreset(map, name) {
  const next = Object.assign({}, map || {})
  delete next[String(name || '').trim()]
  return next
}

/** Preset names, newest last but stable, so the menu does not reorder itself. */
export function presetNames(map) {
  return Object.keys(map || {}).sort((a, b) => a.localeCompare(b))
}
const ORDER_KEY = 'aryacode-polish:workspace-order.v1'
const FOLD_KEY = 'aryacode-polish:folded.v1'
const DENSITY_KEY = 'aryacode-polish:density.v1'
const FOLDER_KEY = 'aryacode-polish:folders.v1'
const MARK_KEY = 'aryacode-polish:session-marks.v1'

export function markOf(map, sessionId) {
  const entry = (map && map[String(sessionId)]) || {}
  return {
    flag: entry.flag === true,
    note: typeof entry.note === 'string' && entry.note.length > 0 ? entry.note : undefined,
  }
}

export function withMark(map, sessionId, patch) {
  const next = Object.assign({}, map || {})
  const key = String(sessionId)
  const merged = Object.assign({}, markOf(next, key), patch || {})
  const entry = {}
  if (merged.flag === true) entry.flag = true
  if (merged.note) entry.note = merged.note
  if (Object.keys(entry).length === 0) delete next[key]
  else next[key] = entry
  return next
}

export function readMarks(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return {}
    const parsed = JSON.parse(store.getItem(MARK_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeMarks(map, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(MARK_KEY, JSON.stringify(map || {}))
  } catch {
    /* a mark is a nicety */
  }
}

/** The whole tree as indented text, for pasting into a prompt or an issue. */
export function treeText(rows, folderNames, markOfSession) {
  const lines = []
  const seen = new Set()
  const pushGroup = (folder) => {
    if (seen.has(folder)) return
    seen.add(folder)
    lines.push(folder)
    for (const row of rows || []) {
      const name = folderKey(row.workspace)
      if (name !== folder) continue
      lines.push('  ' + workspaceLabel(row.workspace))
      for (const session of row.sessions || []) {
        const mark = typeof markOfSession === 'function' ? markOfSession(session.id) : { flag: false }
        lines.push('    ' + (mark && mark.flag ? '⚑ ' : '') + String(session.displayTitle || session.title || session.id))
      }
    }
  }
  for (const folder of folderNames || []) pushGroup(folder)
  for (const row of rows || []) {
    const name = folderKey(row.workspace)
    if (name !== undefined) continue
    lines.push(workspaceLabel(row.workspace))
    for (const session of row.sessions || []) {
      const mark = typeof markOfSession === 'function' ? markOfSession(session.id) : { flag: false }
      lines.push('  ' + (mark && mark.flag ? '⚑ ' : '') + String(session.displayTitle || session.title || session.id))
    }
  }
  return lines.join('\n')
}

const cleanFolder = (name) => {
  const value = String(name || '').trim().replace(/^\/+|\/+$/g, '')
  return value && !value.includes('/') ? value : undefined
}

/** Add a folder name, refusing empties, duplicates and anything nested. */
export function addFolder(list, name) {
  const folder = cleanFolder(name)
  const names = Array.isArray(list) ? list.slice() : []
  if (!folder || names.includes(folder)) return names
  names.push(folder)
  return names
}

/** Remove a folder name from the declared list. */
export function removeFolder(list, name) {
  const folder = cleanFolder(name)
  const names = Array.isArray(list) ? list : []
  return folder ? names.filter((entry) => entry !== folder) : names.slice()
}

export function readFolders(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return []
    const parsed = JSON.parse(store.getItem(FOLDER_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(cleanFolder).filter(Boolean)
  } catch {
    return []
  }
}

export function writeFolders(list, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(FOLDER_KEY, JSON.stringify((Array.isArray(list) ? list : []).map(cleanFolder).filter(Boolean)))
  } catch {
    /* folders are a convenience, not a requirement */
  }
}

/**
 * Folder names the tree must draw: the ones its workspaces imply, then any declared but
 * still empty. Declared folders keep their order so an empty folder does not jump around
 * when the first workspace lands in it.
 */
export function folderNamesOf(rows, declared) {
  const seen = []
  for (const row of rows || []) {
    const name = folderKey(row.workspace)
    if (name && !seen.includes(name)) seen.push(name)
  }
  for (const name of declared || []) {
    const folder = cleanFolder(name)
    if (folder && !seen.includes(folder)) seen.push(folder)
  }
  return seen
}

export const DENSITIES = ['comfortable', 'compact', 'folders']

/** Row height per density: the tree fits more rows without shrinking the text. */
export const DENSITY_METRICS = {
  comfortable: { row: '28px', sessions: true },
  compact: { row: '22px', sessions: true },
  folders: { row: '24px', sessions: false },
}

export const DENSITY_TITLES = {
  comfortable: 'Use compact rows',
  compact: 'Show folders only',
  folders: 'Use comfortable rows',
}

export const DENSITY_GLYPHS = {
  comfortable: '\u2263',
  compact: '\u2261',
  folders: '\u25a4',
}

export function densityOf(value) {
  return DENSITIES.indexOf(value) >= 0 ? value : 'comfortable'
}

export const SORT_KEY = 'aryacode-polish:sort.v1'
export const SORTS = ['host', 'name']

export function sortOf(value) {
  return SORTS.indexOf(value) === -1 ? 'host' : value
}

export function readSort(storage) {
  try {
    const store = storage || globalThis.localStorage
    const raw = store ? store.getItem(SORT_KEY) : null
    return sortOf(raw === null || raw === undefined ? 'host' : raw)
  } catch {
    return 'host'
  }
}

export function writeSort(value, storage) {
  try {
    const store = storage || globalThis.localStorage
    if (store) store.setItem(SORT_KEY, sortOf(value))
  } catch {}
}

// Folder membership is the primary key so a folder's workspaces stay together;
// '' sorts before any folder name, which keeps unfiled workspaces on top.
export function sortRows(rows, mode) {
  if (sortOf(mode) !== 'name') return rows
  const ranked = rows.map((group, index) => ({
    group,
    index,
    folder: folderKey(group.workspace) || '',
    label: workspaceLabel(group.workspace).toLowerCase(),
  }))
  ranked.sort((a, b) => {
    if (a.folder !== b.folder) {
      if (a.folder === '') return -1
      if (b.folder === '') return 1
      return a.folder < b.folder ? -1 : 1
    }
    if (a.label !== b.label) return a.label < b.label ? -1 : 1
    return a.index - b.index
  })
  return ranked.map((entry) => entry.group)
}

export function nextDensity(value) {
  const list = DENSITIES
  return list[(list.indexOf(densityOf(value)) + 1) % list.length]
}

export function readDensity(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return 'comfortable'
    return densityOf(store.getItem(DENSITY_KEY))
  } catch {
    return 'comfortable'
  }
}

export function writeDensity(value, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(DENSITY_KEY, densityOf(value))
  } catch {
    /* remembering this is a nicety, not a requirement */
  }
}

/**
 * Split the flat session list into the rows a workspace shows and the ones it has
 * archived. The shipped browser hides archived sessions; here they keep a section of
 * their own at the bottom instead of disappearing without a trace.
 */
// Pinned sessions get their own section, exactly like archived ones, so a pin is
// visible where you look for it instead of only as a star on a row you must find.
// A session's priced view is written by the Host half of the cost feature
// (`polishCost`). The tree asks the session list for it and hides the number when
// it is missing, so a Shell that never ran the cost feature simply shows nothing.
export function costOf(snapshot, sessionId) {
  if (!snapshot || !snapshot.projectionsBySession) return undefined
  const projection = snapshot.projectionsBySession[sessionId]
  if (!projection || !projection.values) return undefined
  const value = projection.values.polishCost
  if (!value || typeof value !== 'object') return undefined
  const usd = typeof value.costUsd === 'string' ? value.costUsd : undefined
  const cny = typeof value.costCny === 'string' ? value.costCny : undefined
  if (usd === undefined && cny === undefined) return undefined
  return { usd: usd, cny: cny, incomplete: value.incomplete === true }
}

export function costLabel(cost) {
  if (!cost) return ''
  const yen = String.fromCharCode(165)
  const dollar = String.fromCharCode(36)
  const symbol = cost.usd === undefined ? yen : dollar
  const text = cost.usd === undefined ? cost.cny : cost.usd
  const amount = Number(text)
  if (!Number.isFinite(amount)) return ''
  const shown = amount >= 1 ? amount.toFixed(2) : amount >= 0.01 ? amount.toFixed(3) : amount.toPrecision(2)
  const approx = cost.incomplete ? String.fromCharCode(126) : String.fromCharCode(8776)
  return approx + symbol + shown
}

/** True when any session filed under these workspaces is running right now. */
const HELP_KEY = 'aryacode-polish:help.v1'

/** Whether the shortcut sheet has been opened once on this machine. */
export function readHelp(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return false
    return store.getItem(HELP_KEY) === '1'
  } catch {
    return false
  }
}

export function writeHelp(seen, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    if (seen) store.setItem(HELP_KEY, '1')
    else store.removeItem(HELP_KEY)
  } catch {
    // a locked-down webview simply forgets it was shown
  }
}

export function folderHasRunning(inside) {
  return (inside || []).some((entry) => (entry.sessions || []).some((row) => row && row.running === true))
}

export function sumCost(sessions, snapshot) {
  let usd = 0
  let cny = 0
  let anyUsd = false
  let anyCny = false
  let incomplete = false
  for (const row of sessions || []) {
    const cost = costOf(snapshot, row && row.id)
    if (!cost) continue
    if (cost.incomplete) incomplete = true
    if (cost.usd !== undefined) { anyUsd = true; usd += Number(cost.usd) || 0 }
    if (cost.cny !== undefined) { anyCny = true; cny += Number(cost.cny) || 0 }
  }
  if (!anyUsd && !anyCny) return undefined
  return {
    usd: anyUsd ? usd.toFixed(8) : undefined,
    cny: anyCny ? cny.toFixed(8) : undefined,
    incomplete,
  }
}

/** What a group of sessions costs together, as a short label, or an empty string. */
export function sumCostLabel(sessions, snapshot) {
  const total = sumCost(sessions, snapshot)
  return total ? costLabel(total) : ''
}

/** The folder header shows the same total for everything filed under it. */
export function folderCostNode(inside, snapshot, folder) {
  const sessions = (inside || []).reduce((all, entry) => all.concat(entry.sessions), [])
  const label = sumCostLabel(sessions, snapshot)
  if (!label) return null
  return React.createElement('span', {
    'data-polish-ws-folder-cost': folder,
    style: Object.assign({}, WS_COST, { marginLeft: '6px' }),
  }, label)
}
export function splitPinned(sessions, pinnedIds) {
  const pinned = new Set(pinnedIds || [])
  const pinnedSessions = []
  const rest = []
  for (const row of sessions || []) {
    if (pinned.has(row.id)) pinnedSessions.push(row)
    else rest.push(row)
  }
  return { pinned: pinnedSessions, rest }
}

export function splitArchived(sessions, archivedIds) {
  const archive = archivedIds instanceof Set ? archivedIds : new Set(archivedIds || [])
  const active = []
  const archived = []
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (archive.has(session.id)) archived.push(session)
    else active.push(session)
  }
  return { active, archived }
}

const WS_GLYPH_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 26px)',
  gap: '2px',
  padding: '2px',
}

const WS_GLYPH_BUTTON = {
  width: '26px',
  height: '26px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  fontSize: '15px',
  lineHeight: 1,
  cursor: 'pointer',
}

const WS_NOTE_INPUT = {
  width: '220px',
  boxSizing: 'border-box',
  padding: '5px 8px',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  outline: 'none',
}

const WS_MENU_HINT = {
  padding: '4px 8px 2px',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 2px)',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
}

const WS_NOTE_CARD = {
  position: 'fixed',
  zIndex: 1250,
  maxWidth: '260px',
  padding: '6px 9px',
  borderRadius: 'var(--dsw-radius-md, 8px)',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))',
  background: 'Canvas',
  color: 'var(--dsw-alias-label-secondary, #61666b)',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',
  lineHeight: 1.35,
  boxShadow: 'var(--dsw-elevation-prominent, 0 2px 8px rgba(0, 0, 0, 0.08))',
  pointerEvents: 'none',
  whiteSpace: 'pre-wrap',
}

const WS_GLYPH = {
  flex: 'none',
  width: '16px',
  textAlign: 'center',
  fontSize: '13px',
  lineHeight: 1,
}

const WS_SECTION = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '8px 6px 2px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
  fontSize: 'calc(' + 'var(--dsh-content-font-size-secondary, 13px)' + ' - 3px)',
  cursor: 'pointer',
  userSelect: 'none',
}

/** Which workspaces and folders are folded, kept so a restart looks like yesterday. */
export function readFolded(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return { workspaces: {}, folders: {} }
    const raw = store.getItem(FOLD_KEY)
    if (!raw) return { workspaces: {}, folders: {} }
    const parsed = JSON.parse(raw)
    return {
      workspaces: (parsed && parsed.workspaces) || {},
      folders: (parsed && parsed.folders) || {},
    }
  } catch {
    return { workspaces: {}, folders: {} }
  }
}

export function writeFolded(state, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    const clean = {
      workspaces: (state && state.workspaces) || {},
      folders: (state && state.folders) || {},
    }
    store.setItem(FOLD_KEY, JSON.stringify(clean))
  } catch {
    /* folding is a convenience; a store that refuses must not break the tree */
  }
}

/**
 * Rank the quick switcher's rows. A title that starts with the query wins over one
 * that merely contains it, and equal kinds keep the order they arrived in — so
 * typing "gre" puts Greeting above anything that mentions greeting later on.
 */
/**
 * The palette is not only a jumper: every workspace contributes a "start a session here" action, so
 * Ctrl-K can create work as well as find it. Kept pure so the entries are testable without React.
 */
export function actionEntries(rows) {
  return (rows || []).map((group) => ({
    id: 'new:' + group.workspace.workspaceId,
    kind: 'action',
    workspaceId: group.workspace.workspaceId,
    title: 'New session in ' + workspaceLabel(group.workspace),
    workspace: workspaceLabel(group.workspace),
  }))
}

export function rankMatches(items, query, text = (item) => String(item.title || item.id || '')) {
  const list = Array.isArray(items) ? items : []
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return list.slice(0, 40)
  const scored = []
  list.forEach((item, order) => {
    const hay = text(item).toLowerCase()
    const at = hay.indexOf(needle)
    if (at === -1) return
    scored.push({ item, rank: at === 0 ? 0 : 1, order })
  })
  scored.sort((a, b) => (a.rank - b.rank) || (a.order - b.order))
  return scored.slice(0, 40).map((entry) => entry.item)
}

const SWITCHER_BACKDROP = {
  position: 'fixed',
  inset: 0,
  zIndex: 1300,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '12vh',
  background: 'rgba(16, 18, 22, 0.28)',
}

const SWITCHER_CARD = {
  width: 'min(560px, calc(100vw - 32px))',
  maxHeight: '60vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 'var(--dsw-radius-lg, 10px)',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
  background: 'Canvas',
  boxShadow: 'var(--dsw-elevation-prominent, 0 8px 24px rgba(0,0,0,0.18))',
  color: 'var(--dsw-alias-label-primary, #1b1d21)',
}

const SWITCHER_INPUT = {
  border: 'none',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
  background: 'transparent',
  color: 'inherit',
  fontSize: '14px',
  padding: '12px 14px',
  outline: 'none',
}

const SWITCHER_LIST = {
  overflowY: 'auto',
  padding: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
}

const SWITCHER_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '7px 10px',
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '13px',
  textAlign: 'left',
  cursor: 'pointer',
}

const SWITCHER_HINT = {
  flex: 'none',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
  fontSize: '11px',
  fontVariantNumeric: 'tabular-nums',
}

/**
 * A workspace whose label carries a path ("Work/Client A") files itself under
 * "Work". The grouping is purely visual and derived from the title, so nothing is
 * written to the Host and renaming a workspace is enough to move it between
 * folders — the same idea as the reference plugin, without its "/" toggle.
 */
/**
 * The title a workspace needs to sit under `folder`: its own name moved behind the
 * folder prefix, with any previous prefix replaced rather than stacked.
 */
export function fileUnder(label, folder) {
  const name = String(label || '').trim()
  const target = String(folder || '').trim()
  if (!name || !target) return name
  const cut = name.lastIndexOf('/')
  const bare = (cut >= 0 ? name.slice(cut + 1) : name).trim()
  return bare ? target + '/' + bare : target
}

/** The title a workspace needs to sit at the top level again: no folder prefix. */
export function unfiled(label) {
  const name = String(label || '').trim()
  if (!name) return name
  const cut = name.lastIndexOf('/')
  return cut >= 0 ? name.slice(cut + 1).trim() : name
}

export function folderKey(workspace) {
  const label = workspaceLabel(workspace)
  const cut = label.lastIndexOf('/')
  if (cut <= 0 || cut === label.length - 1) return undefined
  return label.slice(0, cut).trim() || undefined
}

export function readOrder(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return []
    const raw = store.getItem(ORDER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function writeOrder(ids, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(ORDER_KEY, JSON.stringify(Array.isArray(ids) ? ids : []))
  } catch {
    /* storage is a convenience here, never a requirement */
  }
}

/**
 * The insertBefore calls that turn one order into another. `insertBefore(moving, before)`
 * is the only reorder verb the Host offers, so the plan walks the wanted order and moves
 * each workspace in front of whatever currently sits at that slot.
 */
export function planReorder(currentIds, wantedIds) {
  const current = Array.isArray(currentIds) ? currentIds.slice() : []
  const ops = []
  // Only ids the Host still has can move; a saved order that names a deleted
  // workspace must not shuffle the rest into the wrong slots.
  const wanted = (Array.isArray(wantedIds) ? wantedIds : []).filter((id) => current.indexOf(id) !== -1)
  for (let i = 0; i < wanted.length; i += 1) {
    const id = wanted[i]
    const from = current.indexOf(id)
    if (from === -1 || from === i) continue
    const beforeId = current[i]
    ops.push({ movingId: id, beforeId })
    current.splice(from, 1)
    current.splice(i, 0, id)
  }
  return ops
}

const WS_FOLDER_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '3px 6px 2px',
  fontSize: 'calc(' + 'var(--dsh-content-font-size-secondary, 13px)' + ' - 2px)',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--dsw-alias-label-tertiary, #61666b)',
  cursor: 'pointer',
  userSelect: 'none',
}

export const TONE_ORDER = ['slate', 'blue', 'green', 'amber', 'rose', 'violet']

export const TONE_COLOR = {
  slate: '#8a8f98',
  blue: '#4a72d0',
  green: '#2f9e6b',
  amber: '#c8892f',
  rose: '#c2496a',
  violet: '#7a5cc4',
}

/** Glyphs a workspace can wear instead of the folder icon. */
export const GLYPHS = ['📁', '🚀', '🧪', '🐍', '⚙️', '📦', '🧭', '✨', '🧠', '🗂️']

export function appearanceOf(map, workspaceId) {
  const entry = (map && map[workspaceId]) || {}
  return {
    tone: TONE_COLOR[entry.tone] ? entry.tone : undefined,
    strong: entry.strong === true,
    glyph: typeof entry.glyph === 'string' && entry.glyph.length > 0 && entry.glyph.length <= 4 ? entry.glyph : undefined,
    note: typeof entry.note === 'string' && entry.note.length > 0 ? entry.note : undefined,
  }
}

export function withAppearance(map, workspaceId, patch) {
  const next = Object.assign({}, map || {})
  const merged = Object.assign({}, appearanceOf(next, workspaceId), patch || {})
  const entry = {}
  if (merged.tone) entry.tone = merged.tone
  if (merged.strong === true) entry.strong = true
  if (merged.glyph) entry.glyph = merged.glyph
  if (merged.note) entry.note = merged.note
  if (Object.keys(entry).length === 0) delete next[workspaceId]
  else next[workspaceId] = entry
  return next
}

export function readAppearance(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return {}
    const raw = store.getItem(LOOK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeAppearance(map, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(LOOK_KEY, JSON.stringify(map || {}))
  } catch {
    /* a locked-down webview must not break the tree */
  }
}

export const FOLDER_LOOK_PREFIX = 'folder:'

/**
 * A folder is only a title prefix, so its look is stored under a reserved key in the same map the
 * workspace looks use. One storage key means one migration when a folder is renamed.
 */
/**
 * Splits a title around the first case-insensitive occurrence of the filter, so a row can show WHY it
 * survived the filter instead of just being one of the survivors.
 */
export function highlightParts(text, query) {
  const whole = String(text === undefined || text === null ? '' : text)
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return { before: whole, hit: '', after: '' }
  const at = whole.toLowerCase().indexOf(needle)
  if (at < 0) return { before: whole, hit: '', after: '' }
  return {
    before: whole.slice(0, at),
    hit: whole.slice(at, at + needle.length),
    after: whole.slice(at + needle.length),
  }
}

export function folderLookOf(map, name) {
  return appearanceOf(map, FOLDER_LOOK_PREFIX + name)
}

export function withFolderLook(map, name, patch) {
  return withAppearance(map, FOLDER_LOOK_PREFIX + name, patch)
}

const WS_MARK = {
  borderRadius: '2px',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.1))',
}

const WS_TONE = {
  flex: 'none',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  boxShadow: '0 0 0 2px var(--dsw-alias-bg-base, transparent)',
}

const WS_SWATCH = {
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
  cursor: 'pointer',
  padding: 0,
}

const WS_PAINT_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 8px',
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

const WS_COST = { flex: 'none', marginLeft: '6px', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)', fontVariantNumeric: 'tabular-nums' }
const WS_COUNT_NOTE = {
  margin: '2px 4px 0',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 3px)',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
}

export function BetterWorkspace(props) {
  const services = props.services || {}
  const { ctx, slots } = services
  const standard = { wide: props.wide === true, expandSidebar: props.expandSidebar }
  const [expanded, setExpanded] = React.useState(() => readFolded().workspaces)
  const [menu, setMenu] = React.useState(null)
  const [armed, setArmed] = React.useState(null)
  const [adding, setAdding] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(-1)
  const typeBufferRef = React.useRef('')
  const typeTimerRef = React.useRef(null)
  const [hover, setHover] = React.useState(null)
  const [drag, setDrag] = React.useState(null)
  const [dropping, setDropping] = React.useState(null)
  const [look, setLook] = React.useState(() => readAppearance())
  const [noteDraft, setNoteDraft] = React.useState('')
  const [card, setCard] = React.useState(null)
  const folded = React.useMemo(() => readFolded(), [])
  const [folders, setFolders] = React.useState(folded.folders)
  const [declared, setDeclared] = React.useState(() => readFolders())
  const [folderDraft, setFolderDraft] = React.useState('')
  const [marks, setMarks] = React.useState(() => readMarks())
  const [presets, setPresets] = React.useState(() => readPresets())
  const [markDraft, setMarkDraft] = React.useState('')
  const [switcher, setSwitcher] = React.useState(null)
  const [density, setDensity] = React.useState(() => readDensity())
  const [pinOpen, setPinOpen] = React.useState(true)
  const [archiveOpen, setArchiveOpen] = React.useState(false)
  React.useEffect(() => { writeFolded({ workspaces: expanded, folders }) }, [expanded, folders])
  React.useEffect(() => { writeFolders(declared) }, [declared])
  React.useEffect(() => { writeMarks(marks) }, [marks])
  React.useEffect(() => { writePresets(presets) }, [presets])
  const [renaming, setRenaming] = React.useState(null)
  const [folderTarget, setFolderTarget] = React.useState(null)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [helpSeen, setHelpSeen] = React.useState(() => readHelp())
  const commitRename = async () => {
    const draft = renaming
    setRenaming(null)
    if (!draft) return
    const title = String(draft.value || '').trim()
    if (title === '' || title === draft.label) return
    if (draft.sessionId) {
      if (!services.requestRenameSession) return
      try {
        await services.requestRenameSession(draft.sessionId, title)
        setNotice('Renamed to ' + title + '.')
      } catch (error) {
        setNotice(error && error.message ? error.message : 'Could not rename that session.')
      }
      return
    }
    if (!services.renameWorkspace) return
    try {
      await services.renameWorkspace(draft.workspaceId, title)
      setNotice('Renamed to ' + title + '.')
    } catch {
      setNotice('Could not rename that workspace.')
    }
  }
  const [savedOrder, setSavedOrder] = React.useState(() => readOrder())
  const paintLook = (workspaceId, patch) => {
    setLook((prev) => {
      const next = withAppearance(prev, workspaceId, patch)
      writeAppearance(next)
      return next
    })
  }
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
  const [sort, setSort] = React.useState(() => readSort())
  const metrics = DENSITY_METRICS[densityOf(density)]
  const archiveSet = new Set((workspaceState && workspaceState.archivedSessionIds) || [])
  const split = splitArchived(sessionList, archiveSet)
  const byPin = splitPinned(split.active, (workspaceState && workspaceState.pinnedSessionIds) || [])
  const pinnedSessions = byPin.pinned
  const workspaceOfPinned = (sessionId) => {
    for (const group of workspaceRows(workspaceList, split.active)) {
      if (group.sessions.some((row) => row.id === sessionId)) return group.workspace
    }
    return undefined
  }
  const allRows = workspaceRows(workspaceList, byPin.rest)
  const archivedSessions = split.archived
  const rows = filterTree(sortRows(allRows, sort), query, pinned)
  const folderOf = (workspace) => folderKey(workspace)
  const visibleRows = rows.filter((group) => {
    const key = folderOf(group.workspace)
    return key === undefined || folders[key] !== true
  })
  const walk = flattenRows(visibleRows, expanded, query)
  const runtime = React.useMemo(() => menuRuntime(ctx, slots, standard), [ctx, slots, standard.wide])
  const RowBoundary = React.useMemo(() => rowBoundary(), [])
  const titleNode = (text) => {
    const parts = highlightParts(text, query)
    if (!parts.hit) return parts.before
    return [
      parts.before,
      React.createElement('mark', { key: 'hit', 'data-polish-hit': 'true', style: WS_MARK }, parts.hit),
      parts.after,
    ]
  }
  const entries = React.useMemo(() => rowMenuEntries(slots), [slots, workspaceList.length, sessionList.length])
  const totalCount = allRows.reduce((sum, row) => sum + row.sessions.length, 0)
  const shownCount = rows.reduce((sum, row) => sum + row.sessions.length, 0)
  const matchCount = query.trim()
    ? rows.length + rows.reduce((sum, row) => sum + row.sessions.length, 0)
    : 0
  const folderNames = folderNamesOf(rows, declared)
  // One click should always do the useful thing: if anything is folded, the button
  // expands everything (folders included); only when nothing is folded does it fold.
  const anyFolded = rows.some(row => expanded[row.workspace.workspaceId] === false)
    || folderNames.some(name => folders[name] === true)
  const allFolded = rows.length > 0 && !anyFolded

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

  React.useEffect(() => {
    const onOpen = (event) => {
      const key = (event.key || '').toLowerCase()
      if (!(event.ctrlKey || event.metaKey) || key !== 'k') return
      event.preventDefault()
      setSwitcher((prev) => (prev ? null : { query: '', index: 0 }))
    }
    const onEscape = (event) => {
      if (event.key === 'Escape') setSwitcher(null)
    }
    const onHelp = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.key !== '?') return
      event.preventDefault()
      setHelpOpen((prev) => {
        if (!prev) { writeHelp(true); setHelpSeen(true) }
        return !prev
      })
    }
    document.addEventListener('keydown', onHelp)
    document.addEventListener('keydown', onOpen)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('keydown', onOpen)
      document.removeEventListener('keydown', onEscape)
      document.removeEventListener('keydown', onHelp)
    }
  }, [])

  const switchItems = React.useMemo(() => {
    const items = []
    allRows.forEach((group) => {
      const workspace = workspaceLabel(group.workspace)
      items.push({ id: 'workspace:' + group.workspace.workspaceId, kind: 'workspace', workspaceId: group.workspace.workspaceId, title: workspace, workspace: '' })
      group.sessions.forEach((row) => {
        items.push({ id: row.id, kind: 'session', title: row.displayTitle || row.id, workspace })
      })
    })
    actionEntries(allRows).forEach((entry) => items.push(entry))
    return items
  }, [allRows])
  const switchHits = switcher ? rankMatches(switchItems, switcher.query) : []

  const runAction = (hit) => {
    const started = services.startSession(hit.workspaceId)
    Promise.resolve(started)
      .then(() => setNotice('Started a session in ' + hit.workspace + '.'))
      .catch((error) => setNotice(error && error.message ? error.message : 'Could not start a session.'))
  }

  const revealWorkspace = (workspaceId) => {
    const group = allRows.find((row) => row.workspace.workspaceId === workspaceId)
    if (!group) return
    const key = folderKey(group.workspace)
    if (key !== undefined) setFolders((prev) => Object.assign({}, prev, { [key]: false }))
    setExpanded((prev) => Object.assign({}, prev, { [workspaceId]: true }))
    setHover('workspace:' + workspaceId)
    setNotice('Jumped to ' + workspaceLabel(group.workspace) + '.')
  }

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
    if (anyFolded) {
      setExpanded({})
      setFolders({})
      return
    }
    const next = {}
    rows.forEach((row) => { next[row.workspace.workspaceId] = false })
    const nextFolders = {}
    folderNames.forEach((name) => { nextFolders[name] = true })
    setExpanded(next)
    setFolders(nextFolders)
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
    if (moving && moving.kind === 'pinned') {
      Promise.resolve()
        .then(() => services.unpinSession(moving.id))
        .then(() => setNotice('Unpinned that session.'))
        .catch(() => setNotice('Could not unpin that session.'))
      return
    }
    if (!moving || moving.kind !== 'workspace' || moving.id === targetId) return
    const target = rows.find((entry) => entry.workspace.workspaceId === targetId)
    const source = rows.find((entry) => entry.workspace.workspaceId === moving.id)
    if (!target || !source) { void reorderWorkspace(moving.id, targetId); return }
    const into = folderOf(target.workspace)
    const from = folderOf(source.workspace)
    void (async () => {
      try {
        if (into !== from) {
          await services.renameWorkspace(moving.id, fileUnder(workspaceLabel(source.workspace), into))
          setNotice(into ? 'Moved into ' + into + '.' : 'Moved to the top level.')
        }
        await reorderWorkspace(moving.id, targetId)
      } catch (error) {
        setNotice((error && error.message) || 'Could not move that workspace.')
      }
    })()
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
  /** [ and ] hop between workspace heads: the fast way through a long tree. */
  const hopWorkspace = (step) => {
    const next = jumpWorkspace(walk, cursor, step)
    if (next >= 0) setCursor(next)
  }
  const onKeyDown = (event) => {
    if (event.key === '[' || event.key === ']') {
      event.preventDefault()
      hopWorkspace(event.key === ']' ? 1 : -1)
      return
    }
    const typed = event.key
    if (typed.length === 1 && typed !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && walk.length > 0) {
      event.preventDefault()
      const next = (typeBufferRef.current + typed).toLowerCase()
      typeBufferRef.current = next
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current)
      typeTimerRef.current = setTimeout(() => { typeBufferRef.current = '' }, 700)
      const found = walk.findIndex((entry) => {
        const title = entry.kind === 'workspace'
          ? workspaceLabel((rows.find((item) => item.workspace.workspaceId === entry.workspaceId) || {}).workspace || {})
          : ((rows.find((item) => item.workspace.workspaceId === entry.workspaceId) || {}).sessions || [])
            .filter((item) => item.id === entry.id)
            .map((item) => String(item.displayTitle || item.title || ''))
            .join('')
        return String(title).toLowerCase().startsWith(next)
      })
      if (found >= 0) setCursor(found)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (walk.length === 0) return
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setCursor(Math.min(walk.length - 1, Math.max(0, cursor + step)))
      return
    }
    if ((event.key === 'Home' || event.key === 'End') && walk.length > 0) {
      event.preventDefault()
      setCursor(event.key === 'Home' ? 0 : walk.length - 1)
      return
    }
    if (event.key === 'Enter') {
      if (cursor < 0) return
      event.preventDefault()
      activate(walk[cursor])
      return
    }
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      if (cursor < 0 || !walk[cursor]) return
      event.preventDefault()
      const entry = walk[cursor]
      const group = rows.find((item) => item.workspace.workspaceId === entry.workspaceId)
      if (!group) return
      const row = entry.kind === 'workspace' ? undefined : (group.sessions || []).find((item) => item.id === entry.id)
      if (entry.kind !== 'workspace' && !row) return
      const selector = entry.kind === 'workspace'
        ? '[data-polish-ws-row="' + entry.id + '"]'
        : '[data-polish-ws-session="' + entry.id + '"]'
      const node = event.currentTarget.querySelector(selector)
      const box = node ? node.getBoundingClientRect() : event.currentTarget.getBoundingClientRect()
      const fake = { preventDefault: () => {}, stopPropagation: () => {}, clientX: Math.max(8, box.left + 12), clientY: box.bottom - 4 }
      if (entry.kind === 'workspace') openWorkspaceMenu(fake, group.workspace)
      else openMenu(fake, row, group.workspace)
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
        'data-polish-ws-rename': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const workspace = menu.workspace
          closeMenu()
          setNotice('')
          setRenaming({ workspaceId: workspace.workspaceId, label: workspaceLabel(workspace), value: workspaceLabel(workspace) })
        },
      }, 'Rename workspace…'),
      React.createElement('button', {
        type: 'button',
        'data-polish-order': 'remember',
        style: WS_MENU_ITEM,
        onClick: () => {
          closeMenu()
          const ids = workspaceList.map((workspace) => workspace.workspaceId)
          writeOrder(ids)
          setSavedOrder(ids)
          setNotice('Order saved.')
        },
      }, 'Remember this order'),
      savedOrder.length === 0
        ? null
        : React.createElement('button', {
          type: 'button',
          'data-polish-order': 'restore',
          style: WS_MENU_ITEM,
          onClick: async () => {
            closeMenu()
            const ops = planReorder(workspaceList.map((workspace) => workspace.workspaceId), savedOrder)
            if (ops.length === 0) { setNotice('Already in the saved order.'); return }
            try {
              for (const op of ops) await services.reorderWorkspace(op.movingId, op.beforeId)
              setNotice('Order restored.')
            } catch {
              setNotice('Could not restore that order.')
            }
          },
        }, 'Restore saved order'),
      folderOf(menu.workspace) === undefined
        ? null
        : React.createElement('button', {
          type: 'button',
          'data-polish-ws-unfile': menu.workspace.workspaceId,
          style: WS_MENU_ITEM,
          onClick: () => {
            const target = menu.workspace
            const title = unfiled(workspaceLabel(target))
            closeMenu()
            Promise.resolve()
              .then(() => services.renameWorkspace(target.workspaceId, title))
              .then(() => setNotice('Moved to the top level.'))
              .catch(() => setNotice('Could not move that workspace.'))
          },
        }, 'Move to top level'),
      React.createElement('button', {
        type: 'button',
        'data-polish-preset': 'save',
        style: WS_MENU_ITEM,
        onClick: () => {
          const target = menu.workspace
          const name = workspaceLabel(target)
          const saved = lookOf(look, target.workspaceId)
          closeMenu()
          if (!saved.tone && !saved.glyph && !saved.strong) { setNotice('Give this workspace a look first.'); return }
          setPresets((prev) => withPreset(prev, name, saved))
          setNotice('Saved the look of ' + name + '.')
        },
      }, 'Save this look as a preset'),
      presetNames(presets).map((name) => React.createElement('div', {
        key: 'preset:' + name,
        style: Object.assign({}, WS_MENU_ITEM, { display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }),
      },
      React.createElement('button', {
        type: 'button',
        'data-polish-preset-apply': name,
        style: Object.assign({}, WS_MENU_ITEM, { flex: '1 1 auto' }),
        onClick: () => {
          const target = menu.workspace
          const preset = presets[name]
          closeMenu()
          paintLook(target.workspaceId, preset)
          setNotice('Applied ' + name + '.')
        },
      }, 'Apply: ' + name),
      React.createElement('button', {
        type: 'button',
        'data-polish-preset-forget': name,
        title: 'Forget this preset',
        'aria-label': 'Forget this preset',
        style: Object.assign({}, WS_ROW_ACTION, { marginRight: '4px' }),
        onClick: () => {
          setPresets((prev) => withoutPreset(prev, name))
          setNotice('Forgot ' + name + '.')
        },
      }, '\u00d7'))),
      React.createElement('button', {
        type: 'button',
        'data-polish-folder-new': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const anchor = menu.anchor
          closeMenu()
          setFolderDraft('')
          setMenu({ kind: 'folder', anchor })
        },
      }, 'New folder…'),
      React.createElement('button', {
        type: 'button',
        'data-polish-glyph': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const target = menu.workspace
          const anchor = menu.anchor
          closeMenu()
          setMenu({ kind: 'glyph', workspace: target, anchor })
        },
      }, 'Glyph…'),
      React.createElement('button', {
        type: 'button',
        'data-polish-note': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const target = menu.workspace
          const anchor = menu.anchor
          closeMenu()
          setNoteDraft(appearanceOf(look, target.workspaceId).note || '')
          setMenu({ kind: 'note', workspace: target, anchor })
        },
      }, 'Note…'),
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-appearance': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const workspace = menu.workspace
          setMenu({ kind: 'paint', workspace, anchor: menu.anchor })
        },
      }, 'Colour and weight…'),
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

  const archivedMenu = menu && menu.kind === 'archived'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-unarchive': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: async () => {
          const row = menu.row
          closeMenu()
          try {
            await services.unarchiveSession(row.id)
            setNotice('Restored that session.')
          } catch {
            setNotice('Could not restore that session.')
          }
        },
      }, 'Unarchive session'),
      React.createElement('button', {
        type: 'button',
        'data-polish-archived-open': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: () => {
          const row = menu.row
          closeMenu()
          try { services.openSession(row.id) } catch { setNotice('Could not open that session.') }
        },
      }, 'Open session'),
      React.createElement('button', {
        type: 'button',
        'data-polish-archived-copy': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: async () => {
          const row = menu.row
          closeMenu()
          try {
            await navigator.clipboard.writeText(row.id)
            setNotice('Copied the session id.')
          } catch {
            setNotice('Could not copy the session id.')
          }
        },
      }, 'Copy session id'))
    : null

  const folderMenu = menu && menu.kind === 'folder'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('input', {
        'data-polish-folder-input': 'true',
        type: 'text',
        value: folderDraft,
        placeholder: 'Folder name',
        autoFocus: true,
        style: WS_NOTE_INPUT,
        onChange: (event) => setFolderDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closeMenu(); return }
          if (event.key !== 'Enter') return
          const next = addFolder(declared, folderDraft)
          closeMenu()
          if (next.length === declared.length) { setNotice('That folder already exists.'); return }
          setDeclared(next)
          setFolders((prev) => Object.assign({}, prev, { [next[next.length - 1]]: false }))
          setNotice('Folder added.')
        },
      }),
      React.createElement('div', { style: WS_MENU_HINT }, 'Enter creates, Escape cancels'))
    : null

  const renameFolderMenu = menu && menu.kind === 'renameFolder'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('input', {
        'data-polish-folder-edit-input': 'true',
        type: 'text',
        value: folderDraft,
        placeholder: 'Folder name',
        autoFocus: true,
        style: WS_NOTE_INPUT,
        onChange: (event) => setFolderDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closeMenu(); return }
          if (event.key !== 'Enter') return
          const target = cleanFolder(folderDraft)
          const moving = menu.members || []
          const from = menu.folder
          closeMenu()
          if (!target || target === from) return
          Promise.resolve()
            .then(async () => {
              for (const workspace of moving) {
                await services.renameWorkspace(workspace.workspaceId, fileUnder(workspaceLabel(workspace), target))
              }
            })
            .then(() => {
              setDeclared((prev) => addFolder(removeFolder(prev, from), target))
              setFolders((prev) => {
                const next = Object.assign({}, prev)
                if (next[from] !== undefined) next[target] = next[from]
                delete next[from]
                return next
              })
              setLook((prev) => {
                const next = Object.assign({}, prev)
                if (next[FOLDER_LOOK_PREFIX + from] !== undefined) next[FOLDER_LOOK_PREFIX + target] = next[FOLDER_LOOK_PREFIX + from]
                delete next[FOLDER_LOOK_PREFIX + from]
                return next
              })
              setNotice('Folder renamed.')
            })
            .catch(() => setNotice('Could not rename that folder.'))
        },
      }),
      React.createElement('div', { style: WS_MENU_HINT }, 'Renames every workspace inside it'))
    : null

  const folderLookMenu = menu && menu.kind === 'folderLook'
    ? (() => {
      const current = folderLookOf(look, menu.folder)
      const paint = (patch) => setLook((prev) => {
        const next = withFolderLook(prev, menu.folder, patch)
        writeAppearance(next)
        return next
      })
      return React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
        React.createElement('div', { style: WS_PAINT_ROW },
          TONE_ORDER.map((tone) => React.createElement('button', {
            key: tone,
            type: 'button',
            'data-polish-folder-tone-pick': tone,
            'aria-label': 'Colour ' + tone,
            title: tone,
            style: Object.assign({}, WS_SWATCH, {
              background: TONE_COLOR[tone],
              boxShadow: current.tone === tone ? '0 0 0 1.5px var(--dsw-alias-label-secondary, #61666b)' : undefined,
            }),
            onClick: () => paint({ tone }),
          })),
          React.createElement('button', {
            key: 'none',
            type: 'button',
            'data-polish-folder-tone-pick': 'none',
            'aria-label': 'No colour',
            title: 'No colour',
            style: Object.assign({}, WS_SWATCH, { background: 'transparent' }),
            onClick: () => paint({ tone: undefined }),
          })),
        React.createElement('div', { style: WS_GLYPH_GRID },
          GLYPHS.map((glyph) => React.createElement('button', {
            key: glyph,
            type: 'button',
            'data-polish-folder-glyph-pick': glyph,
            'aria-label': 'Glyph ' + glyph,
            title: 'Use ' + glyph,
            style: Object.assign({}, WS_GLYPH_BUTTON, {
              background: current.glyph === glyph ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06))' : undefined,
            }),
            onClick: () => paint({ glyph: current.glyph === glyph ? undefined : glyph }),
          }, glyph))),
        React.createElement('button', {
          type: 'button',
          'data-polish-folder-strong': current.strong ? 'on' : 'off',
          style: WS_MENU_ITEM,
          onClick: () => paint({ strong: !current.strong }),
        }, current.strong ? 'Weight: bold \u2713' : 'Weight: normal'),
        React.createElement('div', { style: WS_MENU_HINT }, 'Colour, glyph and weight for this folder'),
        React.createElement('button', {
          type: 'button',
          'data-polish-folder-look-rename': menu.folder,
          style: WS_MENU_ITEM,
          onClick: () => {
            const anchor = menu.anchor
            const moving = rows.filter((entry) => folderOf(entry.workspace) === menu.folder).map((entry) => entry.workspace)
            setFolderDraft(menu.folder)
            setMenu({ kind: 'renameFolder', folder: menu.folder, anchor, members: moving })
          },
        }, 'Rename folder\u2026'),
        menu.empty
          ? React.createElement('button', {
            type: 'button',
            'data-polish-folder-look-remove': menu.folder,
            style: WS_MENU_ITEM,
            onClick: () => {
              const name = menu.folder
              setDeclared((prev) => removeFolder(prev, name))
              setLook((prev) => {
                const next = withFolderLook(prev, name, { tone: undefined, glyph: undefined, strong: false })
                writeAppearance(next)
                return next
              })
              setNotice('Folder removed.')
              closeMenu()
            },
          }, 'Remove this folder')
          : null)
    })()
    : null

  const markMenu = menu && menu.kind === 'mark'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('input', {
        'data-polish-mark-input': 'true',
        type: 'text',
        value: markDraft,
        placeholder: 'A note for this session',
        autoFocus: true,
        style: WS_NOTE_INPUT,
        onChange: (event) => setMarkDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closeMenu(); return }
          if (event.key !== 'Enter') return
          const id = menu.row.id
          const value = markDraft.trim()
          closeMenu()
          setMarks((prev) => withMark(prev, id, { note: value }))
        },
      }),
      React.createElement('div', { style: WS_MENU_HINT }, 'Enter saves, Escape cancels'))
    : null

  const glyphMenu = menu && menu.kind === 'glyph'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('div', { style: WS_GLYPH_GRID },
        GLYPHS.map((glyph) => React.createElement('button', {
          key: 'glyph:' + glyph,
          type: 'button',
          'data-polish-glyph-pick': glyph,
          title: 'Use ' + glyph,
          style: Object.assign({}, WS_GLYPH_BUTTON, {
            background: appearanceOf(look, menu.workspace.workspaceId).glyph === glyph
              ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06))'
              : undefined,
          }),
          onClick: () => {
            const target = menu.workspace
            closeMenu()
            paintLook(target.workspaceId, { glyph })
          },
        }, glyph)),
        React.createElement('button', {
          key: 'glyph:none',
          type: 'button',
          'data-polish-glyph-pick': 'none',
          style: WS_GLYPH_BUTTON,
          onClick: () => {
            const target = menu.workspace
            closeMenu()
            paintLook(target.workspaceId, { glyph: '' })
          },
        }, '⌫')))
    : null

  const noteMenu = menu && menu.kind === 'note'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('input', {
        'data-polish-note-input': 'true',
        type: 'text',
        value: noteDraft,
        placeholder: 'A note for this workspace',
        autoFocus: true,
        style: WS_NOTE_INPUT,
        onChange: (event) => setNoteDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closeMenu(); return }
          if (event.key !== 'Enter') return
          const target = menu.workspace
          const value = noteDraft.trim()
          closeMenu()
          paintLook(target.workspaceId, { note: value })
        },
      }),
      React.createElement('div', { style: WS_MENU_HINT }, 'Enter saves, Escape cancels'))
    : null

  const noteCard = card
    ? ReactDOM.createPortal(React.createElement('div', {
      'data-polish-note-card': 'true',
      style: Object.assign({}, WS_NOTE_CARD, { top: card.top, left: card.left }),
    }, card.text), document.body)
    : null

  const paintMenu = menu && menu.kind === 'paint'
    ? (() => {
      const workspace = menu.workspace
      const current = appearanceOf(look, workspace.workspaceId)
      return React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
        React.createElement('div', { style: WS_PAINT_ROW },
          TONE_ORDER.map((tone) => React.createElement('button', {
            key: tone,
            type: 'button',
            'data-polish-tone': tone,
            'aria-label': 'Colour ' + tone,
            title: tone,
            style: Object.assign({}, WS_SWATCH, {
              background: TONE_COLOR[tone],
              boxShadow: current.tone === tone
                ? '0 0 0 1.5px var(--dsw-alias-label-secondary, #61666b)'
                : undefined,
            }),
            onClick: () => paintLook(workspace.workspaceId, { tone }),
          })),
          React.createElement('button', {
            key: 'none',
            type: 'button',
            'data-polish-tone': 'none',
            'aria-label': 'No colour',
            title: 'No colour',
            style: Object.assign({}, WS_SWATCH, { background: 'transparent' }),
            onClick: () => paintLook(workspace.workspaceId, { tone: undefined }),
          })),
        React.createElement('button', {
          type: 'button',
          'data-polish-ws-strong': current.strong ? 'on' : 'off',
          style: WS_MENU_ITEM,
          onClick: () => paintLook(workspace.workspaceId, { strong: !current.strong }),
        }, current.strong ? 'Weight: bold ✓' : 'Weight: normal'))
    })()
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
      React.createElement('button', {
        type: 'button',
        'data-polish-session-flag': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: () => {
          const row = menu.row
          const current = markOf(marks, row.id)
          closeMenu()
          setMarks((prev) => withMark(prev, row.id, { flag: !current.flag }))
        },
      }, markOf(marks, menu.row.id).flag ? 'Remove flag' : 'Flag this session'),
      React.createElement('button', {
        type: 'button',
        'data-polish-session-note': menu.row.id,
        style: WS_MENU_ITEM,
        onClick: () => {
          const row = menu.row
          const anchor = menu.anchor
          closeMenu()
          setMarkDraft(markOf(marks, row.id).note || '')
          setMenu({ kind: 'mark', row, anchor })
        },
      }, 'Session note…'))
    : null

  const HELP_ROWS = [
    ['Enter', 'open the highlighted session'],
    ['[ / ]', 'jump to the previous or next workspace'],
    ['/', 'focus the filter; Escape clears it'],
    ['Ctrl+K', 'jump to any session or workspace'],
    ['Shift+F10', 'open the row menu'],
    ['Alt+click', 'a folder, to fold every other folder'],
    ['Double-click', 'a workspace or session, to rename it'],
    ['Drag', 'a row onto another to move it there'],
    ['?', 'this sheet'],
  ]
  const helpCard = helpOpen
    ? ReactDOM.createPortal(
      React.createElement('div', {
        'data-polish-ws-help': 'open',
        style: Object.assign({}, SWITCHER_BACKDROP, { zIndex: 1350 }),
        onPointerDown: (event) => { if (event.target === event.currentTarget) setHelpOpen(false) },
      },
      React.createElement('div', {
        style: Object.assign({}, SWITCHER_CARD, { padding: '14px 16px', width: 'min(440px, calc(100vw - 32px))', maxHeight: '70vh' }),
      },
      React.createElement('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Workspace shortcuts'),
      HELP_ROWS.map((pair) => React.createElement('div', {
        key: pair[0],
        'data-polish-ws-help-row': pair[0],
        style: { display: 'flex', gap: '12px', padding: '3px 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #61666b)' },
      },
        React.createElement('span', { style: { minWidth: '92px', fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-primary, #1f2328)' } }, pair[0]),
        React.createElement('span', null, pair[1]))),
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-help-close': 'true',
        style: Object.assign({}, WS_ROW_ACTION, { width: 'auto', padding: '0 10px', marginTop: '10px', height: '24px' }),
        onClick: () => setHelpOpen(false),
      }, 'Close'))),
      document.body)
    : null
  const helpHint = !helpSeen && !helpOpen
    ? React.createElement('div', {
        'data-polish-ws-help-hint': 'true',
        style: { padding: '2px 6px 4px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #8a8f98)' },
      },
      'Press ', React.createElement('kbd', null, '?'), ' for the shortcuts.')
    : null

  const switcherCard = switcher
    ? ReactDOM.createPortal(React.createElement('div', {
      'data-polish-switcher': 'open',
      style: SWITCHER_BACKDROP,
      onPointerDown: (event) => { if (event.target === event.currentTarget) setSwitcher(null) },
    },
    React.createElement('div', { style: SWITCHER_CARD },
      React.createElement('input', {
        'data-polish-switcher-input': 'true',
        autoFocus: true,
        value: switcher.query,
        placeholder: 'Jump to a session…',
        'aria-label': 'Jump to a session',
        style: SWITCHER_INPUT,
        onChange: (event) => setSwitcher(Object.assign({}, switcher, { query: event.target.value, index: 0 })),
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (switchHits.length === 0) return
            event.preventDefault()
            const step = event.key === 'ArrowDown' ? 1 : -1
            const next = (switcher.index + step + switchHits.length) % switchHits.length
            setSwitcher(Object.assign({}, switcher, { index: next }))
            return
          }
          if (event.key === 'Enter') {
            const hit = switchHits[switcher.index]
            if (!hit) return
            event.preventDefault()
            setSwitcher(null)
            if (hit.kind === 'workspace') {
              revealWorkspace(hit.workspaceId)
              return
            }
            if (hit.kind === 'action') {
              runAction(hit)
              return
            }
            services.openSession(hit.id)
          }
        },
      }),
      React.createElement('div', { 'data-polish-switcher-list': 'true', style: SWITCHER_LIST },
        switchHits.length === 0
          ? React.createElement('div', { style: Object.assign({}, SWITCHER_ROW, { cursor: 'default' }) }, 'No session matches that.')
          : switchHits.map((hit, at) => React.createElement('button', {
            key: hit.id,
            type: 'button',
            'data-polish-switcher-action': hit.kind === 'action' ? hit.workspaceId : undefined,
            'data-polish-switcher-row': hit.id,
            style: Object.assign({}, SWITCHER_ROW, {
              background: at === switcher.index ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))' : 'transparent',
            }),
            onPointerDown: (event) => event.preventDefault(),
            onClick: () => {
              setSwitcher(null)
              if (hit.kind === 'workspace') { revealWorkspace(hit.workspaceId); return }
              if (hit.kind === 'action') { runAction(hit); return }
              services.openSession(hit.id)
            },
          },
          React.createElement('span', { style: WS_TITLE }, hit.kind === 'workspace' ? '\u2302 ' + hit.title : (hit.kind === 'action' ? '\u25B8 ' + hit.title : hit.title)),
          React.createElement('span', { style: SWITCHER_HINT }, hit.kind === 'workspace' ? 'workspace' : (hit.kind === 'action' ? 'action' : hit.workspace))))))), document.body)
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
      key: 'copy',
      type: 'button',
      'data-polish-ws-copy': 'tree',
      title: 'Copy the tree as text',
      'aria-label': 'Copy the tree as text',
      style: WS_ADD,
      onClick: () => {
        const text = treeText(rows, folderNames, (id) => markOf(marks, id))
        Promise.resolve(navigator.clipboard.writeText(text))
          .then(() => setNotice('Tree copied.'))
          .catch(() => setNotice('Could not copy the tree.'))
      },
    }, '⧉'),
    React.createElement('button', {
      key: 'sort',
      type: 'button',
      'data-polish-ws-sort': sortOf(sort),
      title: sortOf(sort) === 'name' ? 'Sort workspaces by host order' : 'Sort workspaces A to Z',
      style: WS_ADD,
      onClick: () => {
        const next = sortOf(sort) === 'name' ? 'host' : 'name'
        writeSort(next)
        setSort(next)
      },
    }, sortOf(sort) === 'name' ? 'A→Z' : '↕'),
    React.createElement('button', {
      key: 'density',
      type: 'button',
      'data-polish-ws-density': densityOf(density),
      title: DENSITY_TITLES[densityOf(density)],
      'aria-label': DENSITY_TITLES[densityOf(density)],
      style: WS_ADD,
      onClick: () => {
        const next = nextDensity(density)
        setDensity(next)
        writeDensity(next)
      },
    }, DENSITY_GLYPHS[densityOf(density)]),
    React.createElement('button', {
      key: 'help',
      type: 'button',
      'data-polish-ws-help-open': 'true',
      title: 'Workspace shortcuts',
      'aria-label': 'Workspace shortcuts',
      style: WS_ADD,
      onClick: () => { writeHelp(true); setHelpSeen(true); setHelpOpen(true) },
    }, '?'),
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

  if (query.trim()) {
    children.push(React.createElement('div', {
      key: 'matches',
      'data-polish-ws-matches': String(matchCount),
      style: WS_MENU_HINT,
    }, matchCount === 0
      ? 'Nothing matches "' + query.trim() + '".'
      : matchCount + (matchCount === 1 ? ' match' : ' matches')))
  }

  if (helpHint) children.push(helpHint)

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
        const into = folderTarget
        try {
          const created = await services.createWorkspace(path)
          setAdding(false)
          setFolderTarget(null)
          if (into && created && services.renameWorkspace) {
            await services.renameWorkspace(created.workspaceId, fileUnder(workspaceLabel(created), into))
            setNotice('Added it inside ' + into + '.')
          }
        } catch (error) {
          setNotice((error && error.message) || 'Could not add that folder.')
        }
      },
      onCancel: () => { setAdding(false); setFolderTarget(null) },
      onError: (message) => setNotice(message || 'Could not add that folder.'),
    }))
  }

  if (renaming) {
    children.push(React.createElement('input', {
      key: 'rename',
      'data-polish-ws-rename-input': 'true',
      'data-polish-session-rename-input': renaming.sessionId ? renaming.sessionId : undefined,
      autoFocus: true,
      value: renaming.value,
      placeholder: renaming.sessionId ? 'Session title' : 'Workspace name (use Work/Name to file it)',
      'aria-label': renaming.sessionId ? 'Session title' : 'Workspace name',
      style: WS_FILTER,
      onChange: (event) => setRenaming(Object.assign({}, renaming, { value: event.target.value })),
      onKeyDown: (event) => {
        if (event.key === 'Escape') { event.stopPropagation(); setRenaming(null); return }
        if (event.key !== 'Enter') return
        event.preventDefault()
        void commitRename()
      },
      onBlur: () => { void commitRename() },
    }))
  }

  if (rows.length === 0) {
    children.push(React.createElement('div', {
      key: 'empty',
      style: { padding: '8px 6px', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)' },
    }, query ? 'Nothing matches "' + query + '".' : 'No workspace yet.'))
  }

  let index = -1
  const announced = {}

  const sessionRow = (workspace, row, groupIndex) => {
    const sessionCost = costLabel(costOf(sessionState, row.id))
    const rowFocused = cursor === groupIndex
    const rowHovered = hover === 'session:' + row.id
    const lifted = dropping === 'session:' + row.id
    return React.createElement('div', {
      key: 'session:' + row.id,
      'data-polish-ws-session': row.id,
      'data-polish-cursor': rowFocused ? 'true' : undefined,
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
      onDoubleClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
        const title = row.displayTitle || row.id
        setRenaming({ sessionId: row.id, label: title, value: title })
      },
      onContextMenu: (event) => openMenu(event, row, workspace),
      onMouseEnter: (event) => {
        setHover('session:' + row.id)
        const note = markOf(marks, row.id).note
        if (!note) return
        const box = event.currentTarget.getBoundingClientRect()
        setCard({ text: note, top: box.bottom + 6, left: Math.max(8, box.left) })
      },
      onMouseLeave: () => { setHover(null); setCard(null) },
      onDragStart: () => setDrag({ kind: 'session', id: row.id, workspaceId: workspace.workspaceId }),
      onDragOver: (event) => {
        if (!drag || drag.kind !== 'session' || drag.id === row.id) return
        event.preventDefault()
        setDropping('session:' + row.id)
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event) => { event.preventDefault(); dropOnSession(workspace.workspaceId, row.id) },
    },
    row.running ? React.createElement('span', { 'data-polish-session-running': row.id, style: WS_DOT, title: 'Running' }) : null,
    pinned.has(row.id) ? React.createElement('span', { style: WS_PIN, title: 'Pinned' }, '\u2605') : null,
    markOf(marks, row.id).flag
      ? React.createElement('span', { 'data-polish-mark-flag': row.id, style: WS_PIN, title: 'Flagged' }, '⚑')
      : null,
    React.createElement('span', {
      style: Object.assign({}, WS_TITLE, {
        fontStyle: markOf(marks, row.id).note ? 'italic' : undefined,
      }),
    }, titleNode(row.displayTitle || row.id)),
    sessionCost
      ? React.createElement('span', { 'data-polish-ws-cost': row.id, style: WS_COST }, sessionCost)
      : null,
    rowHovered || rowFocused
      ? React.createElement('button', {
        type: 'button',
        'data-polish-session-pin': row.id,
        title: pinned.has(row.id) ? 'Unpin this session' : 'Pin this session',
        'aria-label': pinned.has(row.id) ? 'Unpin this session' : 'Pin this session',
        style: WS_ROW_ACTION,
        onClick: (event) => {
          event.stopPropagation()
          if (pinned.has(row.id)) services.unpinSession(row.id)
          else services.pinSession(row.id)
        },
      }, pinned.has(row.id) ? '\u2605' : '\u2606')
      : null,
    rowHovered || rowFocused
      ? React.createElement('button', {
        type: 'button',
        'data-polish-ws-menu': 'session',
        'aria-label': 'Session menu',
        style: WS_ROW_ACTION,
        onClick: (event) => openMenu(event, row, workspace),
      }, React.createElement(DotsGlyph))
      : null)
  }

  rows.forEach((group) => {
    const workspace = group.workspace
    const sessions = group.sessions
    const folder = folderOf(workspace)
    const folderLook = folder === undefined ? {} : folderLookOf(look, folder)
    const folded = folder !== undefined && folders[folder] === true

    if (folder !== undefined && !announced[folder]) {
      /* handled below for both filled and empty folders */
      announced[folder] = true
      const inside = rows.filter((entry) => folderOf(entry.workspace) === folder)
      children.push(React.createElement('div', {
        key: 'folder:' + folder,
        'data-polish-ws-folder': folder,
        role: 'group',
        'aria-label': folder,
        title: folded ? 'Expand ' + folder : 'Collapse ' + folder,
        style: Object.assign({}, WS_FOLDER_ROW, {
          background: dropping === 'folder:' + folder
            ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
            : undefined,
        }),
        onClick: (event) => {
          const collapseSiblings = event.altKey === true
          setFolders((prev) => {
            const next = Object.assign({}, prev)
            if (!collapseSiblings) {
              next[folder] = prev[folder] !== true
              return next
            }
            const folding = prev[folder] !== true
            folderNames.forEach((name) => { if (name !== folder) next[name] = folding })
            next[folder] = prev[folder] !== true
            return next
          })
          if (collapseSiblings) setNotice('Alt+click folds the other folders too.')
        },
        onContextMenu: (event) => {
          event.preventDefault()
          event.stopPropagation()
          setMenu({ kind: 'folderLook', folder, anchor: { top: event.clientY, left: event.clientX }, empty: declared.indexOf(folder) !== -1 && inside.length === 0 })
        },
        onDragOver: (event) => {
          if (!drag || drag.kind !== 'workspace') return
          if (folderOf(rows.find((entry) => entry.workspace.workspaceId === drag.id)?.workspace) === folder) return
          event.preventDefault()
          setDropping('folder:' + folder)
        },
        onDragLeave: () => setDropping(null),
        onDrop: (event) => {
          event.preventDefault()
          setDropping(null)
          if (!drag || drag.kind !== 'workspace') return
          const moving = rows.find((entry) => entry.workspace.workspaceId === drag.id)
          if (!moving || folderOf(moving.workspace) === folder) return
          const title = fileUnder(workspaceLabel(moving.workspace), folder)
          Promise.resolve()
            .then(() => services.renameWorkspace(moving.workspace.workspaceId, title))
            .then(() => setNotice('Filed under ' + folder + '.'))
            .catch(() => setNotice('Could not file that workspace.'))
        },
      },
      React.createElement('span', { 'aria-hidden': 'true' }, folded ? '\u203A' : '\u2304'),
      folderLook.tone
        ? React.createElement('span', {
          'data-polish-folder-tone': folder,
          'aria-hidden': 'true',
          style: Object.assign({}, WS_TONE, { background: TONE_COLOR[folderLook.tone] }),
        })
        : null,
      folderLook.glyph
        ? React.createElement('span', { 'data-polish-folder-glyph': folder, 'aria-hidden': 'true', style: WS_GLYPH }, folderLook.glyph)
        : null,
      React.createElement('span', { style: folderLook.strong ? Object.assign({}, WS_TITLE, { fontWeight: 600 }) : WS_TITLE }, folder),
      React.createElement('button', {
        type: 'button',
        'data-polish-folder-edit': folder,
        'aria-label': 'Rename the folder ' + folder,
        title: 'Rename this folder',
        style: WS_ROW_ACTION,
        onClick: (event) => {
          event.stopPropagation()
          const box = event.currentTarget.getBoundingClientRect()
          setFolderDraft(folder)
          setMenu({ kind: 'renameFolder', folder, anchor: { top: box.bottom + 4, left: box.left }, members: inside.map((entry) => entry.workspace) })
        },
      }, '✎'),
      React.createElement('span', { style: WS_COUNT }, [String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)), folderCostNode(inside, sessionState, folder),
      folderHasRunning(inside)
        ? React.createElement('span', { 'data-polish-folder-running': folder, title: 'A session inside is running', style: WS_DOT })
        : null,
      React.createElement('button', {
        type: 'button',
        key: 'folder-add',
        'data-polish-folder-add': folder,
        title: 'Add a workspace inside this folder',
        'aria-label': 'Add a workspace inside the folder ' + folder,
        style: Object.assign({}, WS_ROW_ACTION, { marginLeft: '2px' }),
        onClick: (event) => {
          event.stopPropagation()
          setFolderTarget(folder)
          setAdding(true)
        },
      }, '+')])))
    }

    if (folded) return

    index += 1
    const open = expanded[workspace.workspaceId] !== false
    const focused = cursor === index
    const hovered = hover === 'workspace:' + workspace.workspaceId
    const dropHere = dropping === 'workspace:' + workspace.workspaceId
    const looks = appearanceOf(look, workspace.workspaceId)
    const rowCost = sumCostLabel(sessions, sessionState)

    children.push(React.createElement('div', {
      key: 'workspace:' + workspace.workspaceId,
      style: { display: 'flex', flexDirection: 'column' },
    },
    React.createElement('div', {
      'data-polish-ws-row': workspace.workspaceId,
      'data-polish-cursor': focused ? 'true' : undefined,
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
      title: looks.note || undefined,
      onMouseEnter: (event) => {
        setHover('workspace:' + workspace.workspaceId)
        const note = appearanceOf(look, workspace.workspaceId).note
        if (!note) return
        const box = event.currentTarget.getBoundingClientRect()
        setCard({ text: note, top: box.bottom + 6, left: Math.max(8, box.left) })
      },
      onMouseLeave: () => { setHover(null); setCard(null) },
      onDragStart: () => setDrag({ kind: 'workspace', id: workspace.workspaceId }),
      onDragOver: (event) => {
        if (!drag) return
        if (drag.kind === 'pinned') {
          event.preventDefault()
          setDropping('workspace:' + workspace.workspaceId)
          return
        }
        if (drag.kind !== 'workspace' || drag.id === workspace.workspaceId) return
        event.preventDefault()
        setDropping('workspace:' + workspace.workspaceId)
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event) => { event.preventDefault(); dropOnWorkspace(workspace.workspaceId) },
    },
    React.createElement(CaretGlyph, { open }),
    looks.glyph
      ? React.createElement('span', { 'data-polish-ws-glyph': looks.glyph, style: WS_GLYPH }, looks.glyph)
      : React.createElement(FolderGlyph),
    looks.tone
      ? React.createElement('span', { style: Object.assign({}, WS_TONE, { background: TONE_COLOR[looks.tone] }) })
      : null,
    React.createElement('span', {
      style: Object.assign({}, WS_TITLE, { fontWeight: looks.strong ? 600 : undefined }),
    }, titleNode(workspaceLabel(workspace))),
    React.createElement('span', { style: WS_COUNT }, String(sessions.length)),
    rowCost
      ? React.createElement('span', { 'data-polish-ws-cost-total': workspace.workspaceId, style: Object.assign({}, WS_COST, { marginLeft: '6px' }) }, rowCost)
      : null,
    React.createElement('button', {
      type: 'button',
      'data-polish-ws-new-session': workspace.workspaceId,
      title: 'New session in this workspace',
      'aria-label': 'New session in this workspace',
      style: Object.assign({}, WS_ROW_ACTION, { marginLeft: '2px' }),
      onClick: (event) => {
        event.stopPropagation()
        try {
          services.startSession(workspace.workspaceId)
          setNotice('Started a session.')
        } catch (error) {
          setNotice((error && error.message) || 'Could not start a session.')
        }
      },
    }, '+'),
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
      (metrics.sessions ? sessions : []).forEach((row) => {
        index += 1
        children.push(sessionRow(workspace, row, index))
      })
    }
  })

  const filled = new Set(rows.map(row => folderKey(row.workspace)).filter(Boolean))
  for (const folder of folderNames) {
    if (filled.has(folder)) continue
    const empty = folders[folder] === true
    children.push(React.createElement('div', {
      key: 'empty-folder:' + folder,
      'data-polish-ws-empty': folder,
      role: 'group',
      'aria-label': folder,
      title: 'Drop a workspace here to file it in ' + folder,
      style: Object.assign({}, WS_FOLDER_ROW, {
        background: dropping === 'folder:' + folder
          ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
          : undefined,
      }),
      onDragOver: (event) => {
        if (!drag || drag.kind !== 'workspace') return
        event.preventDefault()
        setDropping('folder:' + folder)
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event) => {
        event.preventDefault()
        setDropping(null)
        if (!drag || drag.kind !== 'workspace') return
        const moving = rows.find((entry) => entry.workspace.workspaceId === drag.id)
        if (!moving) return
        const title = fileUnder(workspaceLabel(moving.workspace), folder)
        Promise.resolve()
          .then(() => services.renameWorkspace(moving.workspace.workspaceId, title))
          .then(() => setNotice('Filed under ' + folder + '.'))
          .catch(() => setNotice('Could not file that workspace.'))
      },
    },
    React.createElement('span', { 'aria-hidden': 'true' }, '⌄'),
    React.createElement('span', { style: WS_TITLE }, folder),
    React.createElement('span', { style: WS_COUNT_NOTE }, 'empty'),
    React.createElement('button', {
      type: 'button',
      'data-polish-folder-remove': folder,
      'aria-label': 'Remove the empty folder ' + folder,
      title: 'Remove this empty folder',
      style: WS_ROW_ACTION,
      onClick: (event) => {
        event.stopPropagation()
        setDeclared(removeFolder(declared, folder))
        setNotice('Folder removed.')
      },
    }, '×')))
    if (!empty) continue
  }

  // The section materialises while a session is being dragged, so a drop target exists before the
  // first pin — otherwise there is nowhere to drop the session that would create the section.
  if (pinnedSessions.length > 0 || (drag && drag.kind === 'session')) {
    children.push(React.createElement('div', {
      key: 'pinned-head',
      'data-polish-ws-pinned': 'head',
      style: Object.assign({}, WS_SECTION, {
        background: dropping === 'pinned'
          ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
          : undefined,
      }),
      onClick: () => setPinOpen((open) => !open),
      onDragOver: (event) => {
        if (!drag || drag.kind !== 'session') return
        event.preventDefault()
        setDropping('pinned')
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event) => {
        event.preventDefault()
        setDropping(null)
        if (!drag || drag.kind !== 'session') return
        const moving = drag
        setDrag(null)
        Promise.resolve()
          .then(() => services.pinSession(moving.id))
          .then(() => setNotice('Pinned that session.'))
          .catch(() => setNotice('Could not pin that session.'))
      },
    },
    React.createElement('span', { 'aria-hidden': 'true' }, pinOpen ? '\u2304' : '\u203a'),
    React.createElement('span', { style: WS_TITLE }, 'Pinned'),
    React.createElement('span', { style: WS_COUNT }, String(pinnedSessions.length))))

    if (pinOpen) {
      for (const row of pinnedSessions) {
        const group = workspaceOfPinned(row.id)
        children.push(React.createElement('div', {
          key: 'pinned:' + row.id,
          'data-polish-ws-pinned-row': row.id,
          draggable: true,
          onDragStart: () => setDrag({ kind: 'pinned', id: row.id, workspaceId: group ? group.workspaceId : undefined }),
          onMouseEnter: () => setHover('pinned:' + row.id),
          onMouseLeave: () => setHover(null),
          title: 'Pinned session',
          style: WS_ROW,
          onClick: () => services.openSession(row.id),
          onContextMenu: (event) => {
            event.preventDefault()
            event.stopPropagation()
            setMenu({ kind: 'session', row, workspace: group, anchor: { top: event.clientY, left: event.clientX } })
          },
        },
        React.createElement('span', { style: WS_PIN, 'aria-hidden': 'true' }, '\u2605'),
        row.running ? React.createElement('span', { 'data-polish-pinned-running': row.id, style: WS_DOT, title: 'Running' }) : null,
        React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
        costLabel(costOf(sessionState, row.id))
          ? React.createElement('span', { 'data-polish-pinned-cost': row.id, style: WS_COST }, costLabel(costOf(sessionState, row.id)))
          : null,
        React.createElement('span', { style: WS_COUNT_NOTE }, group ? workspaceLabel(group) : ''),
        hover === 'pinned:' + row.id
          ? React.createElement('button', {
            type: 'button',
            'data-polish-pinned-unpin': row.id,
            title: 'Unpin this session',
            'aria-label': 'Unpin this session',
            style: WS_ROW_ACTION,
            onClick: (event) => { event.stopPropagation(); services.unpinSession(row.id) },
          }, '\u2605')
          : null))
      }
    }
  }

  if (archivedSessions.length > 0) {
    children.push(React.createElement('div', {
      key: 'archived-head',
      'data-polish-ws-archived': 'head',
      style: WS_SECTION,
      onClick: () => setArchiveOpen((open) => !open),
    },
    React.createElement('span', { 'aria-hidden': 'true' }, archiveOpen ? '⌄' : '›'),
    React.createElement('span', { style: WS_TITLE }, 'Archived'),
    React.createElement('span', { style: WS_COUNT }, String(archivedSessions.length))))

    if (archiveOpen) {
      for (const row of archivedSessions) {
        children.push(React.createElement('div', {
          key: 'archived:' + row.id,
          'data-polish-ws-archived-row': row.id,
          title: 'Archived session',
          style: Object.assign({}, WS_ROW, { opacity: 0.7, fontStyle: 'italic' }),
          onClick: () => services.openSession(row.id),
          onContextMenu: (event) => {
            event.preventDefault()
            event.stopPropagation()
            setMenu({ kind: 'archived', row, anchor: { top: event.clientY, left: event.clientX } })
          },
        },
        React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id)))
      }
    }
  }

  if (drag && drag.kind === 'workspace') {
    const dragged = allRows.find((group) => group.workspace.workspaceId === drag.id)
    const filed = dragged ? folderKey(dragged.workspace) : undefined
    if (dragged && filed !== undefined) {
      children.push(React.createElement('div', {
        key: 'top-zone',
        'data-polish-ws-topzone': 'true',
        style: Object.assign({}, WS_SECTION, {
          border: '1px dashed var(--dsw-alias-border-l2, rgba(0,0,0,0.2))',
          borderRadius: 'var(--dsw-radius-sm)',
          background: dropping === 'topzone' ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))' : undefined,
        }),
        onDragOver: (event) => { event.preventDefault(); setDropping('topzone') },
        onDragLeave: () => setDropping(null),
        onDrop: async (event) => {
          event.preventDefault()
          setDropping(null)
          try {
            await services.renameWorkspace(drag.id, unfiled(workspaceLabel(dragged.workspace)))
            setNotice('Moved to the top level.')
          } catch (error) {
            setNotice(error && error.message ? error.message : 'Could not move that workspace.')
          }
        },
      },
      React.createElement('span', { style: WS_TITLE }, 'Drop here to leave the folder')))
    }
  }

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
      '--polish-ws-row': metrics.row,
    },
  },
  children,
  shownCount < totalCount
    ? React.createElement('div', { key: 'count', style: WS_COUNT_NOTE }, String(shownCount) + ' of ' + String(totalCount) + ' sessions')
    : null,
  switcherCard,
  helpCard,
  folderLookMenu,
  sessionMenu,
  glyphMenu,
  noteMenu,
  folderMenu,
  renameFolderMenu,
  markMenu,
  noteCard,
  archivedMenu,
  paintMenu,
  workspaceMenu)
}

const WS_HERO = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  minWidth: '220px',
  maxHeight: '320px',
  overflowY: 'auto',
  padding: '4px',
}

const WS_HERO_TITLE = {
  fontSize: 'calc(' + "var(--dsh-content-font-size-secondary, 13px)" + ' - 2px)',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
  padding: '4px 6px 2px',
}

/**
 * The Hero's workspace picker. Same data and same colours as the sidebar tree,
 * reachable before a session exists — the Hero slot wants a list that calls
 * `onPick(workspaceId)`, so this is a flat list rather than the tree.
 */
export function HeroWorkspacePicker(props) {
  const services = (props && props.services) || {}
  const workspaceState = useLive(services.workspacesLive)
  const look = React.useMemo(() => readAppearance(), [])
  const list = (workspaceState && (workspaceState.items || workspaceState.workspaces)) || []
  // The slot hands over `open`: the chip is closed most of the time, and rendering
  // the list unconditionally left it floating over the Hero copy.
  if (!props || props.open !== true || list.length === 0) return null
  const anchor = props.anchorRef && props.anchorRef.current
  const spot = anchor && anchor.getBoundingClientRect
    ? (() => {
      const box = anchor.getBoundingClientRect()
      return {
        position: 'fixed',
        top: Math.round(box.bottom + 6) + 'px',
        left: Math.max(8, Math.round(box.left)) + 'px',
        zIndex: 1200,
      }
    })()
    : {}
  return ReactDOM.createPortal(React.createElement('div', { 'data-polish-hero': 'true', style: Object.assign({}, WS_MENU, WS_HERO, spot, { maxHeight: '320px' }) },
    React.createElement('div', { style: WS_HERO_TITLE }, 'Workspaces'),
    list.map((workspace) => {
      const looks = appearanceOf(look, workspace.workspaceId)
      return React.createElement('button', {
        key: workspace.workspaceId,
        type: 'button',
        'data-polish-hero-row': workspace.workspaceId,
        style: Object.assign({}, WS_ROW, {
          fontWeight: looks.strong ? 600 : 500,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
        }),
        onClick: () => {
          if (props.onPick) props.onPick(workspace.workspaceId)
          if (props.onClose) props.onClose()
        },
      },
      React.createElement(FolderGlyph),
      looks.tone
        ? React.createElement('span', { style: Object.assign({}, WS_TONE, { background: TONE_COLOR[looks.tone] }) })
        : null,
      React.createElement('span', { style: WS_TITLE }, workspaceLabel(workspace)),
      React.createElement('span', { style: WS_COUNT }, String((workspace.sessionIds || []).length)))
    })), document.body)
}

/**
 * Add and dispose the seat with the switch. A `single` slot renders its LOWEST
 * priority occupant, so presence is the only way to stand aside: without this the
 * stock browser would be shadowed even while the switch is off.
 */
export function installWorkspaceSeat(ctx, configForms, extras = {}) {
  let dispose
  let disposeHero
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
            renameWorkspace: (id, title) => seated.workspaces.rename(id, title),
            unarchiveSession: (id) => seated.workspaces.unarchiveSession(id),
            requestRenameSession: async (id, title) => {
              /* the workspace navigation service does not own rename, so call the Host verb */
              const answer = await seated.remote.session.rename({ sessionId: id, title })
              if (answer && answer.ok === false) throw new Error((answer.error && answer.error.message) || 'rename was refused')
            },
            archiveSession: (id) => seated.workspaces.archiveSession(id),
            pinSession: (id) => seated.workspaces.pinSession(id),
            unpinSession: (id) => seated.workspaces.unpinSession(id),
            startSession: (workspaceId) => {
              /* the injected scope is not a ctx: read the service from the plugin's own ctx */
              const ui = ctx.get('uiWorkspace') || seated.uiWorkspace
              if (!ui || typeof ui.startSession !== 'function') throw new Error('no workspace navigation here')
              return ui.startSession(workspaceId)
            },
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
          // The Hero picker is its own single slot, so it needs its own -1 seat;
          // both live and die with the one switch.
          disposeHero = seated.slots.inject('conversation.hero.workspace', () => seated.slots.register({
            name: 'conversation.hero.workspace',
            priority: -1,
            inject: () => ({ services }),
          }, HeroWorkspacePicker))
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
    if (typeof disposeHero === 'function') {
      try {
        disposeHero()
      } catch {}
    }
    disposeHero = undefined
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
    if (typeof disposeHero === 'function') disposeHero()
    if (typeof dispose === 'function') dispose()
  }
}
const WS_HEADER = { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px 4px' }
const WS_HEADER_TITLE = { flex: 1, minWidth: 0, fontSize: 'calc(' + "var(--dsh-content-font-size-secondary, 13px)" + ' - 2px)', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)' }
const WS_ADD = { flex: 'none', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', fontSize: '15px', lineHeight: 1, borderRadius: 'var(--dsw-radius-sm)', cursor: 'pointer' }
const WS_NOTICE = { margin: '0 4px 6px', fontSize: 'calc(' + "var(--dsh-content-font-size-secondary, 13px)" + ' - 2px)', color: 'var(--dsw-alias-label-secondary)' }
