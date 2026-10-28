const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const body = fs.readFileSync('tmp-bw-body.txt', 'utf8')
const helpers = fs.readFileSync('tmp-bw-helpers.txt', 'utf8')

const start = src.indexOf('export function BetterWorkspace(props) {')
const end = src.indexOf('/**\n * Add and dispose the seat with the switch.')
if (start < 0 || end < 0) { console.log('markers missing'); process.exit(1) }
src = src.slice(0, start) + helpers + '\n' + body + '\n' + src.slice(end)
fs.writeFileSync(p, src)
console.log('spliced, length ' + src.length)
