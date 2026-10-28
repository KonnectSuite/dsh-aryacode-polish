const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
for (const name of ['WS_GLYPH_BUTTON', 'WS_GLYPH_GRID', 'WS_GLYPH ']) {
  const i = s.indexOf('const ' + name.trim() + ' = {')
  if (i < 0) { console.log(name + ' not found'); continue }
  console.log('--- ' + name.trim())
  console.log(s.slice(i, i + 300))
}
