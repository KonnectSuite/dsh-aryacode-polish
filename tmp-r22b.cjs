const fs = require('node:fs')
let spec = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
if (!spec.includes('folderHasRunning')) {
  const m = spec.match(/import \{([\s\S]*?)\} from '\.\.\/client\/workspace\.js'/)
  const next = m[0].replace('sumCost,', 'sumCost, folderHasRunning,')
  spec = spec.replace(m[0], next)
  spec += `

describe('a folder knows when something inside is running', () => {
  it('is true when any filed session is running', () => {
    const inside = [
      { sessions: [{ running: false }, { running: true }] },
      { sessions: [{ running: false }] },
    ]
    assert.equal(folderHasRunning(inside), true)
  })

  it('is false when nothing runs, and for an empty folder', () => {
    assert.equal(folderHasRunning([{ sessions: [{ running: false }] }]), false)
    assert.equal(folderHasRunning([]), false)
    assert.equal(folderHasRunning(undefined), false)
  })
})
`
  fs.writeFileSync('test/workspace.spec.mjs', spec)
}

let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-folder-running')) {
  face += `

test('a folder shows a running dot, and Alt folds the others', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-folder-running'"))
  assert.ok(bundle.includes('folderHasRunning('))
  assert.ok(bundle.includes('event.altKey === true'))
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}
console.log('specs updated')
