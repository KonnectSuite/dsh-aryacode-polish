const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.35.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.35.0] - 2026-10-28

Added: drop a dragged session on the Pinned header to pin it, and drag a pinned row onto a workspace to
release it — the pinned section now takes sessions in and gives them back without a menu.

Added: type-ahead. Typing a letter in the tree jumps the keyboard cursor to the first workspace or
session whose title starts with what you typed, with a 700 ms window so a word refines the match.
` + '\n' + log)
const docP = 'docs/better-workspace.md'
let doc = fs.readFileSync(docP, 'utf8')
if (!doc.includes('## Pinning by drag, and type-ahead')) {
  doc += `
## Pinning by drag, and type-ahead

Dragging a session onto the **Pinned** header pins it; dragging a pinned row onto a workspace releases
it again. Both go through the same Host verbs the menus use, so nothing here can drift from them.

Typing a printable key while the tree has focus jumps the cursor to the first title with that prefix —
transient, 700 ms, so "bu" then "i" narrows to "Build the thing" instead of restarting.
`
  fs.writeFileSync(docP, doc)
}
console.log('0.35.0')
