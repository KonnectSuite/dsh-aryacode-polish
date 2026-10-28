const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(p, 'utf8')
spec = spec.replace(
  "import {\n  menuRuntime,",
  "import {\n  filterTree,\n  flattenRows,\n  moveBefore,\n  menuRuntime,",
)
spec = spec.replace(
  "  rowMenuEntries,",
  "  rowMenuEntries,\n  workspaceLabel,",
)
fs.writeFileSync(p, spec)
console.log(spec.split('\n').slice(3, 14).join('\n'))
