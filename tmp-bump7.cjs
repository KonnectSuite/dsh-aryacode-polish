const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.11.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.11.0]')) {
  c = c.replace('## [0.10.0] - 2026-10-28', `## [0.11.0] - 2026-10-28

### Added

- A session can move between workspaces: drop it on another workspace, or drop it on a
  session there, and it joins that workspace (\`workspaces.insertSessionBefore\`). The
  session menu offers the same move as "Move to <workspace>" for each other workspace.

### Changed

- Dropping a session onto a workspace of its own still reorders it; dropping it onto a
  different workspace no longer refuses with a notice.
- \`docs/better-workspace.md\` records why the earlier "a session stays put" rule was
  wrong: the Host's insertSessionBefore is exactly the verb that reassigns a session.

## [0.10.0] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
