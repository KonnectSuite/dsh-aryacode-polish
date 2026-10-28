const fs = require('node:fs')
let s = fs.readFileSync('client/workspace.js', 'utf8')
const anchor = '    helpCard,'
if (!s.includes(anchor)) throw new Error('helpCard render anchor missing')
s = s.replace(anchor, '    helpCard,\n    costPeekCard,')
fs.writeFileSync('client/workspace.js', s)
console.log('costPeekCard rendered beside helpCard')
