const fs = require('node:fs')

const spec = 'test/workspace.spec.mjs'
let s = fs.readFileSync(spec, 'utf8')
if (!s.includes('sortRows')) {
  s = s.replace("  markOf,\n", "  markOf,\n  sortRows,\n  sortOf,\n  readSort,\n  writeSort,\n")
  s += `
describe('workspace sort modes', () => {
  const rows = [
    { workspace: { workspaceId: 'a', path: 'C:/zulu', title: 'zulu', sessionIds: [] }, sessions: [] },
    { workspace: { workspaceId: 'b', path: 'C:/Work/alpha', title: 'Work/alpha', sessionIds: [] }, sessions: [] },
    { workspace: { workspaceId: 'c', path: 'C:/mike', title: 'mike', sessionIds: [] }, sessions: [] },
    { workspace: { workspaceId: 'd', path: 'C:/Work/bravo', title: 'Work/bravo', sessionIds: [] }, sessions: [] },
  ]

  it('leaves the host order alone unless asked', () => {
    assert.deepEqual(sortRows(rows, 'host').map(r => r.workspace.workspaceId), ['a', 'b', 'c', 'd'])
    assert.deepEqual(sortRows(rows, undefined).map(r => r.workspace.workspaceId), ['a', 'b', 'c', 'd'])
  })

  it('sorts unfiled workspaces first, then by folder, then by name', () => {
    assert.deepEqual(sortRows(rows, 'name').map(r => r.workspace.workspaceId), ['c', 'a', 'b', 'd'])
  })

  it('keeps a folder group together', () => {
    const ordered = sortRows(rows, 'name')
    const folders = ordered.map(r => (r.workspace.title.includes('/') ? r.workspace.title.split('/')[0] : ''))
    assert.deepEqual(folders, ['', '', 'Work', 'Work'])
  })

  it('falls back to host order for an unknown mode and round-trips storage', () => {
    assert.equal(sortOf('sideways'), 'host')
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeSort('name', storage)
    assert.equal(readSort(storage), 'name')
    assert.equal(readSort({ getItem: () => 'nonsense', setItem: () => {} }), 'host')
  })
})
`
  fs.writeFileSync(spec, s)
  console.log('sort tests added')
}

const face = 'test/client-face.spec.mjs'
let f = fs.readFileSync(face, 'utf8')
if (!f.includes('data-polish-ws-sort')) {
  f += `
test('the tree can sort A to Z and the switcher can jump to a workspace', () => {
  for (const marker of ['data-polish-ws-sort', 'aryacode-polish:sort.v1', "'workspace:' + group.workspace.workspaceId", 'revealWorkspace(']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
  fs.writeFileSync(face, f)
  console.log('face test added')
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.24.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.24.0] - 2026-10-28

Added: a sort control in the tree header (host order or A to Z, folders kept together), and workspace
entries in the Ctrl-K switcher that reveal the workspace in the tree instead of opening a session.

` + log)
console.log('0.24.0')
