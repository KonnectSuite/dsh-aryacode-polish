const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Filing by drag')) { console.log('docs already updated'); process.exit(0) }
doc += `
## Filing by drag

Dropping a workspace on a folder header files it there: the title is rewritten to
\`Folder/Name\` through the Host's own rename, so the move is durable and the shipped
browser (when this switch is off) sees exactly the same structure. \`fileUnder(label, folder)\`
replaces any previous prefix instead of stacking it — dragging \`A/B/Gamma\` onto \`C\` gives
\`C/Gamma\`, not \`C/A/B/Gamma\` — and a workspace already inside the target folder is not a
drop target, so the gesture cannot rename something onto itself.

## The note card

A workspace note shows as a small card under the row on hover rather than as a browser
tooltip: tooltips are slow to appear, unstyleable, and vanish when the pointer leaves. The
card is portalled, \`pointer-events: none\`, and only exists while a note does.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
