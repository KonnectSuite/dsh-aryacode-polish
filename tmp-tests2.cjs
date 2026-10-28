const fs = require('node:fs')
const specPath = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(specPath, 'utf8')
if (!spec.includes('folder looks')) {
  spec = spec.replace("import {", "import {\n  folderLookOf,\n  withFolderLook,\n  FOLDER_LOOK_PREFIX,")
  spec += `
test('folder looks live beside workspace looks under a reserved prefix', () => {
  let map = {}
  map = withFolderLook(map, 'Work', { tone: 'green', glyph: '\u{1F680}' })
  assert.deepEqual(folderLookOf(map, 'Work'), { tone: 'green', strong: false, glyph: '\u{1F680}', note: undefined })
  assert.equal(FOLDER_LOOK_PREFIX + 'Work' in map, true)
  // a workspace id never collides with a folder key
  map = withAppearance(map, 'Work', { tone: 'blue' })
  assert.equal(folderLookOf(map, 'Work').tone, 'green')
  assert.equal(appearanceOf(map, 'Work').tone, 'blue')
  // clearing the last field drops the entry
  map = withFolderLook(map, 'Work', { tone: undefined, glyph: undefined, strong: false })
  assert.equal(FOLDER_LOOK_PREFIX + 'Work' in map, false)
  assert.equal(appearanceOf(map, 'Work').tone, 'blue')
})
`
  fs.writeFileSync(specPath, spec)
  console.log('spec updated')
} else console.log('spec already')
const facePath = 'test/client-face.spec.mjs'
let face = fs.readFileSync(facePath, 'utf8')
if (!face.includes('data-polish-folder-tone-pick')) {
  face = face.replace(/^test\(/m, `test('a folder wears its own colour and glyph', () => {
  assert.match(workspaceSource, /'data-polish-folder-tone-pick'/)
  assert.match(workspaceSource, /'data-polish-folder-glyph-pick'/)
  assert.match(workspaceSource, /'data-polish-folder-strong'/)
  assert.match(workspaceSource, /folderLookOf\\(/)
  assert.match(workspaceSource, /FOLDER_LOOK_PREFIX/)
})

test(`)
  fs.writeFileSync(facePath, face)
  console.log('face spec updated')
} else console.log('face already')
