const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.2'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.9.2]')) {
  c = c.replace('## [0.9.1] - 2026-10-28', `## [0.9.2] - 2026-10-28

### Fixed

- The shipped session menu rows (Pin, Rename, Fork, Archive) now receive the standard
  hooks they call -- \`usePinned\`, \`useArchived\`, \`useSessionAccess\` and \`useShortcuts\` --
  derived from the snapshots this seat already subscribes to, instead of throwing
  \`TypeError: usePinned is not a function\` inside \`usePinState\`.

## [0.9.1] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
