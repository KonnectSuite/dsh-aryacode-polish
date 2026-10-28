const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const show = (pattern, before, after) => {
  const at = lines.findIndex((line) => pattern.test(line))
  if (at < 0) { console.log('MISSING ' + pattern); return }
  console.log('--- ' + pattern + ' @ ' + (at + 1))
  console.log(lines.slice(Math.max(0, at - before), at + after).map((text, offset) => (at - before + 1 + offset) + ': ' + text).join('\n'))
}
show(/const walk = /, 3, 14)
show(/const visibleRows = /, 0, 10)
show(/^export function filterTree/, 0, 20)
