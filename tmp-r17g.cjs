const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Pinned sessions')) { console.log('docs already'); process.exit(0) }
doc += `
## Pinned sessions

Pins are the Host's own \`pinnedSessionIds\`, so nothing is stored locally. A pinned session is lifted
out of its workspace into a **Pinned** section at the top of the tree, with its workspace name beside
it, because a pin that only draws a star on a row you must first find is not doing much. The section is
collapsible, keeps the Host's order, and right-clicking a pinned row opens the ordinary session menu —
where **Unpin session** puts the session back where it belongs.

Archived still wins: an archived session never appears in Pinned.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
