const fs = require('node:fs')
let s = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
if (!s.includes("Most spent first")) {
  s = s.replace(/^import \{[\s\S]*?\} from '\.\.\/client\/workspace\.js'$/m, (block) => {
    if (block.includes('SORT_TITLES')) return block
    return block.replace(/\n\}\) from '\.\/workspace/, "\n} from '")
  })
  s += `
test('Sort by spend ranks workspaces by what they cost', () => {
  const groups = [
    { workspace: { workspaceId: 'a', title: 'Alpha' }, sessions: [] },
    { workspace: { workspaceId: 'b', title: 'Bravo' }, sessions: [] },
    { workspace: { workspaceId: 'c', title: 'Charlie' }, sessions: [] },
  ]
  const totals = { a: { usd: 0.5 }, b: { usd: 2.25 } }
  const ranked = sortRows(groups, 'cost', (group) => totals[group.workspace.workspaceId])
  assert.deepEqual(ranked.map((group) => group.workspace.workspaceId), ['b', 'a', 'c'])
})

test('A workspace with no spend sinks below a priced one, whatever its name', () => {
  const groups = [
    { workspace: { workspaceId: 'aaa', title: 'AAA' }, sessions: [] },
    { workspace: { workspaceId: 'zzz', title: 'ZZZ' }, sessions: [] },
  ]
  const totals = { zzz: { usd: 0.01 } }
  const ranked = sortRows(groups, 'cost', (group) => totals[group.workspace.workspaceId])
  assert.deepEqual(ranked.map((group) => group.workspace.workspaceId), ['zzz', 'aaa'])
})

test('Every sort mode is named once, and cost is one of them', () => {
  assert.deepEqual(SORTS, ['host', 'name', 'cost'])
  assert.equal(SORT_TITLES.cost, 'Most spent first')
  assert.equal(sortOf('cost'), 'cost')
  for (const mode of SORTS) assert.equal(typeof SORT_TITLES[mode], 'string')
})

test('Sorting by spend without totals falls back to names, not to a crash', () => {
  const groups = [
    { workspace: { workspaceId: 'b', title: 'Bravo' }, sessions: [] },
    { workspace: { workspaceId: 'a', title: 'Alpha' }, sessions: [] },
  ]
  assert.deepEqual(sortRows(groups, 'cost').map((group) => group.workspace.workspaceId), ['a', 'b'])
})
`
  fs.writeFileSync('test/workspace.spec.mjs', s)
  console.log('spec cases appended')
}
