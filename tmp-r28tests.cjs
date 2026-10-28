const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('highlightParts')) {
  s = s.replace('  folderLookOf,', '  highlightParts,\n  folderLookOf,')
  s += `
it('highlights the filtered part of a title, and only the first one', () => {
  assert.deepEqual(highlightParts('Build the thing', 'the'), { before: 'Build ', hit: 'the', after: ' thing' })
  assert.deepEqual(highlightParts('Build the thing', 'THE'), { before: 'Build ', hit: 'THE', after: ' thing' })
  assert.deepEqual(highlightParts('Build', 'zz'), { before: 'Build', hit: '', after: '' })
  assert.deepEqual(highlightParts('Build', '   '), { before: 'Build', hit: '', after: '' })
  assert.deepEqual(highlightParts(undefined, 'x'), { before: '', hit: '', after: '' })
})
`
  fs.writeFileSync(p, s)
  console.log('spec added')
} else console.log('spec already')
const f = 'test/client-face.spec.mjs'
let face = fs.readFileSync(f, 'utf8')
if (!face.includes('data-polish-ws-matches')) {
  face = face.replace(/^test\(/m, `test('the filter says how many rows survived it, and marks the part that matched', () => {
  assert.match(workspaceSource, /'data-polish-ws-matches'/)
  assert.match(workspaceSource, /'data-polish-hit': 'true'/)
  assert.match(workspaceSource, /highlightParts\\(/)
  assert.match(workspaceSource, /event\\.key === 'Home' \\|\\| event\\.key === 'End'/)
})

test(`)
  fs.writeFileSync(f, face)
  console.log('face spec added')
} else console.log('face already')
