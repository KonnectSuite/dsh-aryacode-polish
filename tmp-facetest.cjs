const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('data-polish-ws-copy')) { console.log('already'); process.exit(0) }
src += `
test('the tree can flag a session, note it, and copy itself as text', () => {
  for (const marker of [
    'aryacode-polish:session-marks',
    'data-polish-session-flag',
    'data-polish-session-note',
    'data-polish-mark-input',
    'data-polish-mark-flag',
    'data-polish-ws-copy',
    'treeText(',
    'navigator.clipboard.writeText',
  ]) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
fs.writeFileSync(p, src)
console.log('face test added')
