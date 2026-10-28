const fs = require('node:fs')
const p = 'client/workspace.js'
const lines = fs.readFileSync(p, 'utf8').split('\n')
const start = lines.findIndex(l => l.startsWith('export function costLabel(cost) {'))
if (start < 0) throw new Error('costLabel start missing')
let end = start
while (end < lines.length && lines[end] !== '}') end += 1
if (end >= lines.length) throw new Error('costLabel end missing')
const body = [
  'export function costLabel(cost) {',
  '  if (!cost) return \'\'',
  '  const yen = String.fromCharCode(165)',
  '  const dollar = String.fromCharCode(36)',
  '  const usd = cost.usd',
  '  const symbol = usd === undefined ? yen : dollar',
  '  const text = usd === undefined ? cost.cny : usd',
  '  const amount = Number(text)',
  '  if (!Number.isFinite(amount)) return \'\'',
  '  const shown = amount >= 1 ? amount.toFixed(2) : amount >= 0.01 ? amount.toFixed(3) : amount.toPrecision(2)',
  '  const approx = cost.incomplete ? String.fromCharCode(126) : String.fromCharCode(8776)',
  '  return approx + symbol + shown',
  '}',
]
lines.splice(start, end - start + 1, ...body)
fs.writeFileSync(p, lines.join('\n'))
console.log('costLabel repaired')
