const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.10.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.10.0]')) {
  c = c.replace('## [0.9.6] - 2026-10-28', `## [0.10.0] - 2026-10-28

### Added

- A filter box in the workspaces header: it narrows workspaces and sessions, opens
  every group it keeps so a match is never hidden, and reports "n of m sessions".
  \`/\` focuses it from anywhere in the app and Escape clears it.
- Pinned sessions are hoisted to the top of their workspace with a marker, and a
  running session shows a dot, so the row reads before you click it.
- Drag and drop: a workspace row dropped on another moves in front of it
  (\`workspaces.insertBefore\`), a session row dropped on a sibling reorders it
  (\`workspaces.insertSessionBefore\`); a session refuses to leave its workspace.
- Keyboard walking: arrow keys move a highlighted row, Enter opens a session or
  folds a workspace, Escape closes the menu, clears the filter, then drops the cursor.
- Row actions appear on hover or on the keyboard cursor instead of always, and a
  header control folds or expands every workspace at once.

### Fixed

- The tree no longer renders every "..." button permanently, which was what made a
  three-row sidebar look like a nine-row one.

## [0.9.6] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version)
