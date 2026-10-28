const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const start = lines.findIndex((line, i) => i > 600 && line.trim() === "children.push(React.createElement('div', {")
if (start < 0) { console.log('anchor not found'); process.exit(1) }
let depth = 0
for (let i = start; i < start + 140 && i < lines.length; i += 1) {
  for (const ch of lines[i]) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
  }
  if (i >= start + 60) console.log((i + 1) + ' d=' + depth + ' | ' + lines[i].trim().slice(0, 52))
  if (i > start + 40 && depth === 0) { console.log('CLOSED at line ' + (i + 1)); break }
}
console.log('anchor line ' + (start + 1))
