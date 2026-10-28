const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Folders without content')) { console.log('docs already updated'); process.exit(0) }
doc += `
## Folders without content

A folder can be declared before anything lives in it (**New folder…** in a workspace menu).
It draws its own header with the word \`empty\` where the count would be, accepts a workspace
drop like any other folder header, and carries a \`×\` that removes the declaration. Declared
names live in \`aryacode-polish:folders.v1\`; the tree draws the names its workspaces imply
first and the declared ones after, so an empty folder never jumps ahead of real content and
disappears on its own the moment the first workspace is filed into it.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
