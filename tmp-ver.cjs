const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.15.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let log = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!log.includes('## [0.15.0]')) {
  const head = '# Changelog\n'
  const index = log.indexOf(head)
  const body = `## [0.15.0] - 2026-10-28

### Added
- **Density modes.** A control in the tree header switches between comfortable and
  compact rows, and the choice is remembered (\`aryacode-polish:density.v1\`). Density
  changes row height only — the text size stays readable.

### Fixed
- **Archived sessions no longer sit in their workspace.** The tree now reads
  \`archivedSessionIds\` (it never did) and shows those sessions in a collapsed
  **Archived** section at the bottom, each one restorable from its own menu.
`
  log = log.slice(0, index + head.length) + '\n' + body + log.slice(index + head.length)
  fs.writeFileSync('CHANGELOG.md', log)
}
console.log('version 0.15.0 + changelog')
