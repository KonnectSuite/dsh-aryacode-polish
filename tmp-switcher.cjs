const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const marks = ['switchItems', 'switchHits', 'data-polish-switcher-row', 'rankMatches(', 'openSession(hit.id)', 'revealWorkspace(']
for (const m of marks) {
  const i = s.indexOf(m)
  console.log(m + ' -> ' + (i < 0 ? 'MISSING' : 'line ' + s.slice(0, i).split('\n').length))
}
const i = s.indexOf('const switchItems')
console.log(s.slice(i - 500, i + 1400))
