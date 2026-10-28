const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  `  assert.ok(
    !bundle.includes('onContextMenu'),
    'the workspace row is not hijacked: a plugin cannot own that menu without a shell change',
  )`,
  `  // A plugin may not reach into a Shell-rendered row, so the menu row stays a menu
  // row. The right-click menu lives on the rows Better workspace renders itself,
  // inside the surface it replaced - that is the sanctioned route.
  assert.ok(
    !bundle.includes('data-row-key'),
    'no private row attribute is patched: a release would erase that',
  )
  assert.ok(
    bundle.includes('onContextMenu'),
    'the replaced surface owns its own rows, so their menus are ours to draw',
  )`,
)
fs.writeFileSync(p, src)
console.log('updated: ' + src.includes('no private row attribute is patched'))
