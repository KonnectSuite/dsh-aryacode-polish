const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
const bad = `  workspaceRows,  densityOf,
  readDensity,
  writeDensity,
  splitArchived,
  appearanceOf,
  withAppearance,
  GLYPHS,

} from '../client/workspace.js'`
const good = `  workspaceRows,
  densityOf,
  readDensity,
  writeDensity,
  splitArchived,
  GLYPHS,
} from '../client/workspace.js'`
if (!src.includes(bad)) throw new Error('anchor not found')
src = src.replace(bad, good)
fs.writeFileSync(p, src)
console.log('imports fixed')
