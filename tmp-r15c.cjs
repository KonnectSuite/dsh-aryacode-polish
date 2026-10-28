const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const from = `          const look = lookOf(look, target.workspaceId)
          closeMenu()
          if (!look.tone && !look.glyph && !look.strong) { setNotice('Give this workspace a look first.'); return }
          setPresets((prev) => withPreset(prev, name, look))`
const to = `          const saved = lookOf(look, target.workspaceId)
          closeMenu()
          if (!saved.tone && !saved.glyph && !saved.strong) { setNotice('Give this workspace a look first.'); return }
          setPresets((prev) => withPreset(prev, name, saved))`
if (!src.includes(from)) throw new Error('anchor missing')
src = src.replace(from, to)
fs.writeFileSync(p, src)
console.log('shadowing fixed')
