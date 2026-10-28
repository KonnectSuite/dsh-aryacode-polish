const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

/* ---------- helpers: persisted fold state + switcher ranking ---------- */
swap(`const ORDER_KEY = 'aryacode-polish:workspace-order.v1'`, `const ORDER_KEY = 'aryacode-polish:workspace-order.v1'
const FOLD_KEY = 'aryacode-polish:folded.v1'

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
}`)

/* ---------- state ---------- */
swap(`  const [folders, setFolders] = React.useState({})`, `  const folded = React.useMemo(() => readFolded(), [])
  const [folders, setFolders] = React.useState(folded.folders)
  const [switcher, setSwitcher] = React.useState(null)
  React.useEffect(() => { writeFolded({ workspaces: expanded, folders }) }, [expanded, folders])`)

/* expanded starts from the stored map too */
swap(`  const [expanded, setExpanded] = React.useState({})`, `  const [expanded, setExpanded] = React.useState(() => readFolded().workspaces)`)

/* ---------- the switcher's key handler ---------- */
swap(`    document.addEventListener('keydown', onShortcut)
    return () => document.removeEventListener('keydown', onShortcut)
  }, [])`, `    document.addEventListener('keydown', onShortcut)
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
    document.addEventListener('keydown', onOpen)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('keydown', onOpen)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const switchItems = React.useMemo(() => {
    const items = []
    allRows.forEach((group) => {
      const workspace = workspaceLabel(group.workspace)
      group.sessions.forEach((row) => {
        items.push({ id: row.id, title: row.displayTitle || row.id, workspace })
      })
    })
    return items
  }, [allRows])
  const switchHits = switcher ? rankMatches(switchItems, switcher.query) : []`)

/* ---------- the overlay ---------- */
swap(`  const children = []`, `  const switcherCard = switcher
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
            'data-polish-switcher-row': hit.id,
            style: Object.assign({}, SWITCHER_ROW, {
              background: at === switcher.index ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))' : 'transparent',
            }),
            onPointerDown: (event) => event.preventDefault(),
            onClick: () => { setSwitcher(null); services.openSession(hit.id) },
          },
          React.createElement('span', { style: WS_TITLE }, hit.title),
          React.createElement('span', { style: SWITCHER_HINT }, hit.workspace)))))), document.body)
    : null

  const children = []`)

/* the overlay rides along with the other menus */
swap(`  sessionMenu,
  paintMenu,`, `  switcherCard,
  sessionMenu,
  paintMenu,`)

fs.writeFileSync(p, src)
console.log('switcher + persisted folds applied (' + src.length + ' bytes)')
