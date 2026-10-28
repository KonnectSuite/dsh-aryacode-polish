const fs = require('node:fs')
const file = 'test/client-face.spec.mjs'
const before = fs.readFileSync(file, 'utf8')
const anchor = "test('the palette can act, not only jump', () => {"
const added = `test('the tree can sort by what was touched last', () => {
  assert.match(workspaceSource, /recent: 'Recent first'/)
  assert.match(workspaceSource, /kind === 'recent'/)
  assert.match(bundle, /Recent first/)
})

` + anchor
const count = before.split(anchor).length - 1
if (count !== 1) throw new Error('anchor count ' + count)
fs.writeFileSync(file, before.replace(anchor, added))
console.log('spec added; ' + before.split('\n').length + ' -> ' + fs.readFileSync(file, 'utf8').split('\n').length + ' lines')
