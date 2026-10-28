const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
for (const name of ['WS_MARK', 'data-polish-ws-search', 'data-polish-ws-filter', 'shownCount', 'totalCount']) {
  const i = s.indexOf(name)
  console.log(name + ': ' + (i < 0 ? 'MISSING' : 'line ' + s.slice(0, i).split('\n').length))
}
const i = s.indexOf("data-polish-ws-filter")
if (i > 0) console.log(s.slice(i - 300, i + 900))
