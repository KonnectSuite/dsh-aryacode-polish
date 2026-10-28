const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
s = s.replace("test('folder looks live beside workspace looks under a reserved prefix'", "it('folder looks live beside workspace looks under a reserved prefix'")
fs.writeFileSync(p, s)
console.log('renamed to it()')
