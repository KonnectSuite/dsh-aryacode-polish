const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (s.includes('actionEntries')) { console.log('spec already'); process.exit(0) }
const anchor = '  highlightParts,'
if (!s.includes(anchor)) throw new Error('import anchor missing')
s = s.replace(anchor, '  actionEntries,\n' + anchor)
s += `
it('the palette offers a new session per workspace', () => {
  const rows = [
    { workspace: { workspaceId: 'w1', title: 'Work/Alpha' }, sessions: [] },
    { workspace: { workspaceId: 'w2', title: 'Beta' }, sessions: [] },
  ]
  const entries = actionEntries(rows)
  assert.deepEqual(entries.map((entry) => entry.id), ['new:w1', 'new:w2'])
  assert.deepEqual(entries.map((entry) => entry.title), ['New session in Work/Alpha', 'New session in Beta'])
  assert.ok(entries.every((entry) => entry.kind === 'action' && entry.workspaceId))
  assert.deepEqual(actionEntries(undefined), [])
})
`
fs.writeFileSync(p, s)
console.log('action spec added')

const f = 'test/client-face.spec.mjs'
let face = fs.readFileSync(f, 'utf8')
if (face.includes('data-polish-switcher-action')) { console.log('face already'); process.exit(0) }
face = face.replace(/^test\(/m, `test('the palette can act, not only jump', () => {
  assert.match(workspaceSource, /actionEntries\\(/)
  assert.match(workspaceSource, /'data-polish-switcher-action'/)
  assert.match(workspaceSource, /services\\.startSession\\(hit\\.workspaceId\\)/)
})

test(`)
fs.writeFileSync(f, face)
console.log('face spec added')
