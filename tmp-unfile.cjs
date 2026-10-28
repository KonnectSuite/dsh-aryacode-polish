const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* 1. lifting a workspace out of its folder */
swap(`export function folderKey(workspace) {`,
`/** The title a workspace needs to sit at the top level again: no folder prefix. */
export function unfiled(label) {
  const name = String(label || '').trim()
  if (!name) return name
  const cut = name.lastIndexOf('/')
  return cut >= 0 ? name.slice(cut + 1).trim() : name
}

export function folderKey(workspace) {`)

/* 2. workspace menu: move back to the top level, only when it has a prefix */
swap(`        'data-polish-folder-new': 'open',`,
`        folderOf(menu.workspace) === undefined
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
        'data-polish-folder-new': 'open',`)

/* 3. folder header: rename the folder, which renames its members */
swap(`        onDragLeave: () => setDropping(null),
        onDrop: (event) => {
          event.preventDefault()
          setDropping(null)
          if (!drag || drag.kind !== 'workspace') return
          const moving = rows.find((entry) => entry.workspace.workspaceId === drag.id)
          if (!moving || folderOf(moving.workspace) === folder) return`,
`        onDragLeave: () => setDropping(null),
        onDrop: (event) => {
          event.preventDefault()
          setDropping(null)
          if (!drag || drag.kind !== 'workspace') return
          const moving = rows.find((entry) => entry.workspace.workspaceId === drag.id)
          if (!moving || folderOf(moving.workspace) === folder) return`)

swap(`      React.createElement('span', { 'aria-hidden': 'true' }, folded ? '›' : '⌄'),
      React.createElement('span', { style: WS_TITLE }, folder),
      React.createElement('span', { style: WS_COUNT }, String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)))))`,
`      React.createElement('span', { 'aria-hidden': 'true' }, folded ? '›' : '⌄'),
      React.createElement('span', { style: WS_TITLE }, folder),
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
      React.createElement('span', { style: WS_COUNT }, String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)))))`)

/* 4. the rename-folder editor */
swap(`  const glyphMenu = menu && menu.kind === 'glyph'`,
`  const renameFolderMenu = menu && menu.kind === 'renameFolder'
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
              setNotice('Folder renamed.')
            })
            .catch(() => setNotice('Could not rename that folder.'))
        },
      }),
      React.createElement('div', { style: WS_MENU_HINT }, 'Renames every workspace inside it'))
    : null

  const glyphMenu = menu && menu.kind === 'glyph'`)

swap(`  noteMenu,
  folderMenu,`, `  noteMenu,
  folderMenu,
  renameFolderMenu,`)

fs.writeFileSync(p, src)
console.log('unfile and folder rename added')
