const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.4'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.9.4]')) {
  c = c.replace('## [0.9.3] - 2026-10-28', `## [0.9.4] - 2026-10-28

### Fixed

- The seat's \`inject()\` is called with the standard props the runtime captured, so the
  menu renders again after 0.9.3 referenced a name that only lived in the factory.

## [0.9.3] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
