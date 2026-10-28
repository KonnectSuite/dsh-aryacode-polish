const fs = require('node:fs')
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('## Quick switcher')) {
  d += `
## Quick switcher

Ctrl/⌘-K opens a palette over every session in every workspace: the list is
\`rankMatches(allSessions, query)\`, which scores a title that *starts* with the query
above one that merely mentions it and keeps arrival order inside a rank (so "gre" puts
Greeting above later mentions). Arrows walk, Enter opens the session through
\`uiWorkspace.openSession\`, Escape or a backdrop click dismisses. It is portalled to
\`document.body\` with its own backdrop, so neither the sidebar's scroll container nor a
panel's stacking context can clip it.

## Folded state

\`expanded\` (workspaces) and \`folders\` (title folders) are seeded from
\`aryacode-polish:folded.v1\` and written back whenever either changes, so a restart looks
like the way out. Verified across a real restart: folding \`WORK\` left
\`{"workspaces":{},"folders":{"Work":true}}\` in storage and the folder still read \`› WORK 2\`
with its workspace hidden.
`
  fs.writeFileSync('docs/better-workspace.md', d)
}
console.log('docs updated')
