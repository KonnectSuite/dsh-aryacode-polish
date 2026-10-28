const fs = require('node:fs')
const p = 'test/client-face.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('data-polish-preset-apply')) {
  s += `
test('a look can be saved as a preset and applied elsewhere', () => {
  for (const marker of ['data-polish-preset-apply', 'data-polish-preset-forget', 'withPreset(', 'aryacode-polish:workspace-presets']) {
    assert.ok(bundle.includes(marker), 'bundle is missing ' + marker)
  }
})
`
  fs.writeFileSync(p, s)
  console.log('face test added')
}
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.23.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', log.replace('## [0.23.0] - 2026-10-28', '## [0.23.1] - 2026-10-28\n\nFixed: 0.23.0 shipped the preset menu without its face spec, so nothing in the tests kept it in the bundle.\n\n## [0.23.0] - 2026-10-28'))
console.log('0.23.1')
