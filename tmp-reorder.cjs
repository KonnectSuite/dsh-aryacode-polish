const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  "            createWorkspace: (path) => seated.workspaces.create({ path }),",
  "            createWorkspace: (path) => seated.workspaces.create({ path }),\n            reorderWorkspace: (movingId, beforeId) => seated.workspaces.insertBefore(movingId, beforeId),\n            reorderSession: (workspaceId, movingId, beforeId) => seated.workspaces.insertSessionBefore(workspaceId, movingId, beforeId),",
)
fs.writeFileSync(p, src)
console.log('reorder wired: ' + src.includes('insertSessionBefore(workspaceId, movingId, beforeId)'))
