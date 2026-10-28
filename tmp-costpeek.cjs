const fs = require('node:fs')
let s = fs.readFileSync('client/workspace.js', 'utf8')

// 1. full priced detail + a token roll-up for a group of sessions
const anchor = "/** What a group of sessions costs together, as a short label, or an empty string. */"
if (!s.includes(anchor)) throw new Error('sumCost tail anchor missing')
s = s.replace(anchor, `/** Everything the cost projection knows about one session, or undefined. */
export function costDetail(snapshot, sessionId) {
  if (!snapshot || !snapshot.projectionsBySession) return undefined
  const projection = snapshot.projectionsBySession[sessionId]
  const value = projection && projection.values && projection.values.polishCost
  if (!value || typeof value !== 'object') return undefined
  const count = (field) => (typeof value[field] === 'number' && Number.isFinite(value[field]) ? value[field] : 0)
  const usd = typeof value.costUsd === 'string' ? value.costUsd : undefined
  const cny = typeof value.costCny === 'string' ? value.costCny : undefined
  if (usd === undefined && cny === undefined && count('tokens') === 0) return undefined
  return {
    cacheRead: count('cacheRead'),
    uncached: count('uncached'),
    cacheWrite: count('cacheWrite'),
    output: count('output'),
    requests: count('requests'),
    tokens: count('tokens'),
    usd,
    cny,
    incomplete: value.incomplete === true,
    models: Array.isArray(value.models) ? value.models.length : 0,
  }
}

/**
 * What a group of sessions spent in tokens, so a total on a row can be opened and explained.
 * The cache-hit share is computed from the billed buckets only, the same way the host prices them.
 */
export function sumTokens(sessions, snapshot) {
  const totals = { cacheRead: 0, uncached: 0, cacheWrite: 0, output: 0, requests: 0, tokens: 0, priced: 0, models: 0 }
  for (const row of sessions || []) {
    const detail = costDetail(snapshot, row && row.id)
    if (!detail) continue
    totals.priced += 1
    totals.models += detail.models
    totals.cacheRead += detail.cacheRead
    totals.uncached += detail.uncached
    totals.cacheWrite += detail.cacheWrite
    totals.output += detail.output
    totals.requests += detail.requests
    totals.tokens += detail.tokens
  }
  const billed = totals.uncached + totals.cacheRead + totals.cacheWrite + totals.output
  totals.billed = billed
  totals.hit = billed > 0 ? Math.round((totals.cacheRead / billed) * 100) : 0
  return totals
}

${anchor}`)

// 2. the total on a row becomes the door to its breakdown
const span = "      ? React.createElement('span', { 'data-polish-ws-cost-total': workspace.workspaceId, style: Object.assign({}, WS_COST, { marginLeft: '6px' }) }, rowCost)"
if (!s.includes(span)) throw new Error('cost span anchor missing')
s = s.replace(span, `      ? React.createElement('button', {
        type: 'button',
        'data-polish-ws-cost-total': workspace.workspaceId,
        'data-polish-ws-cost-open': workspace.workspaceId,
        title: 'Show what this workspace has cost',
        style: Object.assign({}, WS_COST, { marginLeft: '6px', border: 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', padding: 0 }),
        onClick: (event) => {
          event.stopPropagation()
          setCostPeek({ workspaceId: workspace.workspaceId, label: workspaceLabel(workspace) })
        },
      }, rowCost)`)

fs.writeFileSync('client/workspace.js', s)
console.log('detail helpers and the cost door are in')
