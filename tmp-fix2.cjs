const fs = require('node:fs')
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
face = face.replace(`const read = path => readFileSync(new URL(path, root), 'utf8')`,
`const read = path => readFileSync(new URL(path, root), 'utf8')
const workspaceSource = read('../client/workspace.js')`)
fs.writeFileSync('test/client-face.spec.mjs', face)

let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.12.0]')) {
  c = c.replace('## [0.11.2] - 2026-10-28', `## [0.12.0] - 2026-10-28

### Added

- **Colour and weight per workspace.** Right-click a workspace → "Colour and
  weight…" paints it one of six tones (slate, blue, green, amber, rose, violet) or
  none, and can make its label bold. The choice is stored under
  \`aryacode-polish:workspace-appearance\` in the app's own storage, so it survives a
  restart, and a broken or missing store degrades to the plain tree instead of
  throwing.
- **The same workspaces in the Hero picker.** The blank-session Hero now offers this
  bundle's workspace list (tone dots, bold labels, session counts) instead of the
  stock picker, through \`conversation.hero.workspace\` at priority -1 — same data,
  same colours, one switch.

## [0.11.2] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('fixed')
