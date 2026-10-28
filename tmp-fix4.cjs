const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  `    hooks,
    injected,`,
  `    hooks,
    injected,
    standard,`,
)
src = src.replace(
  `runtime.injectFor(entry, standard)`,
  `runtime.injectFor(entry, runtime.standard)`,
)
fs.writeFileSync(p, src)
console.log('standard stored: ' + src.includes('    standard,'))
console.log('call fixed: ' + src.includes('runtime.injectFor(entry, runtime.standard)'))
