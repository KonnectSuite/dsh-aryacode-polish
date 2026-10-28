const fs = require('node:fs')
let s = fs.readFileSync('client/workspace.js', 'utf8')
const anchor = '  switcherCard,\n  helpCard,'
if (!s.includes(anchor)) throw new Error('render anchor missing')
s = s.replace(anchor, '  switcherCard,\n  helpCard,\n  costPeekCard,')
fs.writeFileSync('client/workspace.js', s)
console.log('costPeekCard rendered')
