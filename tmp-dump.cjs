const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const needle = "kind === 'renameFolder'"
let i = -1
const hits = []
while ((i = s.indexOf(needle, i + 1)) >= 0) hits.push(i)
console.log('hits: ' + hits.length)
const last = hits[hits.length - 1]
const line = s.slice(0, last).split('\n').length
console.log('line: ' + line)
console.log(s.slice(last, last + 1800))
