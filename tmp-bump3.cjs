const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.3'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.9.3]')) {
  c = c.replace('## [0.9.2] - 2026-10-28', `## [0.9.3] - 2026-10-28

### Fixed

- Each menu seat's own \`inject()\` runs before its occupant renders, so this bundle's
  "Open workspace folder" row is back beside the shipped rows instead of silently
  rendering nothing for want of the services it declared.

## [0.9.2] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
