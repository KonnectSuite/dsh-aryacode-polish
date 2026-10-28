const fs = require('node:fs')
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-pinned-running')) {
  face += `

test('a running session is marked the same way in its workspace and when pinned', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-session-running'"))
  assert.ok(bundle.includes("'data-polish-pinned-running'"))
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}
console.log('face spec updated')
