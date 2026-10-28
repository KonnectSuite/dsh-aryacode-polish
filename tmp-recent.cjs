const fs = require('node:fs')

function swap(file, from, to, expected = 1) {
  const before = fs.readFileSync(file, 'utf8')
  const count = before.split(from).length - 1
  if (count !== expected) throw new Error(file + ': expected ' + expected + ' match(es), found ' + count + ' for ' + JSON.stringify(from.slice(0, 60)))
  const after = before.split(from).join(to)
  fs.writeFileSync(file, after)
  console.log(file + ': ' + before.split('\n').length + ' -> ' + after.split('\n').length + ' lines')
}

swap('client/workspace.js', "export const SORTS = ['host', 'name', 'cost']", "export const SORTS = ['host', 'name', 'cost', 'recent']")
swap('client/workspace.js', "  cost: 'Most spent first',\n}", "  cost: 'Most spent first',\n  recent: 'Recent first',\n}")

const costTail = `    ranked.sort((a, b) => {
      // A workspace nobody has spent in sinks below a priced one, whatever its name.
      if (a.usd === undefined && b.usd !== undefined) return 1
      if (b.usd === undefined && a.usd !== undefined) return -1
      if (a.usd !== undefined && b.usd !== undefined && a.usd !== b.usd) return b.usd - a.usd
      if (a.label !== b.label) return a.label < b.label ? -1 : 1
      return a.index - b.index
    })
    return ranked.map((entry) => entry.group)
  }
`
const recentBranch = costTail + `  if (kind === 'recent') {
    const stamp = (group) => {
      const times = (group.sessions || [])
        .map((row) => Number(row && row.updatedAt))
        .filter((value) => Number.isFinite(value) && value > 0)
      return times.length === 0 ? undefined : Math.max.apply(null, times)
    }
    const ranked = rows.map((group, index) => ({
      group,
      index,
      at: stamp(group),
      label: workspaceLabel(group.workspace).toLowerCase(),
    }))
    ranked.sort((a, b) => {
      // A workspace nothing has touched sinks below any workspace that has been used.
      if (a.at === undefined && b.at !== undefined) return 1
      if (b.at === undefined && a.at !== undefined) return -1
      if (a.at !== undefined && b.at !== undefined && a.at !== b.at) return b.at - a.at
      if (a.label !== b.label) return a.label < b.label ? -1 : 1
      return a.index - b.index
    })
    return ranked.map((entry) => entry.group)
  }
`
swap('client/workspace.js', costTail, recentBranch)

swap('test/workspace.spec.mjs', "  assert.deepEqual(SORTS, ['host', 'name', 'cost'])", "  assert.deepEqual(SORTS, ['host', 'name', 'cost', 'recent'])")
swap('test/workspace.spec.mjs', "  assert.equal(SORT_TITLES.cost, 'Most spent first')", "  assert.equal(SORT_TITLES.cost, 'Most spent first')\n  assert.equal(SORT_TITLES.recent, 'Recent first')")

const anchor = `it('Every sort mode is named once, and cost is one of them', () => {`
const added = `it('Sort by recency puts the workspace touched last on top', () => {
  const groups = [
    { workspace: { workspaceId: 'old', title: 'Old' }, sessions: [{ id: 's1', updatedAt: 1_000 }] },
    { workspace: { workspaceId: 'new', title: 'New' }, sessions: [{ id: 's2', updatedAt: 9_000 }, { id: 's3', updatedAt: 4_000 }] },
    { workspace: { workspaceId: 'mid', title: 'Mid' }, sessions: [{ id: 's4', updatedAt: 5_000 }] },
  ]
  const ranked = sortRows(groups, 'recent')
  assert.deepEqual(ranked.map((group) => group.workspace.workspaceId), ['new', 'mid', 'old'])
})

it('A workspace nothing has touched sinks below a dated one, whatever its name', () => {
  const groups = [
    { workspace: { workspaceId: 'aaa', title: 'AAA' }, sessions: [{ id: 's1', updatedAt: 0 }] },
    { workspace: { workspaceId: 'zzz', title: 'ZZZ' }, sessions: [{ id: 's2', updatedAt: 250 }] },
  ]
  assert.deepEqual(sortRows(groups, 'recent').map((group) => group.workspace.workspaceId), ['zzz', 'aaa'])
})

it('Recency without a usable stamp falls back to names, not to a crash', () => {
  const groups = [
    { workspace: { workspaceId: 'b', title: 'Bravo' }, sessions: [] },
    { workspace: { workspaceId: 'a', title: 'Alpha' } },
  ]
  assert.deepEqual(sortRows(groups, 'recent').map((group) => group.workspace.workspaceId), ['a', 'b'])
})

` + anchor
swap('test/workspace.spec.mjs', anchor, added)
