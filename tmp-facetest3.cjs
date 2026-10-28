const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('empty folder')) { console.log('already'); process.exit(0) }
src += `
test('a folder can exist before it holds a workspace', () => {
  assert.ok(workspaceSource.includes("'data-polish-folder-new'"), 'the menu can declare a folder')
  assert.ok(workspaceSource.includes("'data-polish-folder-input'"), 'the folder name is typed into a field')
  assert.ok(workspaceSource.includes('aryacode-polish:folders'), 'declared folders are remembered')
  assert.ok(workspaceSource.includes("'data-polish-ws-empty'"), 'an empty folder still draws a header')
  assert.ok(workspaceSource.includes("'data-polish-folder-remove'"), 'an empty folder can be removed')
  assert.ok(workspaceSource.includes('folderNamesOf('), 'declared folders join the ones the workspaces imply')
})
`
fs.writeFileSync(p, src)
console.log('face test added')
