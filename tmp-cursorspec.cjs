const fs = require('node:fs')
const f = 'test/client-face.spec.mjs'
let s = fs.readFileSync(f, 'utf8')
if (s.includes("'data-polish-cursor': focused")) { console.log('spec already'); process.exit(0) }
const anchor = "  assert.match(workspaceSource, /event\\.key === 'Home'"
if (!s.includes(anchor)) throw new Error('anchor missing')
s = s.replace(anchor, `  // A session row is focused by its walk index; a workspace row has its own flag. Mixing the two
  // threw "rowFocused is not defined" inside the seat and blanked the whole tree.
  assert.match(workspaceSource, /'data-polish-cursor': rowFocused \\? 'true' : undefined/)
  assert.match(workspaceSource, /'data-polish-cursor': focused \\? 'true' : undefined/)
${anchor}`)
fs.writeFileSync(f, s)
console.log('cursor pairing spec added')
