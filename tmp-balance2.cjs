const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace("      : null))\n\n  return React.createElement('div', {", "      : null)))\n\n  return React.createElement('div', {")
fs.writeFileSync(p, src)
