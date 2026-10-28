const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.30.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.30.0] - 2026-10-28

Added: a folder header shows a small success dot when any session filed under it is running
(\`folderHasRunning\`), and Alt+click on a folder folds or unfolds every other folder at once.

Fixed: the flagged-session glyph had been mojibaked again by a PowerShell patch; it is \\u2691.
` + '\n' + log)
const docP = 'docs/better-workspace.md'
let doc = fs.readFileSync(docP, 'utf8')
if (!doc.includes('## Folding the others')) {
  doc += `
## Folding the others

Alt+click a folder header to fold (or unfold) every other folder in one gesture — the "show me just
this folder" move. The same header carries a success dot while any session filed under it is running,
so a busy folder is visible without expanding it.
`
  fs.writeFileSync(docP, doc)
}
console.log('0.30.0')
