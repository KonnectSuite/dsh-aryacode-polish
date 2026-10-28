const fs = require('node:fs')
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes('data-polish-cost-peek')) {
  face = face.replace("  assert.match(workspaceSource, /sortRows\\(allRows, sort, \\(group\\)/)", "  assert.match(workspaceSource, /sortRows\\(allRows, sort, \\(group\\)/)\n  assert.match(workspaceSource, /'data-polish-ws-cost-open'/)\n  assert.match(workspaceSource, /'data-polish-cost-peek': 'open'/)")
  fs.writeFileSync('test/client-face.spec.mjs', face)
  console.log('face assertions added')
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.40.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!c.includes('## [0.40.0]')) {
  c = c.replace('## [0.39.0]', `## [0.40.0] - 2026-10-28

- A workspace's cost total is now a door: clicking it opens the breakdown behind the number — cache hit
  share, uncached, cached and written tokens, output, requests, how many sessions were priced, and the
  same "your provider's bill is authoritative" line the composer card carries.
- The card reads the same projection the total was summed from, so the two can never disagree.

## [0.39.0]`)
  fs.writeFileSync('CHANGELOG.md', c)
  console.log('changelog updated')
}
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('### Opening a total')) {
  d = d.replace('### Sort by spend', `### Opening a total

The cost on a workspace row is a button. It opens a small card with the buckets behind the total —
cache-hit share, uncached input, cached input, cache write, output, requests, and how many sessions were
priced — so a number that looks wrong can be checked instead of argued with. The card is built from the
same projection the total is summed from.

### Sort by spend`)
  fs.writeFileSync('docs/better-workspace.md', d)
  console.log('docs updated')
}
