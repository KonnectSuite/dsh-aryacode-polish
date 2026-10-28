const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
const lines = fs.readFileSync(p, 'utf8').split('\n')
for (let at = 0; at < lines.length; at += 1) {
  if (/^test\(/.test(lines[at])) lines[at] = lines[at].replace(/^test\(/, 'it(')
}
fs.writeFileSync(p, lines.join('\n'))
console.log('test( -> it( where needed')
