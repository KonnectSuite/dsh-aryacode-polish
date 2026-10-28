const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
const start = src.indexOf("  it('offers density and an archived section in the workspace tree'")
if (start < 0) { console.log('nothing to undo'); process.exit(0) }
const endMarker = '    assert.ok(workspaceSource.includes(\'data-polish-ws-archived\'))'
const end = src.indexOf('  })\n', start)
if (end < 0) throw new Error('cannot find the end of the stray block')
src = src.slice(0, start) + src.slice(end + 5)
src += `
test('the tree offers density modes and an archived section', () => {
  assert.ok(workspaceSource.includes("'data-polish-ws-density'"), 'the header carries the density switch')
  assert.ok(workspaceSource.includes('aryacode-polish:density'), 'the chosen density is remembered')
  assert.ok(workspaceSource.includes('DENSITY_METRICS'), 'density changes row height from a table')
  assert.ok(workspaceSource.includes("'data-polish-ws-archived'"), 'archived sessions get their own section')
  assert.ok(workspaceSource.includes("'data-polish-ws-unarchive'"), 'an archived row can be restored')
  assert.ok(workspaceSource.includes('workspaces.unarchiveSession('), 'restoring goes through the Host verb')
  assert.ok(workspaceSource.includes('splitArchived('), 'archived sessions leave their workspace rows')
})
`
fs.writeFileSync(p, src)
console.log('face spec repaired')
