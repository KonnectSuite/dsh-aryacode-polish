const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const show = (pattern, before, after) => {
  const at = lines.findIndex((line) => pattern.test(line))
  if (at < 0) { console.log('MISSING ' + pattern); return }
  console.log('--- ' + pattern + ' @ ' + (at + 1))
  console.log(lines.slice(Math.max(0, at - before), at + after).map((text, offset) => (at - before + 1 + offset) + ': ' + text).join('\n'))
}
show(/^export function flattenRows/, 0, 24)
lines.forEach((line, at) => { if (/\bexpanded\b/.test(line)) console.log((at + 1) + ': ' + line.trim().slice(0, 100)) })
