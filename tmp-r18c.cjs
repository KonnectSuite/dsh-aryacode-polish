const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('export function costOf(')) throw new Error('already patched')

const helper = [
  '// A session\'s priced view is written by the Host half of the cost feature',
  '// (`polishCost`). The tree asks the session list for it and hides the number when',
  '// it is missing, so a Shell that never ran the cost feature simply shows nothing.',
  'export function costOf(snapshot, sessionId) {',
  '  if (!snapshot || !snapshot.projectionsBySession) return undefined',
  '  const projection = snapshot.projectionsBySession[sessionId]',
  '  if (!projection || !projection.values) return undefined',
  '  const value = projection.values.polishCost',
  '  if (!value || typeof value !== \'object\') return undefined',
  '  const usd = typeof value.costUsd === \'string\' ? value.costUsd : undefined',
  '  const cny = typeof value.costCny === \'string\' ? value.costCny : undefined',
  '  if (usd === undefined && cny === undefined) return undefined',
  '  return { usd: usd, cny: cny, incomplete: value.incomplete === true }',
  '}',
  '',
  'export function costLabel(cost) {',
  '  if (!cost) return \'\'',
  '  const yen = String.fromCharCode(165)',
  '  const dollar = String.fromCharCode(36)',
  '  const symbol = cost.usd === undefined ? yen : dollar',
  '  const text = cost.usd === undefined ? cost.cny : cost.usd',
  '  const amount = Number(text)',
  '  if (!Number.isFinite(amount)) return \'\'',
  '  const shown = amount >= 1 ? amount.toFixed(2) : amount >= 0.01 ? amount.toFixed(3) : amount.toPrecision(2)',
  '  const approx = cost.incomplete ? String.fromCharCode(126) : String.fromCharCode(8776)',
  '  return approx + symbol + shown',
  '}',
  '',
  '',
].join('\n')

const anchor = 'export function splitPinned(sessions, pinnedIds) {'
if (!src.includes(anchor)) throw new Error('splitPinned anchor missing')
src = src.replace(anchor, helper + anchor)
fs.writeFileSync(p, src)
console.log('cost helpers added')
