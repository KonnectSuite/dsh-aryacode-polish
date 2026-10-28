const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const needle = `            onClick: () => paint({ glyph: current.glyph === glyph ? undefined : glyph }),
          }))),`
if (!s.includes(needle)) throw new Error('glyph row tail missing')
s = s.replace(needle, `            onClick: () => paint({ glyph: current.glyph === glyph ? undefined : glyph }),
          }, glyph))),`)
fs.writeFileSync(p, s)
console.log('glyph text passed as children')
