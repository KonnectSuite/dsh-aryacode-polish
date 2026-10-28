const fs = require('node:fs')
const s = fs.readFileSync('client/workspace.js', 'utf8')
const lines = s.split('\n')
lines.forEach((line, index) => {
  if (line.includes('writeAppearance(') || line.includes('writeAppearance)') || line.includes('LOOK_KEY')) {
    console.log((index + 1) + ': ' + line.trim())
  }
})
const i = s.indexOf('const [look, setLook]')
console.log('--- state ---')
console.log(s.slice(i - 200, i + 700))
