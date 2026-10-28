const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.34.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.34.0] - 2026-10-28

Added: a folder carries its own colour, glyph and weight, set from its own menu (right-click a folder
header). A folder is only a title prefix, so its look lives under a reserved \`folder:\` key in the same
store the workspace looks use — which also means a renamed folder keeps its look instead of losing it.

Added: that menu also renames the folder and removes a declared empty one, so every folder action now
hangs off the folder rather than a pencil button.
` + '\n' + log)
const docP = 'docs/better-workspace.md'
let doc = fs.readFileSync(docP, 'utf8')
if (!doc.includes('## A folder has a look too')) {
  doc += `
## A folder has a look too

Right-clicking a folder header opens a panel with a colour, a glyph and a bold/weight toggle, plus
rename and (for a declared but still empty folder) remove. Folders are title prefixes, not Host
objects, so the look is stored under \`folder:<name>\` in \`aryacode-polish:workspace-appearance.v1\`:
one store, and a folder rename moves its entry with the members it renames.
`
  fs.writeFileSync(docP, doc)
}
console.log('0.34.0')
