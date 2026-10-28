const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('glyph picker')) { console.log('already'); process.exit(0) }
src += `
test('a workspace can wear a glyph and carry a note', () => {
  assert.ok(workspaceSource.includes("'data-polish-glyph'"), 'the menu can open the glyph picker')
  assert.ok(workspaceSource.includes("'data-polish-glyph-pick'"), 'the picker offers badges')
  assert.ok(workspaceSource.includes("'data-polish-note'"), 'the menu can open the note editor')
  assert.ok(workspaceSource.includes("'data-polish-note-input'"), 'the note is typed into a field')
  assert.ok(workspaceSource.includes("'data-polish-ws-glyph'"), 'the row renders the chosen glyph')
  assert.ok(workspaceSource.includes('looks.note || undefined'), 'the note rides the row tooltip')
})
`
fs.writeFileSync(p, src)
console.log('face test added')
