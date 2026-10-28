const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* 1. storage + helpers for folders that exist before their content */
swap(`const DENSITY_KEY = 'aryacode-polish:density.v1'`,
`const DENSITY_KEY = 'aryacode-polish:density.v1'
const FOLDER_KEY = 'aryacode-polish:folders.v1'

const cleanFolder = (name) => {
  const value = String(name || '').trim().replace(/^\\/+|\\/+$/g, '')
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
}`)

/* 2. state + persistence */
swap(`  const [folders, setFolders] = React.useState(folded.folders)`,
`  const [folders, setFolders] = React.useState(folded.folders)
  const [declared, setDeclared] = React.useState(() => readFolders())
  const [folderDraft, setFolderDraft] = React.useState('')`)
swap(`  React.useEffect(() => { writeFolded({ workspaces: expanded, folders }) }, [expanded, folders])`,
`  React.useEffect(() => { writeFolded({ workspaces: expanded, folders }) }, [expanded, folders])
  React.useEffect(() => { writeFolders(declared) }, [declared])`)

/* 3. folder names come from rows plus the declared list */
swap(`  const folderNames = Array.from(new Set(rows.map(row => folderKey(row.workspace)).filter(Boolean)))`,
`  const folderNames = folderNamesOf(rows, declared)`)

/* 4. a menu item to declare a folder */
swap(`        'data-polish-glyph': 'open',`,
`        'data-polish-folder-new': 'open',
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
        'data-polish-glyph': 'open',`)

/* 5. the folder editor panel */
swap(`  const glyphMenu = menu && menu.kind === 'glyph'`,
`  const folderMenu = menu && menu.kind === 'folder'
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

  const glyphMenu = menu && menu.kind === 'glyph'`)

/* 6. empty folders render a header with an action of their own */
swap(`    if (folder !== undefined && !announced[folder]) {`,
`    if (folder !== undefined && !announced[folder]) {
      /* handled below for both filled and empty folders */`)

fs.writeFileSync(p, src)
console.log('folder storage added')
