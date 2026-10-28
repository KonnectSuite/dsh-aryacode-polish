const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const before = s
if (!s.includes("const paint = (patch) => setLook((prev) => withFolderLook(prev, menu.folder, patch))")) {
  throw new Error('paint anchor missing')
}
s = s.replace("const paint = (patch) => setLook((prev) => withFolderLook(prev, menu.folder, patch))", `const paint = (patch) => setLook((prev) => {
        const next = withFolderLook(prev, menu.folder, patch)
        writeAppearance(next)
        return next
      })`)
s = s.replace(`              setLook((prev) => withFolderLook(prev, name, { tone: undefined, glyph: undefined, strong: false }))`, `              setLook((prev) => {
                const next = withFolderLook(prev, name, { tone: undefined, glyph: undefined, strong: false })
                writeAppearance(next)
                return next
              })`)
if (s === before) throw new Error('nothing changed')
fs.writeFileSync(p, s)
console.log('folder look persists now')
