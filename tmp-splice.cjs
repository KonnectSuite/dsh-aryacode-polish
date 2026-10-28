const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
let body = fs.readFileSync('tmp-bw-body.txt', 'utf8')
const helpers = fs.readFileSync('tmp-bw-helpers.txt', 'utf8')

// the workspace-level pin marker had no helper behind it; drop it
body = body.replace(
  /\n    hoistedCount\(workspace, sessions\)\n      \? React\.createElement\('span', \{ style: WS_PIN_COUNT, title: 'Pinned sessions' \}, '★'\)\n      : null,/,
  '',
)

const start = src.indexOf('export function BetterWorkspace(props) {')
const endMarker = '/**\n * Add and dispose the seat with the switch.'
const end = src.indexOf(endMarker)
if (start < 0 || end < 0 || end < start) {
  console.log('markers not found: start=' + start + ' end=' + end)
  process.exit(1)
}
src = src.slice(0, start) + helpers + '\n' + body + '\n' + src.slice(end)
// the old single-line styles that the new body no longer uses
src = src.replace(/^const WS_TREE = .*$/m, '')
fs.writeFileSync(p, src)
console.log('body replaced; length ' + src.length)
