const fs = require('node:fs')
let s = fs.readFileSync('client/workspace.js', 'utf8')
const broken = "      }, 'Close'),\n      ),\n      document.body)"
if (!s.includes(broken)) throw new Error('tail anchor missing')
s = s.replace(broken, "      }, 'Close'),\n      ),\n      ),\n      document.body)")
fs.writeFileSync('client/workspace.js', s)
console.log('closed the backdrop element')
