const fs = require('node:fs')
const text = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
const lines = text.split('\n')
lines.forEach((line, index) => { if (line.includes('sortRows') || line.includes('SORT_TITLES')) console.log((index + 1) + ': ' + line.trim().slice(0, 110)) })
