const fs = require('node:fs')
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-pinned-unpin')) {
  face += `

test('a pinned row shows its cost and can be unpinned in place', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-pinned-cost'"))
  assert.ok(bundle.includes("'data-polish-pinned-unpin'"))
  assert.ok(bundle.includes("hover === 'pinned:' + row.id"))
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}
console.log('face spec updated')
