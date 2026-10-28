const fs = require('node:fs')
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-ws-rename')) {
  face = face.replace(`  assert.ok(workspaceSource.includes('planReorder('), 'restoring walks an insertBefore plan')`, `  assert.ok(workspaceSource.includes('planReorder('), 'restoring walks an insertBefore plan')
  assert.ok(workspaceSource.includes("'data-polish-ws-rename': 'open'"), 'the menu can rename a workspace')
  assert.ok(workspaceSource.includes('workspaces.rename('), 'the rename is a Host call')`)
  fs.writeFileSync('test/client-face.spec.mjs', face)
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.13.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.13.1]')) {
  c = c.replace('## [0.13.0] - 2026-10-28', `## [0.13.1] - 2026-10-28

### Added

- **Rename a workspace in place.** The workspace menu opens an input under the search
  box; Enter (or blurring) sends \`workspaces.rename\`, Escape abandons it. Renaming to
  \`Work/Client A\` is also how a workspace joins a folder.

### Fixed

- \`planReorder\` ignores ids the Host no longer has, so a saved order that names a
  deleted workspace cannot shuffle the survivors into the wrong slots.

## [0.13.0] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('0.13.1 ready')
