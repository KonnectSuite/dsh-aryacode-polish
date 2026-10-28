const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
lines.forEach((line, at) => { if (/\bhelpCard\b/.test(line)) console.log((at + 1) + ': ' + line.trim().slice(0, 90)) })
