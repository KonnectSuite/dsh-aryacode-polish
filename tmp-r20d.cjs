const fs = require('node:fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.28.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
const entry = `## [0.28.0] - 2026-10-28

Added: a workspace row and a folder header now show the running total their sessions have cost, from
the same \`polishCost\` projection the composer pill uses (\`sumCost\`, \`sumCostLabel\`,
\`folderCostNode\`). Nothing priced renders nothing, and a group priced only in CNY shows \u00a5.

Fixed: the folder rename glyph had been mojibaked (\`\u00e2\u0153\u017d\`) by an earlier PowerShell patch; it is
\u270e again.
`
fs.writeFileSync('CHANGELOG.md', entry + '\n' + log)
console.log('0.28.0')
