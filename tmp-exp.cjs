const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
const before = src
src = src.replace(/assert\.deepEqual\(appearanceOf\(([^)]*)\), \{ tone: '([a-z]+)', strong: (true|false) \}\)/g,
  (m, arg, tone, strong) => `assert.deepEqual(appearanceOf(${arg}), { tone: '${tone}', strong: ${strong}, glyph: undefined, note: undefined })`)
if (src === before) console.log('no pattern matched')
fs.writeFileSync(p, src)
console.log('updated the older appearance expectations')
