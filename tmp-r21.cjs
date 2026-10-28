const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// A. folder-scoped add: remember which folder the flow was opened from
const stateAnchor = `  const [renaming, setRenaming] = React.useState(null)`
if (!src.includes(stateAnchor)) throw new Error('state anchor missing')
src = src.replace(stateAnchor, stateAnchor + `\n  const [folderTarget, setFolderTarget] = React.useState(null)`)

const flowAnchor = `      onPicked: async (path) => {
        if (!path) return
        try {
          await services.createWorkspace(path)
          setAdding(false)
        } catch (error) {
          setNotice((error && error.message) || 'Could not add that folder.')
        }
      },
      onCancel: () => setAdding(false),`
if (!src.includes(flowAnchor)) throw new Error('flow anchor missing')
src = src.replace(flowAnchor, `      onPicked: async (path) => {
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
      onCancel: () => { setAdding(false); setFolderTarget(null) },`)

// B. a per-folder add button beside the folder count
const folderCountAnchor = `[String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)), folderCostNode(inside, sessionState, folder)]`
if (!src.includes(folderCountAnchor)) throw new Error('folder count anchor missing')
src = src.replace(folderCountAnchor, `[String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)), folderCostNode(inside, sessionState, folder),
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
      }, '+')]`)

// C. keyboard: Shift+F10 / the Menu key open the row menu the right-click opens
const keyAnchor = `    if (event.key === 'Escape') {
      if (query) { setQuery(''); return }`
if (!src.includes(keyAnchor)) throw new Error('key anchor missing')
src = src.replace(keyAnchor, `    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      if (cursor < 0 || !walk[cursor]) return
      event.preventDefault()
      const entry = walk[cursor]
      const node = event.currentTarget.querySelector('[data-polish-ws-row="' + entry.workspace.workspaceId + '"], [data-polish-ws-session="' + entry.row.id + '"]')
      const box = node ? node.getBoundingClientRect() : event.currentTarget.getBoundingClientRect()
      const fake = { preventDefault: () => {}, stopPropagation: () => {}, clientX: Math.max(8, box.left + 12), clientY: box.bottom - 4 }
      if (entry.kind === 'workspace') openWorkspaceMenu(fake, entry.workspace)
      else openMenu(fake, entry.row, entry.workspace)
      return
    }
    if (event.key === 'Escape') {
      if (query) { setQuery(''); return }`)

fs.writeFileSync(p, src)
console.log('folder add + keyboard menu wired')
