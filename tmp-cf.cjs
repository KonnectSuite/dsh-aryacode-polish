const fs = require('node:fs')
const text = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
const lines = text.split('\n')
lines.forEach((line, index) => { if (line.includes('Most spent first') || line.includes('SORT') || line.includes('sortRows')) console.log((index + 1) + ': ' + line.trim().slice(0, 120)) })
