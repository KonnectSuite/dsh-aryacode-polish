const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const broken = `      React.createElement('button', {
        type: 'button',
        folderOf(menu.workspace) === undefined
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
          }, 'Move to top level'),`
const fixed = `      folderOf(menu.workspace) === undefined
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
        }, 'Move to top level'),`
if (!src.includes(broken)) throw new Error('broken block not found')
src = src.replace(broken, fixed)
fs.writeFileSync(p, src)
console.log('unfile button repaired')
