const fs = require('node:fs')
let s = fs.readFileSync('client/workspace.js', 'utf8')

// 1. third sort mode plus its labels
const sorts = "export const SORTS = ['host', 'name']"
if (!s.includes(sorts)) throw new Error('SORTS anchor missing')
s = s.replace(sorts, `export const SORTS = ['host', 'name', 'cost']

export const SORT_TITLES = {
  host: 'Host order',
  name: 'Sort A to Z',
  cost: 'Most spent first',
}`)

// 2. the ranking itself
const oldSort = `export function sortRows(rows, mode) {
  if (sortOf(mode) !== 'name') return rows`
if (!s.includes(oldSort)) throw new Error('sortRows anchor missing')
s = s.replace(oldSort, `export function sortRows(rows, mode, totalOf) {
  const kind = sortOf(mode)
  if (kind === 'host') return rows
  if (kind === 'cost') {
    const spent = (group) => {
      const total = typeof totalOf === 'function' ? totalOf(group) : undefined
      return total && typeof total.usd === 'number' && Number.isFinite(total.usd) ? total.usd : undefined
    }
    const ranked = rows.map((group, index) => ({
      group,
      index,
      usd: spent(group),
      label: workspaceLabel(group.workspace).toLowerCase(),
    }))
    ranked.sort((a, b) => {
      // A workspace nobody has spent in sinks below a priced one, whatever its name.
      if (a.usd === undefined && b.usd !== undefined) return 1
      if (b.usd === undefined && a.usd !== undefined) return -1
      if (a.usd !== undefined && b.usd !== undefined && a.usd !== b.usd) return b.usd - a.usd
      if (a.label !== b.label) return a.label < b.label ? -1 : 1
      return a.index - b.index
    })
    return ranked.map((entry) => entry.group)
  }`)

// 3. feed the totals in
const call = 'const rows = filterTree(sortRows(allRows, sort), query, pinned)'
if (!s.includes(call)) throw new Error('sort call missing')
s = s.replace(call, "const rows = filterTree(sortRows(allRows, sort, (group) => sumCost(group.sessions, sessionState)), query, pinned)")

// 4. one label source for the menu
const label = "}, mark + (each === 'name' ? 'Sort A to Z' : 'Host order')))"
if (!s.includes(label)) throw new Error('sort label missing')
s = s.replace(label, '}, mark + (SORT_TITLES[each] || each)))')

fs.writeFileSync('client/workspace.js', s)
console.log('workspace.js patched')
