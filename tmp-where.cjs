const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
lines.forEach((line, index) => {
  if (!line.includes('data-polish-cursor')) return
  console.log('=== line ' + (index + 1))
  console.log(lines.slice(Math.max(0, index - 12), index + 3).map((text, offset) => (index - 11 + offset) + ': ' + text).join('\n'))
})
