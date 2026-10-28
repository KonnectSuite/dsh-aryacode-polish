const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
lines.forEach((line, at) => {
  if (/const children = \[\]/.test(line)) {
    // find the nearest preceding function declaration
    let fn = 'unknown'
    for (let back = at; back > 0; back -= 1) {
      const m = lines[back].match(/^(?:export )?function ([A-Za-z0-9_]+)\(/)
      if (m) { fn = m[1] + ' (line ' + (back + 1) + ')'; break }
    }
    console.log((at + 1) + ': const children = []  inside ' + fn)
  }
})
lines.forEach((line, at) => { if (/children\.push\(React\.createElement\('div', \{\s*$/.test(line) || /'data-polish-ws': 'tree'/.test(line)) console.log((at + 1) + ': ' + line.trim().slice(0, 70)) })
