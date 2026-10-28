const fs = require('node:fs')
let s = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
if (!s.includes('sumTokens')) {
  s = s.replace("  SORTS,\n  SORT_TITLES,", "  SORTS,\n  SORT_TITLES,\n  costDetail,\n  sumTokens,")
  s += `
it('Reads every bucket the cost projection publishes', () => {
  const snapshot = {
    projectionsBySession: {
      s1: { values: { polishCost: { tokens: 100, cacheRead: 70, uncached: 20, cacheWrite: 4, output: 6, requests: 2, costUsd: '0.01', incomplete: false, models: [{}, {}] } } },
    },
  }
  assert.deepEqual(costDetail(snapshot, 's1'), {
    cacheRead: 70,
    uncached: 20,
    cacheWrite: 4,
    output: 6,
    requests: 2,
    tokens: 100,
    usd: '0.01',
    cny: undefined,
    incomplete: false,
    models: 2,
  })
})

it('A session without a priced view has no detail, and a bad value never throws', () => {
  assert.equal(costDetail(undefined, 's1'), undefined)
  assert.equal(costDetail({ projectionsBySession: {} }, 's1'), undefined)
  assert.equal(costDetail({ projectionsBySession: { s1: { values: { polishCost: 'nope' } } } }, 's1'), undefined)
  assert.equal(costDetail({ projectionsBySession: { s1: { values: { polishCost: { tokens: 0 } } } } }, 's1'), undefined)
})

it('Rolls a workspace up into buckets and a cache-hit share', () => {
  const snapshot = {
    projectionsBySession: {
      s1: { values: { polishCost: { tokens: 100, cacheRead: 70, uncached: 20, cacheWrite: 4, output: 6, requests: 1, costUsd: '0.01' } } },
      s2: { values: { polishCost: { tokens: 50, cacheRead: 0, uncached: 50, cacheWrite: 0, output: 0, requests: 1, costUsd: '0.02' } } },
      s3: { values: { polishCost: { tokens: 9, costCny: '0.5' } } },
    },
  }
  const sessions = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }]
  const totals = sumTokens(sessions, snapshot)
  assert.equal(totals.cacheRead, 70)
  assert.equal(totals.uncached, 70)
  assert.equal(totals.cacheWrite, 4)
  assert.equal(totals.output, 6)
  assert.equal(totals.requests, 2)
  assert.equal(totals.priced, 3)
  assert.equal(totals.billed, 150)
  assert.equal(totals.hit, 47)
})

it('A group with nothing priced reports zero priced sessions', () => {
  const totals = sumTokens([{ id: 'x' }], { projectionsBySession: {} })
  assert.equal(totals.priced, 0)
  assert.equal(totals.billed, 0)
  assert.equal(totals.hit, 0)
})
`
  fs.writeFileSync('test/workspace.spec.mjs', s)
  console.log('cost detail specs appended')
}
