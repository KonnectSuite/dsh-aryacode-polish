const fs = require('node:fs')

const spec = 'test/workspace.spec.mjs'
let s = fs.readFileSync(spec, 'utf8')
if (!s.includes('splitPinned')) {
  s = s.replace("  splitArchived,\n", "  splitArchived,\n  splitPinned,\n")
  if (!s.includes('splitPinned,')) throw new Error('import anchor missing')
  s += `
describe('pinned sessions', () => {
  const sessions = [
    { id: 's1', displayTitle: 'one' },
    { id: 's2', displayTitle: 'two' },
    { id: 's3', displayTitle: 'three' },
  ]

  it('lifts pinned sessions out of their workspace, in order', () => {
    const split = splitPinned(sessions, ['s3', 's1'])
    assert.deepEqual(split.pinned.map(s => s.id), ['s1', 's3'])
    assert.deepEqual(split.rest.map(s => s.id), ['s2'])
  })

  it('returns everything untouched when nothing is pinned', () => {
    const split = splitPinned(sessions, [])
    assert.deepEqual(split.pinned, [])
    assert.deepEqual(split.rest.map(s => s.id), ['s1', 's2', 's3'])
  })

  it('ignores pin ids for sessions that are gone', () => {
    const split = splitPinned(sessions, ['s9'])
    assert.deepEqual(split.pinned, [])
    assert.equal(split.rest.length, 3)
  })

  it('survives an undefined list', () => {
    assert.deepEqual(splitPinned(undefined, ['s1']), { pinned: [], rest: [] })
  })
})
`
  fs.writeFileSync(spec, s)
  console.log('pinned tests added')
}

const face = 'test/client-face.spec.mjs'
let f = fs.readFileSync(face, 'utf8')
if (!f.includes('data-polish-ws-pinned')) {
  f += `
test('a pinned session is lifted into its own section', () => {
  for (const marker of ['data-polish-ws-pinned', 'data-polish-ws-pinned-row', 'splitPinned(', "'Pinned'"]) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
  fs.writeFileSync(face, f)
  console.log('face test added')
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.25.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.25.0] - 2026-10-28

Added: pinned sessions are lifted into a Pinned section at the top of the tree, with their workspace
name beside them and the usual session menu on right-click — a pin used to be a star on a row you had
to find. Unpinning puts the session back where it belongs.

` + log)
console.log('0.25.0')
