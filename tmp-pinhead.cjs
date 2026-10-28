const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const needle = `  if (pinnedSessions.length > 0) {
    children.push(React.createElement('div', {
      key: 'pinned-head',`
if (!s.includes(needle)) throw new Error('pinned render anchor missing')
s = s.replace(needle, `  // The section materialises while a session is being dragged, so a drop target exists before the
  // first pin — otherwise there is nowhere to drop the session that would create the section.
  if (pinnedSessions.length > 0 || (drag && drag.kind === 'session')) {
    children.push(React.createElement('div', {
      key: 'pinned-head',`)
fs.writeFileSync(p, s)
console.log('pinned head appears while dragging a session')
