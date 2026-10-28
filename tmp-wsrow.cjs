const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const i = s.indexOf("'data-polish-ws-row': workspace.workspaceId")
const n = s.slice(0, i).split('\n').length
const lines = s.split('\n')
console.log(lines.slice(n - 1, n + 40).map((l, k) => (n + k) + ': ' + l).join('\n'))
