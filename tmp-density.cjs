const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* 1. constants */
swap(`const FOLD_KEY = 'aryacode-polish:folded.v1'`, `const FOLD_KEY = 'aryacode-polish:folded.v1'
const DENSITY_KEY = 'aryacode-polish:density.v1'

export const DENSITIES = ['comfortable', 'compact']

/** Row height per density: the tree fits more rows without shrinking the text. */
export const DENSITY_METRICS = {
  comfortable: { row: '28px' },
  compact: { row: '22px' },
}

export function densityOf(value) {
  return value === 'compact' ? 'compact' : 'comfortable'
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
}`)

/* 2. row height becomes a variable */
swap(`  width: '100%',
  height: '28px',`, `  width: '100%',
  height: 'var(--polish-ws-row, 28px)',`)

/* 3. state */
swap(`  const [switcher, setSwitcher] = React.useState(null)`, `  const [switcher, setSwitcher] = React.useState(null)
  const [density, setDensity] = React.useState(() => readDensity())
  const [archiveOpen, setArchiveOpen] = React.useState(false)`)

/* 4. archived split + metrics */
swap(`  const allRows = workspaceRows(workspaceList, sessionList)`, `  const metrics = DENSITY_METRICS[densityOf(density)]
  const archiveSet = new Set((workspaceState && workspaceState.archivedSessionIds) || [])
  const split = splitArchived(sessionList, archiveSet)
  const allRows = workspaceRows(workspaceList, split.active)
  const archivedSessions = split.archived`)

/* 5. density button in the header */
swap(`    React.createElement('button', {
      key: 'add',
      type: 'button',
      'data-polish-ws-add': 'true',`, `    React.createElement('button', {
      key: 'density',
      type: 'button',
      'data-polish-ws-density': densityOf(density),
      title: densityOf(density) === 'compact' ? 'Use comfortable rows' : 'Use compact rows',
      'aria-label': densityOf(density) === 'compact' ? 'Use comfortable rows' : 'Use compact rows',
      style: WS_ADD,
      onClick: () => {
        const next = densityOf(density) === 'compact' ? 'comfortable' : 'compact'
        setDensity(next)
        writeDensity(next)
      },
    }, densityOf(density) === 'compact' ? '≡' : '≣'),
    React.createElement('button', {
      key: 'add',
      type: 'button',
      'data-polish-ws-add': 'true',`)

/* 6. archived section, before the tree element */
swap(`  return React.createElement('div', {
    'data-polish-ws': 'tree',`, `  if (archivedSessions.length > 0) {
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

  return React.createElement('div', {
    'data-polish-ws': 'tree',`)

/* 7. the tree carries the density variable */
swap(`      padding: '2px 6px 12px',
      outline: 'none',
    },
  },
  children,`, `      padding: '2px 6px 12px',
      outline: 'none',
      '--polish-ws-row': metrics.row,
    },
  },
  children,`)

/* 8. the archived row menu */
swap(`  const paintMenu = menu && menu.kind === 'paint'`, `  const archivedMenu = menu && menu.kind === 'archived'
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
      }, 'Unarchive session'))
    : null

  const paintMenu = menu && menu.kind === 'paint'`)

/* 9. hand the menu to the tree */
swap(`  switcherCard,
  sessionMenu,`, `  switcherCard,
  sessionMenu,
  archivedMenu,`)

/* 10. service */
swap(`            renameWorkspace: (id, title) => seated.workspaces.rename(id, title),`, `            renameWorkspace: (id, title) => seated.workspaces.rename(id, title),
            unarchiveSession: (id) => seated.workspaces.unarchiveSession(id),`)

fs.writeFileSync(p, src)
console.log('applied density + archived section (' + src.length + ' bytes)')
