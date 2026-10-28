const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* empty folders: a header that exists before its first workspace */
swap(`  if (archivedSessions.length > 0) {`,
`  const filled = new Set(rows.map(row => folderKey(row.workspace)).filter(Boolean))
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

  if (archivedSessions.length > 0) {`)

swap(`  glyphMenu,
  noteMenu,`, `  glyphMenu,
  noteMenu,
  folderMenu,`)

fs.writeFileSync(p, src)
console.log('empty folders render')
