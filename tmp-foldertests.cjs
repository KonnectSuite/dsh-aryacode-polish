const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('addFolder')) { console.log('already'); process.exit(0) }
src = src.replace("  folderKey,\n", "  folderKey,\n  addFolder,\n  removeFolder,\n  readFolders,\n  writeFolders,\n  folderNamesOf,\n")
src += `
describe('folders that exist before their content', () => {
  it('adds a folder once, refusing empties, dupes and nesting', () => {
    assert.deepEqual(addFolder([], 'Work'), ['Work'])
    assert.deepEqual(addFolder(['Work'], 'Work'), ['Work'])
    assert.deepEqual(addFolder(['Work'], '  '), ['Work'])
    assert.deepEqual(addFolder(['Work'], 'A/B'), ['Work'], 'a folder name is one segment')
    assert.deepEqual(addFolder(['Work'], '/Team/'), ['Work', 'Team'], 'stray slashes are trimmed')
    assert.deepEqual(addFolder(['a', 'b'], 'c'), ['a', 'b', 'c'], 'order is kept')
  })

  it('removes only the named folder', () => {
    assert.deepEqual(removeFolder(['a', 'b'], 'a'), ['b'])
    assert.deepEqual(removeFolder(['a', 'b'], 'zz'), ['a', 'b'])
    assert.deepEqual(removeFolder(['a'], ''), ['a'])
  })

  it('round-trips and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeFolders(['Work', 'Team'], storage)
    assert.deepEqual(readFolders(storage), ['Work', 'Team'])
    assert.deepEqual(readFolders({ getItem: () => 'not json', setItem: () => {} }), [])
    assert.deepEqual(readFolders({ getItem: () => '{"a":1}', setItem: () => {} }), [])
    assert.deepEqual(readFolders(undefined), [])
  })

  it('draws declared folders after the implied ones', () => {
    const rows = [{ workspace: { workspaceId: 'w1', title: 'Work/Alpha' } }]
    assert.deepEqual(folderNamesOf(rows, ['Team', 'Work']), ['Work', 'Team'])
    assert.deepEqual(folderNamesOf([], ['Solo']), ['Solo'])
    assert.deepEqual(folderNamesOf(rows, []), ['Work'])
  })
})
`
fs.writeFileSync(p, src)
console.log('folder tests added')
