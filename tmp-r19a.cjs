const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('requestRenameSession')) throw new Error('already patched')

// 1. service: reuse the shipped rename dialog instead of reimplementing rename
const anchor = "            unarchiveSession: (id) => seated.workspaces.unarchiveSession(id),"
if (!src.includes(anchor)) throw new Error('services anchor missing')
src = src.replace(anchor, anchor + `
            requestRenameSession: (id, title) => {
              /* the shipped rename dialog owns the transaction; we only raise the request */
              const ui = ctx.get('uiWorkspace') || seated.uiWorkspace
              if (!ui || typeof ui.requestSessionRename !== 'function') throw new Error('no rename dialog here')
              ui.requestSessionRename(id, title)
            },`)

// 2. row: double-click a session title to rename it, exactly like the shipped rows
const rowAnchor = "      onClick: () => services.openSession(row.id),\n      onContextMenu: (event) => openMenu(event, row, workspace),"
if (!src.includes(rowAnchor)) throw new Error('row anchor missing')
src = src.replace(rowAnchor, `      onClick: () => services.openSession(row.id),
      onDoubleClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
        try {
          services.requestRenameSession(row.id, row.displayTitle || row.id)
        } catch (error) {
          setNotice(error && error.message ? error.message : 'Could not rename that session.')
        }
      },
      onContextMenu: (event) => openMenu(event, row, workspace),`)

// 3. a drop zone that lifts a filed workspace back to the top level
const dropZone = `  if (drag && drag.kind === 'workspace') {
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

`
const tailAnchor = "  return React.createElement('div', {\n    'data-polish-ws': 'tree',"
if (!src.includes(tailAnchor)) throw new Error('tree return anchor missing')
src = src.replace(tailAnchor, dropZone + tailAnchor)

fs.writeFileSync(p, src)
console.log('rename + topzone patched')
