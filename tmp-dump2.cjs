const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const lines = s.split('\n')
const show = (needle, before, after, label) => {
  const i = s.indexOf(needle)
  if (i < 0) { console.log('MISSING ' + label); return }
  const n = s.slice(0, i).split('\n').length
  console.log('--- ' + label + ' (line ' + n + ')')
  console.log(lines.slice(n - 1 - before, n + after).map((l, k) => (n - before + k) + ': ' + l).join('\n'))
}
show("'data-polish-ws-pinned': 'head'", 2, 26, 'pinned head')
show("const onKeyDown", 2, 40, 'keydown')
