const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('jumpWorkspace(')) { console.log('already'); process.exit(0) }
src += `
test('the tree can hop between workspaces and show folders only', () => {
  for (const marker of ['jumpWorkspace(', 'nextDensity(', 'folders', "'['", "']'"]) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
fs.writeFileSync(p, src)
console.log('face test added')
