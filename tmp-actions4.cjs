const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const bad = "hit.kind === 'action' ? 'action' : hit.workspace)))))), document.body)"
if (!s.includes(bad)) throw new Error('anchor missing')
s = s.replace(bad, "hit.kind === 'action' ? 'action' : hit.workspace))))))), document.body)")
fs.writeFileSync(p, s)
console.log('paren balanced')
