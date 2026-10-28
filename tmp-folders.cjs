const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

/* ---- helpers: folder grouping and order presets ---- */
swap(`const LOOK_KEY = 'aryacode-polish:workspace-appearance.v1'`, `const LOOK_KEY = 'aryacode-polish:workspace-appearance.v1'
const ORDER_KEY = 'aryacode-polish:workspace-order.v1'

/**
 * A workspace whose label carries a path ("Work/Client A") files itself under
 * "Work". The grouping is purely visual and derived from the title, so nothing is
 * written to the Host and renaming a workspace is enough to move it between
 * folders — the same idea as the reference plugin, without its "/" toggle.
 */
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
 * The insertBefore calls that turn one order into another. \`insertBefore(moving, before)\`
 * is the only reorder verb the Host offers, so the plan walks the wanted order and moves
 * each workspace in front of whatever currently sits at that slot.
 */
export function planReorder(currentIds, wantedIds) {
  const current = Array.isArray(currentIds) ? currentIds.slice() : []
  const ops = []
  const wanted = Array.isArray(wantedIds) ? wantedIds : []
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
}`)

/* ---- state: folded folders ---- */
swap(`  const [look, setLook] = React.useState(() => readAppearance())`, `  const [look, setLook] = React.useState(() => readAppearance())
  const [folders, setFolders] = React.useState({})
  const [savedOrder, setSavedOrder] = React.useState(() => readOrder())`)

/* ---- order preset entries in the workspace menu ---- */
swap(`      React.createElement('button', {
        type: 'button',
        'data-polish-ws-appearance': 'open',`, `      React.createElement('button', {
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
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-appearance': 'open',`)

/* ---- the walk excludes rows hidden inside a folded folder ---- */
swap(`  const walk = flattenRows(rows, expanded, query)`, `  const folderOf = (workspace) => folderKey(workspace)
  const visibleRows = rows.filter((group) => {
    const key = folderOf(group.workspace)
    return key === undefined || folders[key] !== true
  })
  const walk = flattenRows(visibleRows, expanded, query)`)

/* ---- the render loop learns about folders ---- */
const startMarker = '  let index = -1\n'
const endMarker = "  return React.createElement('div', {\n    'data-polish-ws': 'tree',"
const start = src.indexOf(startMarker)
const end = src.indexOf(endMarker)
if (start === -1 || end === -1) throw new Error('render block markers not found')

const block = `  let index = -1
  const announced = {}

  const sessionRow = (workspace, row, groupIndex) => {
    const rowFocused = cursor === groupIndex
    const rowHovered = hover === 'session:' + row.id
    const lifted = dropping === 'session:' + row.id
    return React.createElement('div', {
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
    pinned.has(row.id) ? React.createElement('span', { style: WS_PIN, title: 'Pinned' }, '\\u2605') : null,
    React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
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
    const folded = folder !== undefined && folders[folder] === true

    if (folder !== undefined && !announced[folder]) {
      announced[folder] = true
      const inside = rows.filter((entry) => folderOf(entry.workspace) === folder)
      children.push(React.createElement('div', {
        key: 'folder:' + folder,
        'data-polish-ws-folder': folder,
        role: 'group',
        'aria-label': folder,
        title: folded ? 'Expand ' + folder : 'Collapse ' + folder,
        style: WS_FOLDER_ROW,
        onClick: () => setFolders((prev) => Object.assign({}, prev, { [folder]: prev[folder] !== true })),
      },
      React.createElement('span', { 'aria-hidden': 'true' }, folded ? '›' : '⌄'),
      React.createElement('span', { style: WS_TITLE }, folder),
      React.createElement('span', { style: WS_COUNT }, String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)))))
    }

    if (folded) return

    index += 1
    const open = expanded[workspace.workspaceId] !== false
    const focused = cursor === index
    const hovered = hover === 'workspace:' + workspace.workspaceId
    const dropHere = dropping === 'workspace:' + workspace.workspaceId
    const looks = appearanceOf(look, workspace.workspaceId)

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
    looks.tone
      ? React.createElement('span', { style: Object.assign({}, WS_TONE, { background: TONE_COLOR[looks.tone] }) })
      : null,
    React.createElement('span', {
      style: Object.assign({}, WS_TITLE, { fontWeight: looks.strong ? 600 : undefined }),
    }, workspaceLabel(workspace)),
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
        children.push(sessionRow(workspace, row, index))
      })
    }
  })

`
src = src.slice(0, start) + block + src.slice(end)

fs.writeFileSync(p, src)
console.log('folder grouping + order presets applied (' + src.length + ' bytes)')
