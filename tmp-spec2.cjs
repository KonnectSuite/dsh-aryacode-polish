const fs = require('node:fs')
const text = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
const at = text.indexOf('a cost order puts the spenders first')
console.log(at >= 0 ? text.slice(at - 200, at + 1500) : text.slice(text.indexOf("describe('sortRows"), text.indexOf("describe('sortRows") + 2000))
