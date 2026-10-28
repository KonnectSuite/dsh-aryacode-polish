const fs = require('node:fs')
const p = 'client/workspace.js'
const lines = fs.readFileSync(p, 'utf8').split('\n')
if (lines[728].trim() !== ': null))') { console.log('unexpected line 729: ' + lines[728]); process.exit(1) }
lines[728] = '      : null)))'
fs.writeFileSync(p, lines.join('\n'))
console.log('line 729 fixed')
