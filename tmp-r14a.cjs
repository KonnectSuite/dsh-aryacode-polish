const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* services: a session started inside a workspace, and a quick pin toggle */
swap(`      pinSession: (id) => seats.workspaces.pinSession(id),`,
`      pinSession: (id) => seats.workspaces.pinSession(id),
      unpinSession: (id) => seats.workspaces.unpinSession(id),
      startSession: (workspaceId) => seats.uiWorkspace.startSession(workspaceId),`)

fs.writeFileSync(p, src)
console.log('services added')
