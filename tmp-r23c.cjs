const fs = require('node:fs')
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-archived-open')) {
  face += `

test('dropping a workspace on another one refiles it, and an archived row can open or copy', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-archived-open'"))
  assert.ok(bundle.includes("'data-polish-archived-copy'"))
  assert.ok(bundle.includes('Moved into '))
  assert.ok(bundle.includes('await reorderWorkspace(moving.id, targetId)'))
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}
console.log('face spec updated')
