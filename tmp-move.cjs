const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const before = src.length

const must = (needle) => {
  if (!src.includes(needle)) throw new Error('anchor missing: ' + needle.slice(0, 60))
}

// 1. cross-workspace moves on drop
must(`  const dropOnWorkspace = (targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'workspace') return
    void reorderWorkspace(moving.id, targetId)
  }
  const dropOnSession = (workspaceId, targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'session' || moving.id === targetId) return
    if (moving.workspaceId !== workspaceId) { setNotice('A session stays in the workspace it belongs to.'); return }
    void reorderSession(workspaceId, moving.id, targetId)
  }`)
src = src.replace(`  const dropOnWorkspace = (targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'workspace') return
    void reorderWorkspace(moving.id, targetId)
  }
  const dropOnSession = (workspaceId, targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'session' || moving.id === targetId) return
    if (moving.workspaceId !== workspaceId) { setNotice('A session stays in the workspace it belongs to.'); return }
    void reorderSession(workspaceId, moving.id, targetId)
  }`, `  const moveSession = async (workspaceId, sessionId, targetWorkspaceId, beforeSessionId) => {
    if (!services.moveSession || workspaceId === targetWorkspaceId) return
    try {
      await services.moveSession(workspaceId, sessionId, targetWorkspaceId, beforeSessionId)
      setNotice('Session moved.')
    } catch { setNotice('Could not move that session.') }
  }
  const dropOnWorkspace = (targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving) return
    // A session dropped on a workspace joins that workspace: the Host's
    // insertSessionBefore is the verb that assigns a session to another
    // workspace, so the gesture is supported rather than refused.
    if (moving.kind === 'session') { void moveSession(moving.workspaceId, moving.id, targetId); return }
    void reorderWorkspace(moving.id, targetId)
  }
  const dropOnSession = (workspaceId, targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'session' || moving.id === targetId) return
    if (moving.workspaceId !== workspaceId) { void moveSession(moving.workspaceId, moving.id, workspaceId, targetId); return }
    void reorderSession(workspaceId, moving.id, targetId)
  }`)

// 2. our own "Move to <workspace>" rows in the session menu
must(`      entries.map((entry, index) => React.createElement(RowBoundary, { key: (entry.options && entry.options.id) || index },
        React.createElement(ShippedMenuRow, {
          entry,
          runtime,
          workspacesSnapshot: workspaceState,
          session: { sessionId: menu.row.id, displayTitle: menu.row.displayTitle, session: menu.row },
        }))))`)
src = src.replace(`      entries.map((entry, index) => React.createElement(RowBoundary, { key: (entry.options && entry.options.id) || index },
        React.createElement(ShippedMenuRow, {
          entry,
          runtime,
          workspacesSnapshot: workspaceState,
          session: { sessionId: menu.row.id, displayTitle: menu.row.displayTitle, session: menu.row },
        }))))`, `      entries.map((entry, index) => React.createElement(RowBoundary, { key: (entry.options && entry.options.id) || index },
        React.createElement(ShippedMenuRow, {
          entry,
          runtime,
          workspacesSnapshot: workspaceState,
          session: { sessionId: menu.row.id, displayTitle: menu.row.displayTitle, session: menu.row },
        }))),
      moveTargets(rows, menu.workspaceId).length === 0 ? null : React.createElement('div', { key: 'move-rule', style: WS_MENU_RULE }),
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
      }, 'Move to ' + workspaceLabel(target.workspace))))`)

// 3. service wiring
must(`            reorderWorkspace: (movingId, beforeId) => seated.workspaces.insertBefore(movingId, beforeId),`)
src = src.replace(`            reorderWorkspace: (movingId, beforeId) => seated.workspaces.insertBefore(movingId, beforeId),`, `            reorderWorkspace: (movingId, beforeId) => seated.workspaces.insertBefore(movingId, beforeId),
            moveSession: (workspaceId, sessionId, targetWorkspaceId, beforeSessionId) => seated.workspaces.insertSessionBefore(targetWorkspaceId, sessionId, beforeSessionId),`)

// 4. pure helper + rule style, next to the other exported helpers
must(`export function moveBefore(list, movingId, beforeId) {`)
src = src.replace(`export function moveBefore(list, movingId, beforeId) {`, `export function moveTargets(rows, sessionWorkspaceId) {
  const list = Array.isArray(rows) ? rows : []
  return list.filter((row) => row && row.workspace && row.workspace.workspaceId !== sessionWorkspaceId)
}

export function moveBefore(list, movingId, beforeId) {`)

must(`const WS_COUNT_NOTE`)
src = src.replace(`const WS_COUNT_NOTE`, `const WS_MENU_RULE = { height: 1, margin: '4px 0', background: 'var(--dsw-alias-border-l2, rgba(0,0,0,0.08))' }
const WS_COUNT_NOTE`)

fs.writeFileSync(p, src)
console.log('patched ' + p + ' (' + before + ' -> ' + src.length + ' bytes)')
