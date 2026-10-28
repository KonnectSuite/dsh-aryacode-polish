const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (!/^\s*SORT_TITLES,$/m.test(s)) {
  s = s.replace("  sortRows,\n  sortOf,", "  sortRows,\n  sortOf,\n  SORTS,\n  SORT_TITLES,")
  fs.writeFileSync(p, s)
  console.log('imports added')
} else console.log('already imported')
