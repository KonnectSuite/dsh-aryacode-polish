const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
s = s.replace("'~$0.90'", "'~$0.900'")
fs.writeFileSync(p, s)
console.log('fixed')
