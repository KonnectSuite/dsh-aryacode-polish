const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (!doc.includes('## Adding into a folder')) {
  doc += `
## Adding into a folder

Every folder header carries its own \`+\`. It opens the same add-workspace flow as the header button,
and when the flow returns a folder the newly created workspace is renamed into that folder
(\`fileUnder\`), so a folder can grow without a follow-up rename.

## Menus from the keyboard

Shift+F10 (or the keyboard's menu key) on a focused row opens exactly the menu a right-click opens —
the workspace menu for a workspace row, the shipped session menu for a session row. The anchor is the
row's own rectangle, so the menu lands where the row is, not at the tree's corner.
`
  fs.writeFileSync(p, doc)
}
console.log('docs ok')
