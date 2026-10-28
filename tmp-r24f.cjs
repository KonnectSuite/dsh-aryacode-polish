const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const dup = "    React.createElement('button', {\n    React.createElement('button', {\n      key: 'help',"
if (!src.includes(dup)) throw new Error('duplicate anchor missing')
src = src.replace(dup, "    React.createElement('button', {\n      key: 'help',")
fs.writeFileSync(p, src)
console.log('duplicate line removed')
