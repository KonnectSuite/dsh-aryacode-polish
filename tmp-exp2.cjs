const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(`assert.deepEqual(appearanceOf(one, 'ws1'), { tone: 'blue', strong: false }, 'the first map is untouched')`,
  `assert.deepEqual(appearanceOf(one, 'ws1'), { tone: 'blue', strong: false, glyph: undefined, note: undefined }, 'the first map is untouched')`)
src = src.replace(`assert.deepEqual(appearanceOf(map, 'ws1'), { tone: 'green', strong: true })`,
  `assert.deepEqual(appearanceOf(map, 'ws1'), { tone: 'green', strong: true, glyph: undefined, note: undefined })`)
fs.writeFileSync(p, src)
console.log('ok')
