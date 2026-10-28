const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const i = s.indexOf("key: 'pinned-head'")
const n = s.slice(0, i).split('\n').length
const lines = s.split('\n')
console.log(lines.slice(n - 8, n + 3).map((l, k) => (n - 7 + k) + ': ' + l).join('\n'))
