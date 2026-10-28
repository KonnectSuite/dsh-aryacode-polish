const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const show = (pattern, before, after) => {
  const at = lines.findIndex((line) => pattern.test(line))
  console.log('--- ' + pattern + ' @ ' + (at + 1))
  console.log(lines.slice(Math.max(0, at - before), at + after).map((text, offset) => (at - before + 1 + offset) + ': ' + text).join('\n'))
}
show(/^const WS_MENU = \{/, 0, 16)
show(/^const SWITCHER_BACKDROP = /, 0, 12)
show(/^const WS_ROW_ACTION = /, 0, 12)
