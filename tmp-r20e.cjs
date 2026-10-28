const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (!doc.includes('## Totals')) {
  doc += `
## Totals

A session row shows what that session has cost (\`costOf\`/\`costLabel\`), a workspace row shows the sum
of its sessions (\`sumCostLabel\`), and a folder header shows the sum of everything filed under it
(\`folderCostNode\`). All three read the same host-side \`polishCost\` projection the composer pill uses,
so no price maths happens twice. A group with nothing priced renders nothing at all — never a
misleading \u2248$0 — and a group priced only in CNY shows \u00a5.
`
  fs.writeFileSync(p, doc)
}
console.log('docs ok')
