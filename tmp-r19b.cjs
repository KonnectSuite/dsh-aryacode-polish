const fs = require('node:fs')
const face = 'test/client-face.spec.mjs'
let f = fs.readFileSync(face, 'utf8')
if (!f.includes('data-polish-ws-topzone')) {
  f += `
test('a session can be renamed in place, and a filed workspace dragged back out', () => {
  for (const marker of ['requestRenameSession', 'onDoubleClick', 'data-polish-ws-topzone', 'Drop here to leave the folder', 'unfiled(workspaceLabel(dragged.workspace))']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
  fs.writeFileSync(face, f)
  console.log('face test added')
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.27.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.27.0] - 2026-10-28

Added: double-clicking a session in the tree raises the Host's own rename dialog, and dragging a filed
workspace onto the top-level drop zone lifts it out of its folder — the gesture had a menu entry but no
drag equivalent.

` + log)
console.log('0.27.0')
