const fs = require('node:fs')
const src = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const bad = /[\u00c2\u00c3\u00e2][\u0080-\u00bf\u201a-\u2039\u0152\u2122\u0160\u2039\u0153\u201d\u2019\u20ac]/
src.forEach((line, index) => { if (bad.test(line)) console.log((index + 1) + ': ' + JSON.stringify(line.trim())) })
