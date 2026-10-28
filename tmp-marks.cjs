const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* 1. session marks: a flag and a note */
swap(`const FOLDER_KEY = 'aryacode-polish:folders.v1'`,
`const FOLDER_KEY = 'aryacode-polish:folders.v1'
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
  return lines.join('\\n')
}`)

/* 2. state + persistence */
swap(`  const [folderDraft, setFolderDraft] = React.useState('')`,
`  const [folderDraft, setFolderDraft] = React.useState('')
  const [marks, setMarks] = React.useState(() => readMarks())
  const [markDraft, setMarkDraft] = React.useState('')`)
swap(`  React.useEffect(() => { writeFolders(declared) }, [declared])`,
`  React.useEffect(() => { writeFolders(declared) }, [declared])
  React.useEffect(() => { writeMarks(marks) }, [marks])`)

/* 3. session menu gains our two rows */
swap(`      null)
    : null

  const switcherCard = switcher`,
`      React.createElement('button', {
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

  const switcherCard = switcher`)

/* 4. the session note editor */
swap(`  const glyphMenu = menu && menu.kind === 'glyph'`,
`  const markMenu = menu && menu.kind === 'mark'
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

  const glyphMenu = menu && menu.kind === 'glyph'`)

swap(`  folderMenu,
  renameFolderMenu,`, `  folderMenu,
  renameFolderMenu,
  markMenu,`)

/* 5. the header copies the tree */
swap(`    React.createElement('button', {
      key: 'density',`,
`    React.createElement('button', {
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
      key: 'density',`)

fs.writeFileSync(p, src)
console.log('session marks and copy-tree added')
