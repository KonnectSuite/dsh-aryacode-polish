const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('splitPinned')) throw new Error('already patched')

// 1. pure helper next to splitArchived
const anchor = 'export function splitArchived(sessions, archivedIds) {'
if (!src.includes(anchor)) throw new Error('splitArchived anchor missing')
const helper = `// Pinned sessions get their own section, exactly like archived ones, so a pin is
// visible where you look for it instead of only as a star on a row you must find.
export function splitPinned(sessions, pinnedIds) {
  const pinned = new Set(pinnedIds || [])
  const pinnedSessions = []
  const rest = []
  for (const row of sessions || []) {
    if (pinned.has(row.id)) pinnedSessions.push(row)
    else rest.push(row)
  }
  return { pinned: pinnedSessions, rest }
}

`
src = src.replace(anchor, helper + anchor)

// 2. wiring in the component
const wiring = `  const allRows = workspaceRows(workspaceList, split.active)`
if (!src.includes(wiring)) throw new Error('allRows anchor missing')
src = src.replace(wiring, `  const byPin = splitPinned(split.active, (workspaceState && workspaceState.pinnedSessionIds) || [])
  const pinnedSessions = byPin.pinned
  const workspaceOfPinned = (sessionId) => {
    for (const group of workspaceRows(workspaceList, split.active)) {
      if (group.sessions.some((row) => row.id === sessionId)) return group.workspace
    }
    return undefined
  }
  const allRows = workspaceRows(workspaceList, byPin.rest)`)

const stateAnchor = `  const [archiveOpen, setArchiveOpen] = React.useState(false)`
if (!src.includes(stateAnchor)) throw new Error('archiveOpen anchor missing')
src = src.replace(stateAnchor, `  const [pinOpen, setPinOpen] = React.useState(true)\n` + stateAnchor)

// 3. the section itself, before the workspace rows loop
const rowsLoop = `  if (archivedSessions.length > 0) {`
if (!src.includes(rowsLoop)) throw new Error('archived block anchor missing')
const pinnedBlock = `  if (pinnedSessions.length > 0) {
    children.push(React.createElement('div', {
      key: 'pinned-head',
      'data-polish-ws-pinned': 'head',
      style: WS_SECTION,
      onClick: () => setPinOpen((open) => !open),
    },
    React.createElement('span', { 'aria-hidden': 'true' }, pinOpen ? '\\u2304' : '\\u203a'),
    React.createElement('span', { style: WS_TITLE }, 'Pinned'),
    React.createElement('span', { style: WS_COUNT }, String(pinnedSessions.length))))

    if (pinOpen) {
      for (const row of pinnedSessions) {
        const group = workspaceOfPinned(row.id)
        children.push(React.createElement('div', {
          key: 'pinned:' + row.id,
          'data-polish-ws-pinned-row': row.id,
          title: 'Pinned session',
          style: WS_ROW,
          onClick: () => services.openSession(row.id),
          onContextMenu: (event) => {
            event.preventDefault()
            event.stopPropagation()
            setMenu({ kind: 'session', row, workspace: group, anchor: { top: event.clientY, left: event.clientX } })
          },
        },
        React.createElement('span', { style: WS_PIN, 'aria-hidden': 'true' }, '\\u2605'),
        React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
        React.createElement('span', { style: WS_COUNT_NOTE }, group ? workspaceLabel(group) : '')))
      }
    }
  }

`
src = src.replace(rowsLoop, pinnedBlock + rowsLoop)

fs.writeFileSync(p, src)
console.log('pinned section patched')
