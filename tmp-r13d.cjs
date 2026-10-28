const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (!src.includes('const sessions = metrics.sessions ? group.sessions : []')) throw new Error('anchor A missing')
src = src.replace('const sessions = metrics.sessions ? group.sessions : []', 'const sessions = group.sessions')
if (!src.includes('      sessions.forEach((row) => {')) throw new Error('anchor B missing')
src = src.replace('      sessions.forEach((row) => {', '      (metrics.sessions ? sessions : []).forEach((row) => {')
fs.writeFileSync(p, src)
console.log('fix applied')
