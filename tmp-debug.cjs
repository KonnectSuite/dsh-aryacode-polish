const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes("'data-polish-debug'")) {
  const anchor = "    'data-polish-ws': 'tree',\n    tabIndex: 0,"
  if (!s.includes(anchor)) throw new Error('tree anchor missing')
  s = s.replace(anchor, "    'data-polish-ws': 'tree',\n    'data-polish-debug': String(rows.length) + '/' + String(allRows.length),\n    tabIndex: 0,")
  fs.writeFileSync(p, s)
  console.log('debug attribute added')
} else console.log('debug already')
