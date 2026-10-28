const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('jumpWorkspace')) { console.log('already'); process.exit(0) }
src = src.replace("  markOf,\n", "  markOf,\n  jumpWorkspace,\n  nextDensity,\n")
src += `
describe('folder density and workspace hopping', () => {
  const walk = [
    { kind: 'workspace', id: 'w1', workspaceId: 'w1' },
    { kind: 'session', id: 's1', workspaceId: 'w1' },
    { kind: 'session', id: 's2', workspaceId: 'w1' },
    { kind: 'workspace', id: 'w2', workspaceId: 'w2' },
    { kind: 'session', id: 's3', workspaceId: 'w2' },
    { kind: 'workspace', id: 'w3', workspaceId: 'w3' },
  ]

  it('hops forward and backward between workspace heads, wrapping', () => {
    assert.equal(jumpWorkspace(walk, -1, 1), 0)
    assert.equal(jumpWorkspace(walk, 0, 1), 3)
    assert.equal(jumpWorkspace(walk, 2, 1), 3)
    assert.equal(jumpWorkspace(walk, 3, 1), 5)
    assert.equal(jumpWorkspace(walk, 5, 1), 0)
    assert.equal(jumpWorkspace(walk, 3, -1), 0)
    assert.equal(jumpWorkspace(walk, 0, -1), 5)
    assert.equal(jumpWorkspace([], 0, 1), -1)
    assert.equal(jumpWorkspace([{ kind: 'session', id: 's' }], -1, 1), -1)
  })

  it('cycles comfortable -> compact -> folders -> comfortable', () => {
    assert.equal(nextDensity('comfortable'), 'compact')
    assert.equal(nextDensity('compact'), 'folders')
    assert.equal(nextDensity('folders'), 'comfortable')
    assert.equal(nextDensity('nonsense'), 'compact')
  })

  it('hides sessions in the folders density but keeps workspaces', () => {
    assert.equal(DENSITY_METRICS.folders.sessions, false)
    assert.equal(DENSITY_METRICS.compact.sessions, true)
    assert.ok(DENSITY_GLYPHS.folders.length > 0)
    assert.ok(DENSITY_TITLES.folders.length > 0)
  })
})
`
src = src.replace("  markOf,\n  jumpWorkspace,", "  markOf,\n  DENSITY_GLYPHS,\n  DENSITY_METRICS,\n  DENSITY_TITLES,\n  jumpWorkspace,")
fs.writeFileSync(p, src)
console.log('tests added')
