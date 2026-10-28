const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
const before = "assert.deepEqual(highlightParts('Build the thing', 'THE'), { before: 'Build ', hit: 'THE', after: ' thing' })"
const after = "assert.deepEqual(highlightParts('Build the thing', 'THE'), { before: 'Build ', hit: 'the', after: ' thing' }, 'the match keeps the text casing, not the query casing')"
if (!s.includes(before)) throw new Error('anchor missing')
fs.writeFileSync(p, s.replace(before, after))
console.log('expectation corrected')
