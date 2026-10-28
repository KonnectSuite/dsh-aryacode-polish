const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const show = (needle, before, after) => {
  const at = lines.findIndex((line) => line.includes(needle))
  if (at < 0) { console.log('MISSING ' + needle); return }
  console.log('--- ' + needle + ' @ ' + (at + 1))
  console.log(lines.slice(Math.max(0, at - before), at + after).map((text, offset) => (at - before + 1 + offset) + ': ' + text).join('\n'))
}
show("export function sortRows(", 2, 18)
show("export const SORTS", 0, 3)
show("if (folder !== renderedFolder)", 0, 12)
