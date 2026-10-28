const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.5'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.9.5]')) {
  c = c.replace('## [0.9.4] - 2026-10-28', `## [0.9.5] - 2026-10-28

### Added

- Better workspace carries the add control the stock browser had: a header with a
  "+" that opens this bundle's own source menu (On this PC or a GitHub repository)
  and adds the chosen folder as a workspace.
- The default workspace no longer shows its raw id: an empty Host \`title\` is
  humanised ("default-workspace" reads "Default workspace").

## [0.9.4] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
