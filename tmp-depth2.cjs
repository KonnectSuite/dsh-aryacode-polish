const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
let depth = 0
for (let i = 0; i < 673; i += 1) {
  for (const ch of lines[i]) { if (ch === '(') depth += 1; else if (ch === ')') depth -= 1 }
}
console.log('depth before 674: ' + depth)
for (let i = 673; i < 800; i += 1) {
  const before = depth
  for (const ch of lines[i]) { if (ch === '(') depth += 1; else if (ch === ')') depth -= 1 }
  const label = lines[i].trim().slice(0, 46)
  if (before !== depth) console.log((i + 1) + ' ' + before + '->' + depth + ' | ' + label)
}
