const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.32.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.32.0] - 2026-10-28

Added: a shortcut sheet (? or the header's ? button) listing every gesture the tree answers to, and a
one-line hint under the filter that disappears once the sheet has been opened
(\`aryacode-polish:help.v1\`).
` + '\n' + log)
const docP = 'docs/better-workspace.md'
let doc = fs.readFileSync(docP, 'utf8')
if (!doc.includes('## Teaching itself')) {
  doc += `
## Teaching itself

\`?\` (or the header's \`?\`) opens a sheet listing every gesture: Enter, \`[\`/\`]\`, \`/\`, Ctrl+K,
Shift+F10, Alt+click, double-click, drag. Until that sheet has been opened once, one dim line under
the filter says so; opening it stores \`aryacode-polish:help.v1\` and the hint stops. A storage that
refuses to remember only means the hint stays.
`
  fs.writeFileSync(docP, doc)
}
console.log('0.32.0')
