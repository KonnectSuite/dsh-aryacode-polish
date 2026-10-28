const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
const dup = "  appearanceOf,\n  withAppearance,\n  GLYPHS,\n"
const first = src.indexOf(dup)
const second = src.indexOf(dup, first + 1)
if (second > 0) {
  src = src.slice(0, second) + src.slice(second + dup.length)
  fs.writeFileSync(p, src)
  console.log('removed the duplicate import')
} else {
  console.log('no duplicate found')
}
