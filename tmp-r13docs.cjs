const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Folders only')) { console.log('docs already'); process.exit(0) }
doc += `
## Folders only

The density button walks three states, not two: comfortable, compact, and **folders only**. The
last one keeps every folder and workspace row (with its real session count) and drops the session
rows entirely — useful when you are navigating the shape of your work rather than a specific
session. Nothing is lost: one more click returns to comfortable, and the mode is remembered in
\`aryacode-polish:density.v1\`.

One trap it exposed: the workspace count must come from the unfiltered session list. Reading the
list the tree was about to draw made every workspace read \`0\` in this mode, which looked like the
feature had eaten the sessions.

## Hopping between workspaces

With the tree focused, \`[\` and \`]\` move the keyboard cursor to the previous / next workspace head
and wrap at the ends. It is a second gear next to ArrowUp/ArrowDown: arrows walk rows, brackets
walk groups, so a long flat list of sessions stops being a scroll-and-squint exercise.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
