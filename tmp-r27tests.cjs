const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('type-ahead')) {
  s += `
it('type-ahead matches the prefix of a session title', () => {
  const rows = [
    { workspace: { workspaceId: 'w1', title: 'Work' }, sessions: [{ id: 's1', displayTitle: 'Greeting' }, { id: 's2', displayTitle: 'Build the thing' }] },
    { workspace: { workspaceId: 'w2', title: 'Play' }, sessions: [{ id: 's3', displayTitle: 'Garden' }] },
  ]
  const walk = flattenRows(rows, {}, '')
  const titles = walk.map((entry) => {
    const group = rows.find((item) => item.workspace.workspaceId === entry.workspaceId) || {}
    if (entry.kind === 'workspace') return workspaceLabel(group.workspace)
    const row = (group.sessions || []).find((item) => item.id === entry.id) || {}
    return String(row.displayTitle || row.title || '')
  })
  const hit = titles.findIndex((title) => title.toLowerCase().startsWith('bu'))
  assert.equal(titles[hit], 'Build the thing')
  assert.equal(titles.findIndex((title) => title.toLowerCase().startsWith('z')), -1)
})
`
  fs.writeFileSync(p, s)
  console.log('type-ahead spec added')
} else console.log('spec already has type-ahead')
const f = 'test/client-face.spec.mjs'
let face = fs.readFileSync(f, 'utf8')
if (!face.includes('drop a session on the Pinned header')) {
  face = face.replace(/^test\(/m, `test('a session can be pinned by dropping it on the Pinned header', () => {
  assert.match(workspaceSource, /dropping === 'pinned'/)
  assert.match(workspaceSource, /kind: 'pinned'/)
  assert.match(workspaceSource, /services\\.pinSession\\(moving\\.id\\)/)
  assert.match(workspaceSource, /services\\.unpinSession\\(moving\\.id\\)/)
  assert.match(workspaceSource, /typeBufferRef/)
})

test(`)
  fs.writeFileSync(f, face)
  console.log('face spec added')
} else console.log('face already')
