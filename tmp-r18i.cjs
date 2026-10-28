const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## What a session has cost')) { console.log('docs already'); process.exit(0) }
doc += `
## What a session has cost

A session row shows the priced total for that session (\`\u2248$0.00016\`) when the cost feature has
something to show. The number comes from the \`polishCost\` projection the Host half already writes:
\`costOf(snapshot, sessionId)\` reads \`snapshot.projectionsBySession[sessionId].values.polishCost\`, so
the tree never prices anything itself and never disagrees with the composer pill.

Two honest cases are covered by tests rather than by hope:

- **Nothing priced** — a session with no recorded usage, or a Shell where the cost feature is switched
  off, renders no cost at all. It does not render \`\u2248$0\`, because that would be a lie about a session
  that simply has not spent anything yet.
- **Partially priced** — the projection marks usage it could not price; the label then leads with \`~\`
  instead of \`\u2248\`, the same convention the composer uses.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
