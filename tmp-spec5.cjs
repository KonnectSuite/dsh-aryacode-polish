const fs = require('node:fs')
const lines = fs.readFileSync('test/workspace.spec.mjs', 'utf8').split('\n')
console.log(lines.slice(762, 812).map((line, i) => (i + 763) + ': ' + line).join('\n'))
