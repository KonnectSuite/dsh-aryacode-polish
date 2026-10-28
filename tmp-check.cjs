const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
for (const name of ['WS_TONE', 'WS_GLYPH', 'WS_SWATCH', 'WS_PAINT_ROW', 'WS_MENU_ITEM', 'WS_MENU_HINT', 'WS_TITLE', 'WS_COUNT']) {
  const re = new RegExp('^const ' + name + ' = ', 'm')
  console.log(name + ': ' + (re.test(s) ? 'ok' : 'MISSING'))
}
console.log('folder header glyph anchor: ' + s.includes("'aria-hidden': 'true' }, folded ?"))
console.log('collapse notice anchor: ' + s.includes("if (collapseSiblings) setNotice('Alt+click folds the other folders too.')"))
console.log('markMenu anchor: ' + s.includes('  const markMenu = menu && menu.kind'))
console.log('helpCard tail anchor: ' + s.includes('  switcherCard,\n  helpCard,\n  sessionMenu,'))
console.log('rename notice anchor: ' + s.includes("              setNotice('Folder renamed.')"))
console.log('WS_TONE block: ' + s.includes('\nconst WS_TONE = {'))
