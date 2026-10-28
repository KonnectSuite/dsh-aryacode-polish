const fs = require('node:fs')
const bump = JSON.parse(fs.readFileSync('package.json', 'utf8'))
bump.version = '0.37.0'
fs.writeFileSync('package.json', JSON.stringify(bump, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
const head = '## [0.36.0]'
if (!c.includes(head)) throw new Error('changelog anchor missing')
c = c.replace(head, `## [0.37.0] - 2026-10-28

### Added

- Ctrl-K is a palette, not only a jumper: every workspace contributes a "New session in <workspace>"
  action, so the same box that finds work can start it. Actions are marked with a caret and their
  hint reads \`action\`.

${head}`)
fs.writeFileSync('CHANGELOG.md', c)
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('## The palette can act')) {
  d += `
## The palette can act

Ctrl-K started as a jumper: type a title, press Enter, you are there. It carries one more kind of hit
now — \`New session in <workspace>\` for every workspace — so the same box that finds work can start
it. The rule is deliberate: jumping hits come first (that is what the muscle memory expects), actions
follow, and every row says which it is in the hint on the right.
`
  fs.writeFileSync('docs/better-workspace.md', d)
}
console.log('0.37.0 prepared')
