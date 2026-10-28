const fs = require('node:fs')
for (const f of ['client/face.js', 'README.md', 'CHANGELOG.md', 'docs/better-workspace.md', 'entries/registry.js', 'client/switches.json']) {
  const src = fs.readFileSync(f, 'utf8')
  let n = 0
  for (const ch of src) if (ch === '\u00e2' || ch === '\u00c2') n++
  if (n) console.log(f + ': ' + n)
}
