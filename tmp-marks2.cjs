const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* the row shows its flag, and its note appears on hover like a workspace note */
swap(`      onMouseEnter: () => setHover('session:' + row.id),
      onMouseLeave: () => setHover(null),`,
`      onMouseEnter: (event) => {
        setHover('session:' + row.id)
        const note = markOf(marks, row.id).note
        if (!note) return
        const box = event.currentTarget.getBoundingClientRect()
        setCard({ text: note, top: box.bottom + 6, left: Math.max(8, box.left) })
      },
      onMouseLeave: () => { setHover(null); setCard(null) },`)

swap(`    React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),`,
`    markOf(marks, row.id).flag
      ? React.createElement('span', { 'data-polish-mark-flag': row.id, style: WS_PIN, title: 'Flagged' }, '\u2691')
      : null,
    React.createElement('span', {
      style: Object.assign({}, WS_TITLE, {
        fontStyle: markOf(marks, row.id).note ? 'italic' : undefined,
      }),
    }, row.displayTitle || row.id),`)

fs.writeFileSync(p, src)
console.log('session rows show flags and notes')
