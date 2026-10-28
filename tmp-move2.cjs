const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const before = src.length

const oldRows = `      moveTargets(rows, menu.workspaceId).length === 0 ? null : React.createElement('div', { key: 'move-rule', style: WS_MENU_RULE }),
      moveTargets(rows, menu.workspaceId).map((target) => React.createElement('button', {
        key: 'move-' + target.workspace.workspaceId,
        type: 'button',
        'data-polish-ws-move': target.workspace.workspaceId,
        style: WS_MENU_ITEM,
        onClick: () => {
          const sessionId = menu.row.id
          closeMenu()
          void moveSession(menu.workspaceId, sessionId, target.workspace.workspaceId, undefined)
        },
      }, 'Move to ' + workspaceLabel(target.workspace))))`
if (!src.includes(oldRows)) throw new Error('menu rows anchor missing')

const newRows = `      sessionTargets.length === 0 ? null : React.createElement('div', { key: 'move-rule', style: WS_MENU_RULE }),
      sessionTargets.map((target) => React.createElement('button', {
        key: 'move-' + target.workspace.workspaceId,
        type: 'button',
        'data-polish-ws-move': target.workspace.workspaceId,
        style: WS_MENU_ITEM,
        onClick: () => {
          const sessionId = menu.row.id
          const from = menu.workspace.workspaceId
          closeMenu()
          void moveSession(from, sessionId, target.workspace.workspaceId, undefined)
        },
      }, 'Move to ' + workspaceLabel(target.workspace))))`
src = src.replace(oldRows, newRows)

// the destination list must exclude the workspace the session already sits in.
const anchor = `  const sessionMenu = menu && menu.kind === 'session'`
if (!src.includes(anchor)) throw new Error('sessionMenu anchor missing')
src = src.replace(anchor, `  const sessionTargets = menu && menu.kind === 'session' && menu.workspace
    ? moveTargets(rows, menu.workspace.workspaceId)
    : []

${anchor}`)

fs.writeFileSync(p, src)
console.log('patched (' + before + ' -> ' + src.length + ' bytes)')
