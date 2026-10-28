const fs = require('node:fs')
// bundle assertions for the new mode
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes("SORT_TITLES[each]")) {
  face = face.replace("  assert.match(workspaceSource, /Sort A to Z/)", "  assert.match(workspaceSource, /Sort A to Z/)\n  assert.match(workspaceSource, /SORT_TITLES\\[each\\]/)\n  assert.match(workspaceSource, /sortRows\\(allRows, sort, \\(group\\)/)")
  fs.writeFileSync('test/client-face.spec.mjs', face)
  console.log('face assertions added')
}

// version + changelog + docs
const pkgPath = 'package.json'
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = '0.39.0'
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.39.0]')) {
  c = c.replace('## [0.38.0]', `## [0.39.0] - 2026-10-28

- Sort workspaces by what they have spent: "Most spent first" ranks the tree by the cost totals already
  shown on every workspace row, and a workspace nobody has spent in sinks to the bottom instead of
  jumping to the top on a zero.
- Every sort mode now gets its label from one table (SORT_TITLES), so the menu can never name a mode
  that does not exist.

## [0.38.0]`)
  fs.writeFileSync('CHANGELOG.md', c)
  console.log('changelog updated')
}

let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('### Sort by spend')) {
  d = d.replace('### Header menu', `### Sort by spend

"Most spent first" orders the workspaces by the totals the rows already carry. The ranking is global, not
per folder: a workspace from any folder can land anywhere, and a folder header appears where its most
expensive member landed. An unpriced workspace sorts below a priced one at any price, because a zero here
means "nobody has spent in it", not "it is free".

### Header menu`)
  fs.writeFileSync('docs/better-workspace.md', d)
  console.log('docs updated')
}
