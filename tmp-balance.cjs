const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const bad = "      : null)\n  })\n\n  return React.createElement('div', {"
const good = "      : null))\n\n  return React.createElement('div', {"
if (!src.includes(bad)) { console.log('anchor missing'); process.exit(1) }
src = src.replace(bad, good)
// the pinned glyph was mangled by the encoding round-trip; rebuild it from its code point
src = src.replace(/'â˜…'/g, "'\u2605'")
fs.writeFileSync(p, src)
console.log('balanced: ' + src.includes(good))
console.log('stars: ' + (src.match(/\u2605/g) || []).length)
