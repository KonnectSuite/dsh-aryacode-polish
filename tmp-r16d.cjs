const fs = require('node:fs')
const src = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
src.forEach((line, index) => {
  if (line.includes('sortOf(sort) === ') || line.includes("hit.kind === 'workspace' ?")) {
    console.log((index + 1) + ': ' + JSON.stringify(line.trim()))
  }
})
