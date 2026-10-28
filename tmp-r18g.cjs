const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
s = s.replace("'\\u2248\\u00a50.00420'", "'\\u2248\\u00a50.0042'")
fs.writeFileSync(p, s)
console.log('expectation fixed')
