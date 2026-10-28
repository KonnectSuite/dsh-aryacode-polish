const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* the flag and the note have to be visible on the row itself */
swap(`    React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.title || row.id),`,
`    React.createElement('span', { style: ES_TITLE_PLACEHOLDER }, row.displayTitle || row.title || row.id),`)
