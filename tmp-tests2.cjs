const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('data-polish-ws-density')) { console.log('already patched'); process.exit(0) }
const anchor = src.lastIndexOf('\n})')
const block = `
  it('offers density and an archived section in the workspace tree', async () => {
    const bundle = await read('lib/client.js')
    assert.ok(bundle.includes("'data-polish-ws-density'"), 'the header carries the density switch')
    assert.ok(bundle.includes('aryacode-polish:density'), 'the chosen density is remembered')
    assert.ok(bundle.includes("'data-polish-ws-archived'"), 'archived sessions get their own section')
    assert.ok(bundle.includes("'data-polish-ws-unarchive'"), 'an archived row can be restored')
    assert.ok(bundle.includes('workspaces.unarchiveSession('), 'restoring goes through the Host verb')
    assert.ok(bundle.includes('splitArchived('), 'archived sessions leave their workspace rows')
  })
`
src = src.slice(0, anchor) + block + src.slice(anchor)
fs.writeFileSync(p, src)
console.log('client-face test extended')
