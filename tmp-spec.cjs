const fs = require('node:fs')
const text = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
const at = text.indexOf("sortRows")
console.log(text.slice(Math.max(0, at - 1400), at + 1500))
