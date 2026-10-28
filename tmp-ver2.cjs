const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.15.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let log = fs.readFileSync('CHANGELOG.md', 'utf8')
log = log.replace('## [0.15.0] - 2026-10-28', '## [0.15.1] - 2026-10-28')
log = log.replace(`- **Archived sessions no longer sit in their workspace.**`, `- **Expand all now expands folders too.** The header button only flipped workspace rows, so a
  folded folder kept its workspaces hidden while the button claimed everything was open.
- **Archived sessions no longer sit in their workspace.**`)
fs.writeFileSync('CHANGELOG.md', log)
console.log('version 0.15.1')
