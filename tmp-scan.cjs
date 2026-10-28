const fs = require('node:fs')
const src = fs.readFileSync('client/workspace.js', 'utf8')
const map = new Map()
for (let i = 0; i < src.length; i++) {
  const ch = src[i]
  if (ch !== '\u00e2' && ch !== '\u00c2') continue
  const run = src.slice(i, i + 3)
  map.set(run, (map.get(run) || 0) + 1)
}
console.log(JSON.stringify(Array.from(map.entries()).slice(0, 40), null, 1))
