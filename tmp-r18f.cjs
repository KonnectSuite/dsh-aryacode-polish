const fs = require('node:fs')

const spec = 'test/workspace.spec.mjs'
let s = fs.readFileSync(spec, 'utf8')
if (!s.includes('costOf')) {
  s = s.replace("  splitPinned,\n", "  splitPinned,\n  costOf,\n  costLabel,\n")
  if (!s.includes('costOf,')) throw new Error('import anchor missing')
  s += `
describe('per-session cost', () => {
  const snapshot = {
    projectionsBySession: {
      s1: { values: { polishCost: { costUsd: '0.000096', incomplete: false } }, state: 'ready', error: null },
      s2: { values: { polishCost: { costCny: '0.0042' } }, state: 'ready', error: null },
      s3: { values: {}, state: 'idle', error: null },
      s4: { values: { polishCost: { tokens: 10 } }, state: 'ready', error: null },
    },
  }

  it('reads the priced view the Host writes', () => {
    assert.deepEqual(costOf(snapshot, 's1'), { usd: '0.000096', cny: undefined, incomplete: false })
    assert.deepEqual(costOf(snapshot, 's2'), { usd: undefined, cny: '0.0042', incomplete: false })
  })

  it('hides itself when there is nothing priced', () => {
    assert.equal(costOf(snapshot, 's3'), undefined)
    assert.equal(costOf(snapshot, 's4'), undefined)
    assert.equal(costOf(snapshot, 'missing'), undefined)
    assert.equal(costOf(undefined, 's1'), undefined)
  })

  it('formats dollars, yuan and sub-cent amounts', () => {
    assert.equal(costLabel(costOf(snapshot, 's1')), '\\u2248$0.000096')
    assert.equal(costLabel(costOf(snapshot, 's2')), '\\u2248\\u00a50.00420')
    assert.equal(costLabel({ usd: '1.5' }), '\\u2248$1.50')
    assert.equal(costLabel({ usd: '0.05' }), '\\u2248$0.050')
    assert.equal(costLabel({ usd: '0.9', incomplete: true }), '~$0.90')
    assert.equal(costLabel(undefined), '')
    assert.equal(costLabel({ usd: 'n/a' }), '')
  })
})
`
  fs.writeFileSync(spec, s)
  console.log('cost tests added')
}

const face = 'test/client-face.spec.mjs'
let f = fs.readFileSync(face, 'utf8')
if (!f.includes('data-polish-ws-cost')) {
  f += `
test('a session row can show what it has cost', () => {
  for (const marker of ['data-polish-ws-cost', 'costLabel(costOf(sessionState', 'projectionsBySession']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
  fs.writeFileSync(face, f)
  console.log('face test added')
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.26.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.26.0] - 2026-10-28

Added: a session row shows what that session has cost so far, read from the \`polishCost\` projection the
cost feature already writes. The number is hidden when nothing is priced, so a Shell without the cost
feature shows no cost rather than a fake zero.

Fixed: the "flagged" glyph on a session row had been written as mojibake by an earlier PowerShell
patch and never rendered as a flag.

` + log)
console.log('0.26.0')
