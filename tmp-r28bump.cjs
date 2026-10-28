const fs = require('node:fs')
const bump = (from, to) => {
  const p = 'package.json'
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (j.version !== from) throw new Error('expected ' + from + ' got ' + j.version)
  j.version = to
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
}
bump('0.35.0', '0.36.0')
const c = 'CHANGELOG.md'
let s = fs.readFileSync(c, 'utf8')
const head = '## [0.35.0]'
if (!s.includes(head)) throw new Error('changelog anchor missing')
s = s.replace(head, `## [0.36.0] - 2026-10-28

### Added

- The filter now says how many rows survived it, and marks the part of the title that matched, so a
  filtered tree explains itself instead of just getting shorter.
- Home and End jump to the first and last row of the keyboard walk.

${head}`)
fs.writeFileSync(c, s)
const d = 'docs/better-workspace.md'
let doc = fs.readFileSync(d, 'utf8')
if (!doc.includes('## Filtering shows its work')) {
  doc += `
## Filtering shows its work

Typing in the filter hides rows, which on its own is ambiguous: a shorter tree can mean "nothing
else matched" or "the tree is empty now". So the tree says what happened — \`n matches\`, and the
matched slice of each title is wrapped in a \`mark\` — and Escape clears the filter back to
everything. Home and End jump to the ends of the keyboard walk, because arrowing past thirty
sessions to reach the last one is not a feature.
`
  fs.writeFileSync(d, doc)
}
console.log('version 0.36.0, changelog and docs updated')
