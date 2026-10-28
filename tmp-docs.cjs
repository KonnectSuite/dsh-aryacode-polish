const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Density')) { console.log('docs already updated'); process.exit(0) }
doc += `
## Density

The header carries a density control that flips between comfortable (28 px rows) and
compact (22 px rows), remembered under \`aryacode-polish:density.v1\`. Density changes row
height only: the text keeps its size, so a compact tree is still readable on a laptop.
The row height travels through the CSS variable \`--polish-ws-row\`, which the tree element
sets from \`DENSITY_METRICS\`; nothing else in the row styling depends on the mode.

## Archived sessions

Archiving a session removes it from its workspace — that is what the Host means by
archived, and the shipped browser simply stops rendering it. Here those sessions keep a
collapsed **Archived** section at the bottom of the tree instead, dimmed and italic, with
their count on the header. Clicking one opens it; right-clicking offers **Unarchive
session**, which goes through \`workspaces.unarchiveSession\`. This also fixed a real gap:
before this, \`workspaceRows\` never consulted \`archivedSessionIds\`, so archived sessions
were being rendered inline in their workspace as if they were live.

## Folding everything

The header's fold control expands when anything is folded (folders included) and folds
only when nothing is. An earlier version only looked at workspace rows, so a folded
folder left the button saying "Expand all" while its workspaces stayed hidden.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
