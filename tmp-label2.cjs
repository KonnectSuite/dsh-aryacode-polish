const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  `  const title = workspace && typeof workspace.title === 'string' ? workspace.title.trim() : ''
  if (title) return title
  const id = String((workspace && workspace.workspaceId) || '')`,
  `  const title = workspace && typeof workspace.title === 'string' ? workspace.title.trim() : ''
  const id = String((workspace && workspace.workspaceId) || '')
  // The Host sets the default workspace's title to its own id, so a title that
  // merely repeats the id is not a name a reader wants to see.
  if (title && title !== id) return title`,
)
fs.writeFileSync(p, src)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.9.6'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.9.6]')) {
  c = c.replace('## [0.9.5] - 2026-10-28', `## [0.9.6] - 2026-10-28

### Fixed

- A workspace whose Host title merely repeats its id is humanised, because that is
  what the default workspace's title is.

## [0.9.5] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('version ' + pkg.version + ' label fixed: ' + src.includes('merely repeats the id'))
