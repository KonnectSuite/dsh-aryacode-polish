const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.31.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.31.0] - 2026-10-28

Changed: dropping a workspace onto another workspace row now re-files it into that row's folder and
repositions it in one gesture (rename first, then \`insertBefore\`), instead of only reordering.

Added: an archived session's menu can open it or copy its id, so an archived row is not a dead end.
` + '\n' + log)
const docP = 'docs/better-workspace.md'
let doc = fs.readFileSync(docP, 'utf8')
if (!doc.includes('## Moving a workspace onto another one')) {
  doc += `
## Moving a workspace onto another one

Dropping a workspace onto another workspace row does both halves of the move: it re-files the moving
workspace into the target's folder (or out to the top level when the target is unfiled) and then
repositions it immediately before the target. Two Host calls, one gesture — \`rename\` then
\`insertBefore\`. A drop on a folder header still only files.
`
  fs.writeFileSync(docP, doc)
}
console.log('0.31.0')
