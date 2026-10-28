const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
lines.forEach((line, at) => {
  if (/\brows\b\s*[=,)]/.test(line) && /const|let|=>|\brows,/.test(line)) {
    if (at > 1300 && at < 2400) console.log((at + 1) + ': ' + line.trim().slice(0, 110))
  }
})
console.log('--- pinned/pinOpen region ---')
lines.forEach((line, at) => { if (/pinnedSessions =|const pinned =/.test(line) && at > 1300 && at < 2400) console.log((at + 1) + ': ' + line.trim().slice(0, 110)) })
