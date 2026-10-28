const fs = require('node:fs')
// keep the spec honest about the stable-order rule
const s = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(s, 'utf8')
spec = spec.replace(
  `  it('orders sessions newest first, then by title', () => {
    const list = [session('a', 'alpha', 1), session('c', 'charlie', 9), session('b', 'bravo', 9)]
    assert.deepEqual(list.slice().sort(sessionRank).map(row => row.displayTitle), ['bravo', 'charlie', 'alpha'])
  })`,
  `  it('reorders only on a real timestamp, because the Host list order is the display order', () => {
    const list = [session('a', 'alpha', 1), session('c', 'charlie', 9), session('b', 'bravo', 9)]
    assert.deepEqual(list.slice().sort(sessionRank).map(row => row.displayTitle), ['charlie', 'bravo', 'alpha'])
    const untimed = [{ id: 'z', displayTitle: 'z' }, { id: 'y', displayTitle: 'y' }]
    assert.deepEqual(untimed.slice().sort(sessionRank).map(row => row.id), ['z', 'y'])
  })`,
)
spec = spec.replace(
  `  it('pairs each workspace with the sessions it owns, in display order', () => {
    const rows = workspaceRows(
      [{ workspaceId: 'w1', title: 'One', sessionIds: ['s1', 's2'] }],
      [session('s1', 'older', 1), session('s2', 'newer', 5)],
    )
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].sessions.map(row => row.displayTitle), ['newer', 'older'])
  })`,
  `  it('pairs each workspace with the sessions it owns, keeping the Host order', () => {
    const rows = workspaceRows(
      [{ workspaceId: 'w1', title: 'One', sessionIds: ['s1', 's2'] }],
      [session('s1', 'older'), session('s2', 'newer')],
    )
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].sessions.map(row => row.displayTitle), ['older', 'newer'])
  })`,
)
fs.writeFileSync(s, spec)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
c = c.replace('## [0.9.0] - 2026-10-28', '## [0.9.1] - 2026-10-28\n\n### Fixed\n\n- Better workspace reads the session list as `{ ids, byId }` and keeps the Host order;\n  it no longer re-sorts on a timestamp `SessionSummary` does not carry.\n\n## [0.9.0] - 2026-10-28')
fs.writeFileSync('CHANGELOG.md', c)
console.log('version ' + pkg.version)
