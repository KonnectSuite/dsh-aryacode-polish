const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.27.1'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', log.replace('## [0.27.0] - 2026-10-28', '## [0.27.1] - 2026-10-28\n\nFixed: 0.27.0 double-clicked straight into a rename with the unchanged title. It now opens an inline editor (the workspace navigation service has no rename entry point, so the Host verb `session.rename` does the write).\n\n## [0.27.0] - 2026-10-28'))
console.log('0.27.1')
