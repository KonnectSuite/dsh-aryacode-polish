const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// The host list order is the display order; a missing updatedAt must not re-sort.
src = src.replace(
  `export function sessionRank(a, b) {
  const left = Number(a && a.updatedAt) || 0
  const right = Number(b && b.updatedAt) || 0
  if (left !== right) return right - left
  return String((a && a.displayTitle) || '').localeCompare(String((b && b.displayTitle) || ''))
}`,
  `export function sessionRank(a, b) {
  const left = a && a.updatedAt
  const right = b && b.updatedAt
  // Only a real timestamp may reorder: SessionSummary carries none in this Shell,
  // and the Host's own list order is the display order.
  if (typeof left === 'number' && typeof right === 'number' && left !== right) return right - left
  return 0
}`,
)

// SessionListState is { ids, byId }, not { items }: flatten it before grouping.
src = src.replace(
  `  const sessionList = (sessionState && (sessionState.items || sessionState.sessions)) || []`,
  `  const sessionList = sessionState && sessionState.ids && sessionState.byId
    ? sessionState.ids.map(id => sessionState.byId[id]).filter(Boolean)
    : (sessionState && (sessionState.items || sessionState.sessions)) || []`,
)
fs.writeFileSync(p, src)
console.log('rank patched: ' + src.includes('the Host') )
console.log('list flattened: ' + src.includes('sessionState.ids.map'))
