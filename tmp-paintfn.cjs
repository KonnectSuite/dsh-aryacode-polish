const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const i = s.indexOf('writeAppearance(next)')
console.log(s.slice(i - 700, i + 200))
