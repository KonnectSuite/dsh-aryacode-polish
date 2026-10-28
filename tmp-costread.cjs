const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const show = (pattern, before, after) => {
  const at = lines.findIndex((line) => pattern.test(line))
  if (at < 0) { console.log('MISSING ' + pattern); return }
  console.log('--- ' + pattern + ' @ ' + (at + 1))
  console.log(lines.slice(Math.max(0, at - before), at + after).map((text, offset) => (at - before + 1 + offset) + ': ' + text).join('\n'))
}
show(/^function costOf/, 0, 16)
show(/^export function costLabel/, 0, 14)
show(/^export function sumCost/, 0, 22)
