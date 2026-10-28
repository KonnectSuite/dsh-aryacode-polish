const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Flags and notes on sessions')) { console.log('docs already'); process.exit(0) }
doc += `
## Flags and notes on sessions

A session can carry a flag (\`⚑\`, shown before its title) and a note (shown on hover, in the same
card the workspace notes use). Both live in \`aryacode-polish:session-marks.v1\`, keyed by session
id, and both are set from the session's own menu: **Flag this session** / **Remove flag** and
**Session note…** (Enter saves, Escape cancels). The tree never invents a session, so a mark for a
session that no longer exists is simply never drawn.

## Copy the tree

The header's \`⧉\` copies the whole tree as indented text — folders, workspaces, sessions, with
\`⚑\` before a flagged session — through \`navigator.clipboard.writeText\`. It is meant for pasting
into a prompt or an issue: "here is what I am looking at", without screenshots.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
