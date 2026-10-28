const fs = require('node:fs')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.12.1]')) {
  c = c.replace('## [0.12.0] - 2026-10-28', `## [0.12.1] - 2026-10-28

### Fixed

- The Hero list now only appears when the workspace chip is open, and it paints a
  card of its own instead of an unstyled list floating over the Hero copy.

## [0.12.0] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('changelog 0.12.1')
