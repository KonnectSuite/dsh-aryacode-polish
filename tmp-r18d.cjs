const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. repair mojibake glyphs that PowerShell wrote before the escape rule existed
const map = { '\u00e2\u0161\u2018': '\u2691', '\u00e2\u0153\u2026': '\u2705' }
let repaired = 0
for (const [bad, good] of Object.entries(map)) {
  if (src.includes(bad)) { src = src.split(bad).join(good); repaired += 1 }
}
// the flag literal specifically
src = src.replace("'\u00e2\u0161\u2018'", "'\\u2691'")

// 2. cost style
if (!src.includes('const WS_COST = {')) {
  const styleAnchor = 'const WS_COUNT_NOTE = {'
  if (!src.includes(styleAnchor)) throw new Error('style anchor missing')
  src = src.replace(styleAnchor, "const WS_COST = { flex: 'none', marginLeft: '6px', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)', fontVariantNumeric: 'tabular-nums' }\n" + styleAnchor)
}

// 3. row: compute the label once and show it after the title
const fnAnchor = 'function sessionRow(workspace, row, groupIndex) {'
if (!src.includes(fnAnchor)) throw new Error('sessionRow anchor missing')
src = src.replace(fnAnchor, fnAnchor + "\n    const sessionCost = costLabel(costOf(sessionState, row.id))")

const titleEnd = '    }, row.displayTitle || row.id),'
if (!src.includes(titleEnd)) throw new Error('title anchor missing')
src = src.replace(titleEnd, titleEnd + `
    sessionCost
      ? React.createElement('span', { 'data-polish-ws-cost': row.id, style: WS_COST }, sessionCost)
      : null,`)

fs.writeFileSync(p, src)
console.log('row cost wired, glyph repairs:', repaired)
