const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(p, 'utf8')
spec = spec.replace(
  "import { workspaceRows, sessionRank, shippedBrowserEntry, menuRuntime, rowMenuEntries } from '../client/workspace.js'",
  "import { workspaceRows, sessionRank, shippedBrowserEntry, menuRuntime, rowMenuEntries, filterTree, flattenRows, moveBefore, workspaceLabel } from '../client/workspace.js'",
)
spec = spec.trimEnd()
if (!spec.endsWith('})')) { console.log('unexpected tail: ' + spec.slice(-40)); process.exit(1) }
spec = spec.slice(0, -2).trimEnd() + `

  it('keeps pinned sessions first and the Host order otherwise', () => {
    const rows = filterTree(
      [{ workspace: { workspaceId: 'w', title: 'W' }, sessions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }],
      '',
      new Set(['c']),
    )
    assert.deepEqual(rows[0].sessions.map(row => row.id), ['c', 'a', 'b'])
  })

  it('filters by workspace label and by session title', () => {
    const input = [
      { workspace: { workspaceId: 'w1', title: 'Alpha' }, sessions: [{ id: 's1', displayTitle: 'season' }, { id: 's2', displayTitle: 'other' }] },
      { workspace: { workspaceId: 'w2', title: 'Beta' }, sessions: [{ id: 's3', displayTitle: 'session two' }] },
    ]
    const bySession = filterTree(input, 'session', new Set())
    assert.deepEqual(bySession.map(row => row.workspace.workspaceId), ['w1', 'w2'])
    assert.deepEqual(bySession[0].sessions.map(row => row.id), ['s1'])
    const byWorkspace = filterTree(input, 'beta', new Set())
    assert.deepEqual(byWorkspace.map(row => row.workspace.workspaceId), ['w2'])
    assert.deepEqual(byWorkspace[0].sessions.map(row => row.id), ['s3'])
    assert.deepEqual(filterTree(input, 'nothing here', new Set()), [])
  })

  it('opens every kept group while filtering, so a match is always visible', () => {
    const rows = [{ workspace: { workspaceId: 'w' }, sessions: [{ id: 's1' }, { id: 's2' }] }]
    const folded = { w: false }
    assert.deepEqual(flattenRows(rows, folded, '').map(item => item.kind), ['workspace'])
    assert.deepEqual(flattenRows(rows, folded, 's').map(item => item.kind), ['workspace', 'session', 'session'])
    assert.deepEqual(flattenRows(rows, {}, '').map(item => item.id), ['w', 's1', 's2'])
  })

  it('moves a row in front of another without losing it', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    assert.deepEqual(moveBefore(list, 'c', 'a').map(row => row.id), ['c', 'a', 'b'])
    assert.deepEqual(moveBefore(list, 'a', 'c').map(row => row.id), ['b', 'a', 'c'])
    assert.deepEqual(moveBefore(list, 'a', 'missing'), list)
    assert.deepEqual(moveBefore(list, 'a', 'a'), list)
  })

  it('humanises a workspace whose title merely repeats its id', () => {
    assert.equal(workspaceLabel({ workspaceId: 'default-workspace1', title: 'default-workspace1' }), 'Default workspace1')
    assert.equal(workspaceLabel({ workspaceId: 'w', title: 'Rockwell line' }), 'Rockwell line')
    assert.equal(workspaceLabel({ workspaceId: '' }), 'Workspace')
  })
})
`
fs.writeFileSync(p, spec)
console.log('specs added')
