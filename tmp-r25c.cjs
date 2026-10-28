const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// session rows: name the running dot so it is observable
const dot = `row.running ? React.createElement('span', { style: WS_DOT, title: 'Running' }) : null,`
if (!src.includes(dot)) throw new Error('session dot anchor missing')
src = src.replace(dot, `row.running ? React.createElement('span', { 'data-polish-session-running': row.id, style: WS_DOT, title: 'Running' }) : null,`)

// pinned rows: same dot, same name
const pinAnchor = `        React.createElement('span', { style: WS_PIN, 'aria-hidden': 'true' }, '\\u2605'),`
if (!src.includes(pinAnchor)) throw new Error('pinned star anchor missing')
src = src.replace(pinAnchor, pinAnchor + `
        row.running ? React.createElement('span', { 'data-polish-pinned-running': row.id, style: WS_DOT, title: 'Running' }) : null,`)

fs.writeFileSync(p, src)
console.log('running dots named and mirrored onto pinned rows')
