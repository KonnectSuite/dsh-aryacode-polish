const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Starting a session from a row')) { console.log('docs already'); process.exit(0) }
doc += `
## Starting a session from a row

Every workspace row carries a hover \`+\` that calls \`uiWorkspace.startSession(workspaceId)\` — a new
session is created *in that workspace* and the app switches to it, which is the difference between
"new session" and "new session here". The composer's workspace chip changes accordingly.

Two things this cost, both worth keeping:

- The injected scope a seat receives is **not** a ctx: \`seated.ctx.get(…)\` throws
  \`cannot get property "ctx" without inject\`. Read extra services from the plugin's own \`ctx\`
  captured in \`installWorkspaceSeat\`.
- A row action that can fail must say so. The first version did nothing visible; the notice
  ("Started a session." / the thrown reason) is what identified the ctx mistake in one run.

## Pinning from a row

The hover star calls \`workspaces.pinSession\` / \`unpinSession\` — the shipped \`★\` marker and the
shipped ordering both follow, because it is the same Host verb the menu uses, not a local flag.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
