const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const fixes = [
  ["style: WS_HEADER_BUTTON,", "style: WS_ADD,"],
  ["sortOf(sort) === 'name' ? 'A\u00e2\u2020\u2019Z' : '\u00e2\u2020\u2022'", "sortOf(sort) === 'name' ? 'A\\u2192Z' : '\\u2195'"],
  ["hit.kind === 'workspace' ? '\u00e2\u0152\u201a ' + hit.title : hit.title", "hit.kind === 'workspace' ? '\\u2302 ' + hit.title : hit.title"],
]
for (const [from, to] of fixes) {
  if (src.includes(from)) { src = src.split(from).join(to); console.log('fixed:', from.slice(0, 40)) }
}
fs.writeFileSync(p, src)
const bad = /[\u00c2\u00c3\u00e2][\u0080-\u00bf\u201a-\u2039\u0152\u2122\u0160\u2039]/
const lines = src.split('\n')
const hits = lines.map((l, i) => [i + 1, l]).filter(([, l]) => bad.test(l))
console.log('mojibake lines left:', hits.length)
hits.slice(0, 5).forEach(([n, l]) => console.log(n + ': ' + l.trim().slice(0, 90)))
