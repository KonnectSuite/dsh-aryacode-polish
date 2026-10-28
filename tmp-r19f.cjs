const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Renaming a session')) { console.log('docs already'); process.exit(0) }
doc += `
## Renaming a session

Double-clicking a session title opens an inline editor in the tree, pre-filled with the current title;
Enter commits, Escape abandons. The write goes through the Host verb \`session.rename\` — the workspace
navigation service (\`uiWorkspace\`) exposes no rename entry point, which is why an earlier attempt
failed with "no rename dialog here". A refusal is reported as a notice rather than swallowed.

## Dragging a workspace out of a folder

While a filed workspace is being dragged, a dashed **Drop here to leave the folder** zone appears at
the foot of the tree; dropping on it renames the workspace back to its bare name, which is the same
thing the **Move to top level** menu row does — now reachable without opening a menu.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
