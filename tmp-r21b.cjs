const fs = require('node:fs')
const face = 'test/client-face.spec.mjs'
let body = fs.readFileSync(face, 'utf8')
if (!body.includes('Shift+F10')) {
  body += `

test('a folder can grow a workspace, and the menus are reachable from the keyboard', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-folder-add'"))
  assert.ok(bundle.includes("event.key === 'ContextMenu'"))
  assert.ok(bundle.includes("'F10' && event.shiftKey"))
  assert.ok(bundle.includes("fileUnder(workspaceLabel(created), into)"))
})
`
  fs.writeFileSync(face, body)
}
console.log('face spec updated')
