const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const wrong = "'data-polish-ws-row': workspace.workspaceId,\n      'data-polish-cursor': rowFocused ? 'true' : undefined,"
if (!s.includes(wrong)) throw new Error('anchor missing')
s = s.replace(wrong, "'data-polish-ws-row': workspace.workspaceId,\n      'data-polish-cursor': focused ? 'true' : undefined,")
fs.writeFileSync(p, s)
const check = fs.readFileSync(p, 'utf8')
if (check.includes("'data-polish-ws-row': workspace.workspaceId,\n      'data-polish-cursor': rowFocused")) throw new Error('still wrong')
console.log('workspace row now uses its own focused flag')
