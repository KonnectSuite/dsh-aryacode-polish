const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

/* state */
swap(`  const [folders, setFolders] = React.useState({})`, `  const [folders, setFolders] = React.useState({})
  const [renaming, setRenaming] = React.useState(null)
  const commitRename = async () => {
    const draft = renaming
    setRenaming(null)
    if (!draft || !services.renameWorkspace) return
    const title = String(draft.value || '').trim()
    if (title === '' || title === draft.label) return
    try {
      await services.renameWorkspace(draft.workspaceId, title)
      setNotice('Renamed to ' + title + '.')
    } catch {
      setNotice('Could not rename that workspace.')
    }
  }`)

/* menu entry */
swap(`      React.createElement('button', {
        type: 'button',
        'data-polish-order': 'remember',`, `      React.createElement('button', {
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
        'data-polish-order': 'remember',`)

/* the rename row, right under the notice */
swap(`  if (rows.length === 0) {
    children.push(React.createElement('div', {`, `  if (renaming) {
    children.push(React.createElement('input', {
      key: 'rename',
      'data-polish-ws-rename-input': 'true',
      autoFocus: true,
      value: renaming.value,
      placeholder: 'Workspace name (use Work/Name to file it)',
      'aria-label': 'Workspace name',
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
    children.push(React.createElement('div', {`)

/* service */
swap(`            removeWorkspace: (id) => seated.workspaces.delete(id),`, `            removeWorkspace: (id) => seated.workspaces.delete(id),
            renameWorkspace: (id, title) => seated.workspaces.rename(id, title),`)

fs.writeFileSync(p, src)
console.log('rename added (' + src.length + ' bytes)')
