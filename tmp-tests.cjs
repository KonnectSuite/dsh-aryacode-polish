const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('explodeDensity')) { console.log('already patched'); process.exit(0) }
const head = src.indexOf('  planReorder,')
const endOfImports = src.indexOf("\n} from", head)
const names = ['  densityOf,\n', '  readDensity,\n', '  writeDensity,\n', '  splitArchived,\n']
src = src.slice(0, endOfImports) + names.join('') + src.slice(endOfImports)
src += `
describe('density and the archived section', () => {
  const memoryStorage = () => {
    const memory = new Map()
    return { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
  }

  it('reads comfort by default and survives junk', () => {
    assert.equal(densityOf(undefined), 'comfortable')
    assert.equal(densityOf('compact'), 'compact')
    assert.equal(densityOf('cozy'), 'comfortable')
    assert.equal(readDensity(undefined), 'comfortable')
    assert.equal(readDensity({ getItem: () => 'cozy', setItem: () => {} }), 'comfortable')
    assert.equal(readDensity({ getItem: () => { throw new Error('locked') }, setItem: () => {} }), 'comfortable')
  })

  it('remembers the chosen density', () => {
    const storage = memoryStorage()
    writeDensity('compact', storage)
    assert.equal(readDensity(storage), 'compact')
    writeDensity('comfortable', storage)
    assert.equal(readDensity(storage), 'comfortable')
    assert.doesNotThrow(() => writeDensity('compact', undefined))
  })

  it('splits archived sessions out of the rows a workspace shows', () => {
    const sessions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    assert.deepEqual(splitArchived(sessions, ['b']), { active: [{ id: 'a' }, { id: 'c' }], archived: [{ id: 'b' }] })
    assert.deepEqual(splitArchived(sessions, new Set(['c'])), { active: [{ id: 'a' }, { id: 'b' }], archived: [{ id: 'c' }] })
    assert.deepEqual(splitArchived(sessions, undefined), { active: sessions, archived: [] })
    assert.deepEqual(splitArchived(undefined, ['a']), { active: [], archived: [] })
  })
})
`
fs.writeFileSync(p, src)
console.log('workspace tests extended')
