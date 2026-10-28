const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const before = src.length
const need = (s) => { if (!src.includes(s)) throw new Error('missing: ' + s.slice(0, 50)) }

// 1. drop the session menu's move rows and their destination list
need(`      sessionTargets.length === 0 ? null : React.createElement('div', { key: 'move-rule', style: WS_MENU_RULE }),
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
      }, 'Move to ' + workspaceLabel(target.workspace))))`)
src = src.replace(`      sessionTargets.length === 0 ? null : React.createElement('div', { key: 'move-rule', style: WS_MENU_RULE }),
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
      }, 'Move to ' + workspaceLabel(target.workspace))))`, `      null)`)

need(`  const sessionTargets = menu && menu.kind === 'session' && menu.workspace
    ? moveTargets(rows, menu.workspace.workspaceId)
    : []

`)
src = src.replace(`  const sessionTargets = menu && menu.kind === 'session' && menu.workspace
    ? moveTargets(rows, menu.workspace.workspaceId)
    : []

`, '')

// 2. drop moveSession and restore the honest refusal
need(`  const moveSession = async (workspaceId, sessionId, targetWorkspaceId, beforeSessionId) => {
    if (!services.moveSession || workspaceId === targetWorkspaceId) return
    try {
      await services.moveSession(workspaceId, sessionId, targetWorkspaceId, beforeSessionId)
      setNotice('Session moved.')
    } catch { setNotice('Could not move that session.') }
  }
`)
src = src.replace(`  const moveSession = async (workspaceId, sessionId, targetWorkspaceId, beforeSessionId) => {
    if (!services.moveSession || workspaceId === targetWorkspaceId) return
    try {
      await services.moveSession(workspaceId, sessionId, targetWorkspaceId, beforeSessionId)
      setNotice('Session moved.')
    } catch { setNotice('Could not move that session.') }
  }
`, '')

need(`    if (!moving) return
    // A session dropped on a workspace joins that workspace: the Host's
    // insertSessionBefore is the verb that assigns a session to another
    // workspace, so the gesture is supported rather than refused.
    if (moving.kind === 'session') { void moveSession(moving.workspaceId, moving.id, targetId); return }
    void reorderWorkspace(moving.id, targetId)`)
src = src.replace(`    if (!moving) return
    // A session dropped on a workspace joins that workspace: the Host's
    // insertSessionBefore is the verb that assigns a session to another
    // workspace, so the gesture is supported rather than refused.
    if (moving.kind === 'session') { void moveSession(moving.workspaceId, moving.id, targetId); return }
    void reorderWorkspace(moving.id, targetId)`, `    if (!moving || moving.kind !== 'workspace') return
    void reorderWorkspace(moving.id, targetId)`)

need(`    if (moving.workspaceId !== workspaceId) { void moveSession(moving.workspaceId, moving.id, workspaceId, targetId); return }`)
src = src.replace(`    if (moving.workspaceId !== workspaceId) { void moveSession(moving.workspaceId, moving.id, workspaceId, targetId); return }`, `    if (moving.workspaceId !== workspaceId) {
      // A session cannot change workspace from a plugin: the Host's remote
      // namespace exposes create/rename/delete/insertBefore/insertSessionBefore
      // and no attachSession or detachSession, and a workspace's own
      // insertSessionBefore only reorders the sessions already in it.
      setNotice('A session stays in its workspace; drag it within that workspace to reorder.')
      return
    }`)

// 3. service wiring + helper + rule style go away
need(`            moveSession: (workspaceId, sessionId, targetWorkspaceId, beforeSessionId) => seated.workspaces.insertSessionBefore(targetWorkspaceId, sessionId, beforeSessionId),
`)
src = src.replace(`            moveSession: (workspaceId, sessionId, targetWorkspaceId, beforeSessionId) => seated.workspaces.insertSessionBefore(targetWorkspaceId, sessionId, beforeSessionId),
`, '')

need(`export function moveTargets(rows, sessionWorkspaceId) {
  const list = Array.isArray(rows) ? rows : []
  return list.filter((row) => row && row.workspace && row.workspace.workspaceId !== sessionWorkspaceId)
}

`)
src = src.replace(`export function moveTargets(rows, sessionWorkspaceId) {
  const list = Array.isArray(rows) ? rows : []
  return list.filter((row) => row && row.workspace && row.workspace.workspaceId !== sessionWorkspaceId)
}

`, '')

need(`const WS_MENU_RULE = { height: 1, margin: '4px 0', background: 'var(--dsw-alias-border-l2, rgba(0,0,0,0.08))' }
`)
src = src.replace(`const WS_MENU_RULE = { height: 1, margin: '4px 0', background: 'var(--dsw-alias-border-l2, rgba(0,0,0,0.08))' }
`, '')

fs.writeFileSync(p, src)
console.log('reverted (' + before + ' -> ' + src.length + ' bytes)')
