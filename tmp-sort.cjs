const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
const start = lines.findIndex((line) => line.includes('export const SORTS'))
console.log(lines.slice(start - 2, start + 40).join('\n'))
