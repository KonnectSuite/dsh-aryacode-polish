const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

swap(`            unarchiveSession: (id) => seated.workspaces.unarchiveSession(id),`,
`            unarchiveSession: (id) => seated.workspaces.unarchiveSession(id),
            archiveSession: (id) => seated.workspaces.archiveSession(id),
            pinSession: (id) => seated.workspaces.pinSession(id),
            unpinSession: (id) => seated.workspaces.unpinSession(id),
            startSession: (workspaceId) => seated.uiWorkspace.startSession(workspaceId),`)

/* a hover "+" on every workspace row starts a session inside that workspace */
swap(`    React.createElement('span', { style: WS_COUNT }, String(sessions.length)),`,
`    React.createElement('span', { style: WS_COUNT }, String(sessions.length)),
    React.createElement('button', {
      type: 'button',
      'data-polish-ws-new-session': workspace.workspaceId,
      title: 'New session in this workspace',
      'aria-label': 'New session in this workspace',
      style: Object.assign({}, WS_ROW_ACTION, { marginLeft: '2px' }),
      onClick: (event) => {
        event.stopPropagation()
        services.startSession(workspace.workspaceId)
      },
    }, '+'),`)

/* a hover star on every session row pins and unpins it in one click */
swap(`    rowHovered || rowFocused
      ? React.createElement('button', {
        type: 'button',
        'data-polish-ws-menu': 'session',`,
`    rowHovered || rowFocused
      ? React.createElement('button', {
        type: 'button',
        'data-polish-session-pin': row.id,
        title: pinned.has(row.id) ? 'Unpin this session' : 'Pin this session',
        'aria-label': pinned.has(row.id) ? 'Unpin this session' : 'Pin this session',
        style: WS_ROW_ACTION,
        onClick: (event) => {
          event.stopPropagation()
          if (pinned.has(row.id)) services.unpinSession(row.id)
          else services.pinSession(row.id)
        },
      }, pinned.has(row.id) ? '\\u2605' : '\\u2606')
      : null,
    rowHovered || rowFocused
      ? React.createElement('button', {
        type: 'button',
        'data-polish-ws-menu': 'session',`)

fs.writeFileSync(p, src)
console.log('hover actions added')
