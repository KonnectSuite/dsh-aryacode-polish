const fs = require('node:fs')
let spec = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
spec = spec.replace(`  folderKey,`, `  folderKey,
  rankMatches,
  readFolded,
  writeFolded,`)
spec += `
describe('quick switcher and folded state', () => {
  it('ranks prefix matches above contains matches, keeping arrival order inside a rank', () => {
    const items = [
      { id: 'a', title: 'Regression check' },
      { id: 'b', title: 'Greeting' },
      { id: 'c', title: 'gre' },
    ]
    assert.deepEqual(rankMatches(items, 'gre').map(i => i.id), ['c', 'b', 'a'])
  })

  it('returns the first rows for an empty query and nothing for a miss', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: String(i), title: 'row ' + i }))
    assert.equal(rankMatches(items, '').length, 40)
    assert.deepEqual(rankMatches(items, 'zzz'), [])
    assert.deepEqual(rankMatches(undefined, 'x'), [])
  })

  it('matches on the workspace label when a caller passes its own text', () => {
    const items = [{ id: 'a', title: 'ok', workspace: 'KonnectSuite' }]
    assert.deepEqual(rankMatches(items, 'konnect', item => item.workspace), items)
  })

  it('round-trips folded state and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeFolded({ workspaces: { w1: false }, folders: { Work: true } }, storage)
    assert.deepEqual(readFolded(storage), { workspaces: { w1: false }, folders: { Work: true } })
    assert.deepEqual(readFolded({ getItem: () => 'nope{', setItem: () => {} }), { workspaces: {}, folders: {} })
    assert.deepEqual(readFolded(undefined), { workspaces: {}, folders: {} })
  })
})
`
fs.writeFileSync('test/workspace.spec.mjs', spec)

let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-switcher')) {
  face = face.replace(`  assert.ok(workspaceSource.includes('workspaces.rename('), 'the rename is a Host call')`, `  assert.ok(workspaceSource.includes('workspaces.rename('), 'the rename is a Host call')
  assert.ok(workspaceSource.includes('data-polish-switcher'), 'Ctrl-K opens a switcher')
  assert.ok(workspaceSource.includes('aryacode-polish:folded'), 'the folded state has a storage key')`)
  fs.writeFileSync('test/client-face.spec.mjs', face)
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.14.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.14.0]')) {
  c = c.replace('## [0.13.1] - 2026-10-28', `## [0.14.0] - 2026-10-28

### Added

- **Quick switcher.** Ctrl/⌘-K (or Cmd-K) opens a palette over everything: every session
  in every workspace, ranked so a prefix beats a mention, arrows to walk, Enter to open,
  Escape to dismiss. Rows show the session title and the workspace it lives in.
- **Folded state persists.** Which workspaces and which folders are collapsed is kept
  under \`aryacode-polish:folded.v1\`, so reopening the app looks like it did on the way
  out. A storage that refuses costs the memory and nothing else.

## [0.13.1] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('0.14.0 ready')
