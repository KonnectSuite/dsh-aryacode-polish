const fs = require('node:fs')
let spec = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
if (!spec.includes('readHelp')) {
  const m = spec.match(/import \{([\s\S]*?)\} from '\.\.\/client\/workspace\.js'/)
  spec = spec.replace(m[0], m[0].replace('folderHasRunning,', 'folderHasRunning, readHelp, writeHelp,'))
  spec += `

describe('the shortcut sheet remembers it was opened', () => {
  it('starts unseen, remembers, and can be forgotten', () => {
    const store = new Map()
    const shim = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }
    assert.equal(readHelp(shim), false)
    writeHelp(true, shim)
    assert.equal(readHelp(shim), true)
    writeHelp(false, shim)
    assert.equal(readHelp(shim), false)
  })

  it('survives a storage that throws', () => {
    const angry = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') }, removeItem: () => { throw new Error('nope') } }
    assert.equal(readHelp(angry), false)
    assert.doesNotThrow(() => writeHelp(true, angry))
  })
})
`
  fs.writeFileSync('test/workspace.spec.mjs', spec)
}

let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-ws-help')) {
  face += `

test('the tree can explain itself, and stops hinting once it has', () => {
  const bundle = read('lib/client.js')
  assert.ok(bundle.includes("'data-polish-ws-help': 'open'"))
  assert.ok(bundle.includes("'data-polish-ws-help-row'"))
  assert.ok(bundle.includes("'data-polish-ws-help-hint'"))
  assert.ok(bundle.includes('aryacode-polish:help.v1'))
  assert.ok(bundle.includes("event.key !== '?'"))
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}
console.log('specs updated')
