const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.29.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', `## [0.29.0] - 2026-10-28

Added: every folder header has its own \`+\` that opens the add-workspace flow and files the newly
created workspace inside that folder (\`fileUnder\`), so a folder can grow without a rename afterwards.
Shift+F10 (or the keyboard's menu key) on a focused row now opens the same menu the right-click
opens, for workspaces and sessions alike.
` + '\n' + log)
console.log('0.29.0')
