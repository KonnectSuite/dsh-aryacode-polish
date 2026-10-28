const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const flagLine = src.split('\n').find(l => l.includes('Flagged'))
console.log('flag line: ' + JSON.stringify(flagLine && flagLine.trim()))
const bad = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /[\u00e2\u00c2\u00c3][\u0080-\u00ff\u0152\u0153\u0160\u0161\u017d\u017e\u0192\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/.test(l))
console.log('mojibake lines: ' + bad.length)
bad.slice(0, 6).forEach(([n, l]) => console.log(n + ': ' + l.trim().slice(0, 100)))
