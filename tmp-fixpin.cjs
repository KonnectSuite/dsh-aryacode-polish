const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const needle = "onDragStart: () => setDrag({ kind: 'pinned', id: row.id, workspaceId: group ? group.workspace.workspaceId : undefined }),"
if (!s.includes(needle)) throw new Error('dragstart anchor missing')
s = s.replace(needle, "onDragStart: () => setDrag({ kind: 'pinned', id: row.id, workspaceId: group ? group.workspaceId : undefined }),")
fs.writeFileSync(p, s)
console.log('workspaceOfPinned returns the workspace, not a group')
