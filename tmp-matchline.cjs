const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const needle = `  if (helpHint) children.push(helpHint)`
if (!s.includes(needle)) throw new Error('helpHint anchor missing')
s = s.replace(needle, `  if (query.trim()) {
    children.push(React.createElement('div', {
      key: 'matches',
      'data-polish-ws-matches': String(matchCount),
      style: WS_MENU_HINT,
    }, matchCount === 0
      ? 'Nothing matches "' + query.trim() + '".'
      : matchCount + (matchCount === 1 ? ' match' : ' matches')))
  }

  if (helpHint) children.push(helpHint)`)
fs.writeFileSync(p, s)
console.log('match count line added')
