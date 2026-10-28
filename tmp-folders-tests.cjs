const fs = require('node:fs')
let spec = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
spec = spec.replace(`  TONE_ORDER,`, `  folderKey,
  planReorder,
  readOrder,
  writeOrder,
  TONE_ORDER,`)
spec += `
describe('folders and order presets', () => {
  it('files a slashed title under its prefix', () => {
    assert.equal(folderKey({ title: 'Work/Client A', workspaceId: 'a' }), 'Work')
    assert.equal(folderKey({ title: 'Work/Deep/Client B', workspaceId: 'b' }), 'Work/Deep')
    assert.equal(folderKey({ title: 'plain', workspaceId: 'c' }), undefined)
    assert.equal(folderKey({ title: 'trailing/', workspaceId: 'd' }), undefined)
    assert.equal(folderKey({ title: '/leading', workspaceId: 'e' }), undefined)
  })

  it('plans the moves that turn one order into another', () => {
    assert.deepEqual(planReorder(['a', 'b', 'c'], ['a', 'b', 'c']), [])
    assert.deepEqual(planReorder(['a', 'b', 'c'], ['c', 'a', 'b']), [{ movingId: 'c', beforeId: 'a' }])
    assert.deepEqual(planReorder(['a', 'b', 'c'], ['b', 'a', 'c']), [{ movingId: 'b', beforeId: 'a' }])
  })

  it('never moves something it does not have', () => {
    assert.deepEqual(planReorder(['a'], ['z', 'a']), [])
    assert.deepEqual(planReorder([], ['a']), [])
    assert.deepEqual(planReorder(['a', 'b'], []), [])
  })

  it('round-trips a saved order through storage and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeOrder(['a', 'b'], storage)
    assert.deepEqual(readOrder(storage), ['a', 'b'])
    assert.deepEqual(readOrder({ getItem: () => '{"nope":1}', setItem: () => {} }), [])
    assert.deepEqual(readOrder(undefined), [])
  })
})
`
fs.writeFileSync('test/workspace.spec.mjs', spec)

let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-ws-folder')) {
  face += `
test('folders and saved orders ride the same workspace seat', () => {
  assert.ok(workspaceSource.includes('data-polish-ws-folder'), 'a folder row is rendered')
  assert.ok(workspaceSource.includes('aryacode-polish:workspace-order'), 'the preset has a storage key')
  assert.ok(workspaceSource.includes("'data-polish-order': 'remember'"), 'the menu can remember the order')
  assert.ok(workspaceSource.includes('planReorder('), 'restoring walks an insertBefore plan')
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.13.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.13.0]')) {
  c = c.replace('## [0.12.1] - 2026-10-28', `## [0.13.0] - 2026-10-28

### Added

- **Folders from titles.** A workspace named \`Work/Client A\` files itself under a
  collapsible \`Work\` row, with the folder's session count on the right. The grouping is
  derived from the label and written nowhere, so renaming the workspace moves it.
- **Order presets.** The workspace menu can "Remember this order" and later "Restore
  saved order", which replays the Host's only reorder verb — \`insertBefore\` — through a
  pure \`planReorder(current, wanted)\` plan, stored under
  \`aryacode-polish:workspace-order.v1\`.

## [0.12.1] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('tests + version 0.13.0 ready')
