const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. sum helpers after costLabel
const anchor = `export function splitPinned(sessions, pinnedIds) {`
if (!src.includes(anchor)) throw new Error('splitPinned anchor missing')
const helpers = [
  'export function sumCost(sessions, snapshot) {',
  '  let usd = 0',
  '  let cny = 0',
  '  let anyUsd = false',
  '  let anyCny = false',
  '  let incomplete = false',
  '  for (const row of sessions || []) {',
  '    const cost = costOf(snapshot, row && row.id)',
  '    if (!cost) continue',
  '    if (cost.incomplete) incomplete = true',
  '    if (cost.usd !== undefined) { anyUsd = true; usd += Number(cost.usd) || 0 }',
  '    if (cost.cny !== undefined) { anyCny = true; cny += Number(cost.cny) || 0 }',
  '  }',
  '  if (!anyUsd && !anyCny) return undefined',
  '  return {',
  '    usd: anyUsd ? usd.toFixed(8) : undefined,',
  '    cny: anyCny ? cny.toFixed(8) : undefined,',
  '    incomplete,',
  '  }',
  '}',
  '',
  '/** What a group of sessions costs together, as a short label, or an empty string. */',
  'export function sumCostLabel(sessions, snapshot) {',
  '  const total = sumCost(sessions, snapshot)',
  '  return total ? costLabel(total) : String.fromCharCode(0) && \'\'',
  '}',
  '',
  '/** The folder header shows the same total for everything filed under it. */',
  'export function folderCostNode(inside, snapshot, folder) {',
  '  const sessions = (inside || []).reduce((all, entry) => all.concat(entry.sessions), [])',
  '  const label = sumCostLabel(sessions, snapshot)',
  '  if (!label) return null',
  '  return React.createElement(\'span\', {',
  '    \'data-polish-ws-folder-cost\': folder,',
  '    style: Object.assign({}, WS_COST, { marginLeft: \'6px\' }),',
  '  }, label)',
  '}',
  '',
]
src = src.replace(anchor, helpers.join('\n') + anchor)

// 2. the workspace row gains its total
const rowAnchor = `    const looks = appearanceOf(look, workspace.workspaceId)`
if (!src.includes(rowAnchor)) throw new Error('row anchor missing')
src = src.replace(rowAnchor, rowAnchor + `\n    const rowCost = sumCostLabel(sessions, sessionState)`)

const countAnchor = `    React.createElement('span', { style: WS_COUNT }, String(sessions.length)),`
if (!src.includes(countAnchor)) throw new Error('count anchor missing')
src = src.replace(countAnchor, countAnchor + `
    rowCost
      ? React.createElement('span', { 'data-polish-ws-cost-total': workspace.workspaceId, style: Object.assign({}, WS_COST, { marginLeft: '6px' }) }, rowCost)
      : null,`)

// 3. the folder header gains the same total
const folderAnchor = `String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0))`
if (!src.includes(folderAnchor)) throw new Error('folder anchor missing')
src = src.replace(folderAnchor, `[String(inside.reduce((sum, entry) => sum + entry.sessions.length, 0)), folderCostNode(inside, sessionState, folder)]`)

// 4. repair the folder rename glyph that a PowerShell patch mojibaked
src = src.replace(/'âœŽ'/g, `'\\u270E'`)

fs.writeFileSync(p, src)
console.log('per-workspace and per-folder cost totals wired')
