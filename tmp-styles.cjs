const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
for (const name of ['PANEL_SURFACE', 'SWITCHER_BACKDROP', 'WS_MENU =', 'WS_MENU_ITEM =', 'WS_MENU_HINT =', 'WS_ROW_ACTION =', 'WS_SWATCH =']) {
  const at = s.indexOf(name)
  console.log((at < 0 ? 'MISSING ' : 'OK ') + name + (at < 0 ? '' : ' @ line ' + s.slice(0, at).split('\n').length))
}
const lines = s.split('\n')
const at = lines.findIndex((line) => line.includes('PANEL_SURFACE'))
console.log(lines.slice(at - 2, at + 14).map((t, i) => (at - 1 + i) + ': ' + t).join('\n'))
