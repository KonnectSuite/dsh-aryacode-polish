const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}
swap(`    const sessions = metrics.sessions ? group.sessions : []`,
`    const sessions = group.sessions`)
swap(`      React.createElement('span', { style: WS_COUNT }, String(sessions.length)),`,
`      React.createElement('span', { style: WS_COUNT }, String(sessions.length)),`)
swap(`      sessions.forEach((row) => {`,
`      (metrics.sessions ? sessions : []).forEach((row) => {`)
fs.writeFileSync(p, src)
console.log('count kept, rows hidden in folders mode')
