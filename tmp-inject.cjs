const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// A seat's own inject() has to run too: our "Open workspace folder" row needs the
// services it declared, which the owner's share does not carry.
src = src.replace(
  `    translate: (ns) => {`,
  `    injectFor: (entry, standard) => {
      const own = entry && typeof entry.inject === 'function' ? entry.inject(standard) : undefined
      return Object.assign({}, injected, own || {})
    },
    translate: (ns) => {`,
)
src = src.replace(
  `  const props = Object.assign({}, session, runtime.injected, runtime.standards(runtime.workspacesSnapshot), { useMenuOpenState })`,
  `  const props = Object.assign({}, session, runtime.injectFor(entry, standard), runtime.standards(runtime.workspacesSnapshot), { useMenuOpenState })`,
)
fs.writeFileSync(p, src)
console.log('injectFor: ' + src.includes('injectFor: (entry, standard)'))
