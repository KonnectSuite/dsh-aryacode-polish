const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const broken = "    }, '?'),\n      key: 'add',"
if (!src.includes(broken)) throw new Error('anchor missing')
src = src.replace(broken, "    }, '?'),\n    React.createElement('button', {\n      key: 'add',")
fs.writeFileSync(p, src)
console.log('add-button opener restored')
