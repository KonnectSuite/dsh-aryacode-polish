const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
for (const name of ['startSession:', 'openSession:', 'pinSession:', 'unpinSession:']) {
  const i = s.indexOf(name)
  console.log(name + ' -> ' + (i < 0 ? 'MISSING' : 'line ' + s.slice(0, i).split('\n').length))
}
const i = s.indexOf('startSession:')
if (i > 0) console.log(s.slice(i - 120, i + 160))
