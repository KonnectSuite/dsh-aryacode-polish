const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

if (!src.includes('const WS_COST = {')) {
  const styleAnchor = 'const WS_COUNT_NOTE = {'
  src = src.replace(styleAnchor, "const WS_COST = { flex: 'none', marginLeft: '6px', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)', fontVariantNumeric: 'tabular-nums' }\n" + styleAnchor)
}

const fnAnchor = 'const sessionRow = (workspace, row, groupIndex) => {'
if (!src.includes(fnAnchor)) throw new Error('sessionRow anchor missing')
if (!src.includes('const sessionCost = costLabel')) {
  src = src.replace(fnAnchor, fnAnchor + "\n    const sessionCost = costLabel(costOf(sessionState, row.id))")
}

const titleEnd = '    }, row.displayTitle || row.id),'
if (!src.includes(titleEnd)) throw new Error('title anchor missing')
if (!src.includes("'data-polish-ws-cost'")) {
  src = src.replace(titleEnd, titleEnd + "\n    sessionCost\n      ? React.createElement('span', { 'data-polish-ws-cost': row.id, style: WS_COST }, sessionCost)\n      : null,")
}

src = src.replace("'\u00e2\u0161\u2018'", "'\\u2691'")
fs.writeFileSync(p, src)
console.log('row cost wired')
