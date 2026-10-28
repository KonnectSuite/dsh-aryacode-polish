const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const from = `  const wanted = Array.isArray(wantedIds) ? wantedIds : []`
const to = `  // Only ids the Host still has can move; a saved order that names a deleted
  // workspace must not shuffle the rest into the wrong slots.
  const wanted = (Array.isArray(wantedIds) ? wantedIds : []).filter((id) => current.indexOf(id) !== -1)`
if (!src.includes(from)) throw new Error('anchor missing')
src = src.replace(from, to)
fs.writeFileSync(p, src)
console.log('planReorder now ignores unknown ids')
