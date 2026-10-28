const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Glyphs and notes')) { console.log('docs already updated'); process.exit(0) }
doc += `
## Glyphs and notes

A workspace can wear an emoji badge instead of the folder icon (**Glyph…** in its menu, ten
badges plus a clear button) and carry a short note (**Note…**, Enter saves, Escape cancels).
Both live in the same appearance record as the colour — one localStorage key, one shape —
and the note surfaces as the row's tooltip, so it costs no vertical space in the tree.

Glyph validation is deliberately narrow (one to four characters): the field is a badge in a
16 px slot, not a place to paste a sentence.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
