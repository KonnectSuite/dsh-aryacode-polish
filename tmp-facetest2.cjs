const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('note card')) { console.log('already'); process.exit(0) }
src += `
test('a workspace can be dropped on a folder and shows its note on hover', () => {
  assert.ok(workspaceSource.includes('fileUnder('), 'dropping uses the filing helper')
  assert.ok(workspaceSource.includes("'folder:' + folder"), 'the folder header is a drop target')
  assert.ok(workspaceSource.includes("'Filed under '"), 'a drop reports what happened')
  assert.ok(workspaceSource.includes("'data-polish-note-card'"), 'the note appears in a card')
  assert.ok(workspaceSource.includes('setCard({ text: note'), 'the card only exists when a note does')
})
`
fs.writeFileSync(p, src)
console.log('face test added')
