const fs = require('node:fs')
const p = 'docs/better-workspace.md'
let doc = fs.readFileSync(p, 'utf8')
if (doc.includes('## Look presets')) { console.log('docs already'); process.exit(0) }
doc += `
## Look presets

A look is tone + weight + glyph. **Save this look as a preset** stores that trio under the
workspace's name in \`aryacode-polish:workspace-presets.v1\`, and every preset then appears in every
workspace menu as \`Apply: <name>\` with a small \`×\` to forget it. Notes are deliberately not part of
a preset: a note is about one workspace, a look is about a kind of work.

Saving is refused when the workspace has no look yet ("Give this workspace a look first."), which is
the honest answer rather than storing an empty preset nothing would visibly change.
`
fs.writeFileSync(p, doc)
console.log('docs updated')
