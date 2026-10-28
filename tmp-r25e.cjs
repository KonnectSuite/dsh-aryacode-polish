const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.33.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.33.0] - 2026-10-28

Changed: a pinned row now shows what that session has cost and carries its own hover unpin star, so
the pinned section is a working surface rather than a shortcut list.

Added: the running indicator is named (\`data-polish-session-running\`) and mirrored onto pinned rows,
so a busy session reads the same wherever it appears.
` + '\n' + log)
const docP = 'docs/better-workspace.md'
let doc = fs.readFileSync(docP, 'utf8')
if (!doc.includes('## The pinned section is a surface')) {
  doc += `
## The pinned section is a surface

A pinned row carries the same information as a session row in its workspace: title, running dot, what
it has cost, and a hover star that unpins it in place. Its context menu is the shipped session menu,
so Pin/Rename/Fork/Archive/Copy ID/Open workspace folder all work there too — including duplication.
`
  fs.writeFileSync(docP, doc)
}
console.log('0.33.0')
