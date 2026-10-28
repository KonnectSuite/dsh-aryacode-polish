const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.11.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.11.1]')) {
  c = c.replace('## [0.11.0] - 2026-10-28', `## [0.11.1] - 2026-10-28

### Fixed

- The session menu offered the workspace the session already sat in as a destination,
  so "Move to <current workspace>" reported a move that never happened. The list now
  excludes it, and the move reads the session's real workspace id.

## [0.11.0] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
