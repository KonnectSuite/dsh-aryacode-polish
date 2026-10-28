const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Renaming a folder')) { console.log('docs already updated'); process.exit(0) }
doc += `
## Renaming a folder

A folder is not an object in the Host — it is the prefix of the titles inside it. So renaming
a folder means refiling every member: the header's \`✎\` asks for a new name, and each
workspace inside is renamed to \`NewName/\` + its own name through \`workspaces.rename\`. The
declared/empty list follows the old name to the new one, and the fold state moves with it, so
a renamed folder does not suddenly spring open.

## Filing is reversible

**Move to top level** appears in a workspace's menu only when it actually lives under a folder,
and does the inverse: \`unfiled('Work/Alpha')\` is \`Alpha\`, renamed through the Host like any
other title change. A folder left with nothing in it simply stops being drawn, unless it was
declared empty on purpose.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
