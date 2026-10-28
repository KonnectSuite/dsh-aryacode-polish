const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (!src.includes('    setCursor(workspaceId)\n')) throw new Error('anchor missing')
src = src.replace('    setCursor(workspaceId)\n', "    setHover('workspace:' + workspaceId)\n")
fs.writeFileSync(p, src)
console.log('cursor -> hover')
