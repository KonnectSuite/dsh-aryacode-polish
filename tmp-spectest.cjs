const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(p, 'utf8')
spec = spec.replace('  moveBefore,', '  moveBefore,\n  moveTargets,')
if (!spec.includes("describe('moveTargets'")) {
  spec += `
describe('moveTargets', () => {
  const rows = [
    { workspace: { workspaceId: 'w1' }, sessions: [] },
    { workspace: { workspaceId: 'w2' }, sessions: [] },
    { workspace: { workspaceId: 'w3' }, sessions: [] },
  ]

  it('offers every other workspace as a destination', () => {
    assert.deepEqual(moveTargets(rows, 'w2').map((row) => row.workspace.workspaceId), ['w1', 'w3'])
  })

  it('offers nothing when there is nowhere to move', () => {
    assert.deepEqual(moveTargets([{ workspace: { workspaceId: 'w1' }, sessions: [] }], 'w1'), [])
    assert.deepEqual(moveTargets(undefined, 'w1'), [])
  })
})
`
}
fs.writeFileSync(p, spec)
console.log('spec updated')
