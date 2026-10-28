const fs = require('node:fs')
let spec = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
spec = spec.replace('  moveBefore,\n  moveTargets,', '  moveBefore,')
const start = spec.indexOf("describe('moveTargets'")
if (start !== -1) spec = spec.slice(0, start).trimEnd() + '\n'
fs.writeFileSync('test/workspace.spec.mjs', spec)

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.11.2'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')

let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.11.2]')) {
  c = c.replace('## [0.11.1] - 2026-10-28', `## [0.11.2] - 2026-10-28

### Fixed

- A session can no longer be promised a move the Host cannot make: the remote
  workspace namespace exposes \`insertBefore\` and \`insertSessionBefore\` but no
  \`attachSession\`/\`detachSession\`, and a workspace's own \`insertSessionBefore\`
  only reorders sessions already inside it, so a cross-workspace drop is refused
  with a plain explanation instead of a call that fails.
- Removed the session menu's "Move to <workspace>" rows for the same reason.

## [0.11.1] - 2026-10-28`)
  fs.writeFileSync('CHANGELOG.md', c)
}
console.log('spec + version ready: ' + pkg.version)
