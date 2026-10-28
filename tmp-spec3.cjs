const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(p, 'utf8')
spec = spec.replace("{ id: 's1', displayTitle: 'season' }", "{ id: 's1', displayTitle: 'session one' }")
fs.writeFileSync(p, spec)
