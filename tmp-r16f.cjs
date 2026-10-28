const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Sorting')) { console.log('docs already'); process.exit(0) }
doc += `
## Sorting

The header's \`\u2195\` / \`A\u2192Z\` control switches between the Host's own order and an alphabetical
one, remembered in \`aryacode-polish:sort.v1\`. Alphabetical sorting is folder-aware: unfiled
workspaces come first, then each folder's workspaces sorted by name, so a folder never splits in two.
Sorting is a view concern only — it never renames or reorders anything on the Host.

## Jumping to a workspace

Ctrl/⌘-K lists workspaces as well as sessions: a workspace row carries \`\u2302\` and the hint
\`workspace\`, and choosing it unfolds its folder, opens the workspace and highlights the row
("Jumped to <name>.") instead of opening a session. Sessions keep their existing behaviour: Enter
opens the session.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
