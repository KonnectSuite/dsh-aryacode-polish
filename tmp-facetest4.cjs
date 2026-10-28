const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('top level')) { console.log('already'); process.exit(0) }
src += `
test('a workspace can leave its folder, and a folder can be renamed', () => {
  assert.ok(workspaceSource.includes("'data-polish-ws-unfile'"), 'the workspace menu can lift a workspace out')
  assert.ok(workspaceSource.includes('unfiled('), 'lifting uses the prefix helper')
  assert.ok(workspaceSource.includes("'data-polish-folder-edit'"), 'a folder header carries a rename action')
  assert.ok(workspaceSource.includes("'data-polish-folder-edit-input'"), 'the new name is typed into a field')
  assert.ok(workspaceSource.includes('fileUnder(workspaceLabel(workspace), target)'), 'renaming a folder refiles each member')
})
`
fs.writeFileSync(p, src)
console.log('face test added')
