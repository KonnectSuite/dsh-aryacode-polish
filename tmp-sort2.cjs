const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const start = lines.findIndex((line) => line.includes('export function sortRows'))
console.log(lines.slice(start, start + 34).join('\n'))
