const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('export function costOf(')) throw new Error('already patched')

const anchor = 'export function splitPinned(sessions, pinnedIds) {'
const helper = `// A session's priced view is written by the Host half of the cost feature
// (\`polishCost\`). The tree asks the session list for it and hides the number when it
// is missing, so a Shell that never ran the cost feature simply shows nothing.
export function costOf(snapshot, sessionId) {
  if (!snapshot || !snapshot.projectionsBySession) return undefined
  const projection = snapshot.projectionsBySession[sessionId]
  if (!projection || !projection.values) return undefined
  const value = projection.values.polishCost
  if (!value || typeof value !== 'object') return undefined
  const usd = typeof value.costUsd === 'string' ? value.costUsd : undefined
  const cny = typeof value.costCny === 'string' ? value.costCny : undefined
  if (usd === undefined && cny === undefined) return undefined
  return { usd, cny, incomplete: value.incomplete === true }
}

export function costLabel(cost) {
  if (!cost) return ''
  const raw = cost.usd
  const symbol = raw === undefined ? '\\u00a5' : '$'
  const text = raw === undefined ? cost.cny : raw
  const amount = Number(text)
  if (!Number.isFinite(amount)) return ''
  const shown = amount >= 1 ? amount.toFixed(2) : amount >= 0.01 ? amount.toFixed(3) : amount.toPrecision(2)
  return (cost.incomplete ? '~' : '\\u2248') + symbol + shown
}

`
src = src.replace(anchor, helper + anchor)

// row rendering: append a dim cost note when the value exists
const rowAnchor = `        React.createElement('span', { style: WS_COUNT_NOTE }, group ? workspaceLabel(group) : '')))`
if (!src.includes(rowAnchor)) throw new Error('pinned row anchor missing')

fs.writeFileSync(p, src)
console.log('cost helpers added')
