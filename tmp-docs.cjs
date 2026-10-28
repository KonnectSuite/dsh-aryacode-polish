const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (!doc.includes('## What M2 added')) {
  doc += `
## What M2 added

- **Filter** — one box over workspaces and session titles. Every group it keeps is
  opened, because a match you cannot see is not a match; the footer reports
  "n of m sessions" whenever the filter hides any. \`/\` focuses it from anywhere,
  Escape clears it.
- **Pinned first, running dot** — a pinned session is hoisted to the top of its
  workspace with a star, and a running session shows a dot, so the row can be read
  without clicking it.
- **Drag and drop** — a workspace dropped on another moves in front of it
  (\`workspaces.insertBefore\`); a session dropped on a sibling reorders it
  (\`workspaces.insertSessionBefore\`). A session refuses to leave its workspace: the
  Host stores sessions inside workspaces, and moving one would look like a delete.
- **Keyboard walk** — arrows move a highlighted row, Enter opens a session or folds a
  workspace, Escape closes the menu, then clears the filter, then drops the cursor.
- **Quiet rows** — the "..." action appears on hover or on the keyboard cursor instead
  of on every row at once, and a header control folds or expands every workspace.

Still owed: "/"-in-title grouping, per-row appearance, workspace presets, and the same
tree in the Hero picker.
`
  fs.writeFileSync(p, doc)
}
let readme = fs.readFileSync('README.md', 'utf8')
readme = readme.replace(/seven features shipped/g, 'eight features shipped')
fs.writeFileSync('README.md', readme)
console.log('docs updated')
