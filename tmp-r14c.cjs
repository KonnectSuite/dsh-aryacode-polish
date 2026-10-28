const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('data-polish-ws-new-session')) {
  s += `
test('a row can start a session in its workspace and pin a session in one click', () => {
  for (const marker of ['data-polish-ws-new-session', 'data-polish-session-pin', 'startSession(', 'unpinSession(']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
  fs.writeFileSync(p, s)
  console.log('face test added')
} else console.log('already')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.22.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const c = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', c.replace('## [0.22.0] - 2026-10-28', '## [0.22.1] - 2026-10-28\n\nFixed: the hover actions shipped in 0.22.0 without their face spec, so the guard that keeps them in the bundle was missing.\n\n## [0.22.0] - 2026-10-28'))
console.log('bumped to 0.22.1')
