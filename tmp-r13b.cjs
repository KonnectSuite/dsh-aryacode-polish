const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

swap(`  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {`,
`  /** [ and ] hop between workspace heads: the fast way through a long tree. */
  const hopWorkspace = (step) => {
    const next = jumpWorkspace(walk, cursor, step)
    if (next >= 0) setCursor(next)
  }
  const onKeyDown = (event) => {
    if (event.key === '[' || event.key === ']') {
      event.preventDefault()
      hopWorkspace(event.key === ']' ? 1 : -1)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {`)

swap(`      React.createElement('div', { style: WS_MENU_HINT }, 'Enter saves, Escape cancels'))
    : null

  const glyphMenu`, `      React.createElement('div', { style: WS_MENU_HINT }, 'Enter saves, Escape cancels'))
    : null

  const glyphMenu`)

fs.writeFileSync(p, src)
console.log('keys wired')
