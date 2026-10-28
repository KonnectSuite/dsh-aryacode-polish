const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
let n = 0
const add = (needle) => {
  if (s.includes(needle)) { n++; return }
  throw new Error('anchor missing: ' + needle)
}
// session rows
let sessionAnchor = `      'data-polish-ws-session': row.id,\n`
if (!s.includes(sessionAnchor)) throw new Error('session row anchor missing')
s = s.replace(sessionAnchor, sessionAnchor + `      'data-polish-cursor': rowFocused ? 'true' : undefined,\n`)
// workspace rows: the row div uses 'data-polish-ws-row'
const wsAnchor = `      'data-polish-ws-row': workspace.workspaceId,\n`
if (!s.includes(wsAnchor)) throw new Error('workspace row anchor missing')
s = s.replace(wsAnchor, wsAnchor + `      'data-polish-cursor': rowFocused ? 'true' : undefined,\n`)
fs.writeFileSync(p, s)
console.log('cursor attribute added to both row kinds')
