const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const start = s.indexOf('  if (rows.length === 0 && allRows.length === 0 && !query.trim()) {')
const end = s.indexOf("  children.push(React.createElement('div', {\n    key: 'header',", start)
if (start < 0 || end < 0) throw new Error('empty block bounds not found')
s = s.slice(0, start) + s.slice(end)
// the style constant is now unused
s = s.replace(`const WS_EMPTY_ADD = Object.assign({}, WS_MENU_ITEM, {
  alignSelf: 'flex-start',
  marginTop: '2px',
})

`, '')
// and the debug attribute goes too
s = s.replace("    'data-polish-debug': String(rows.length) + '/' + String(allRows.length),\n", '')
fs.writeFileSync(p, s)
console.log('empty state and debug attribute removed')

const f = 'test/client-face.spec.mjs'
let face = fs.readFileSync(f, 'utf8')
face = face.replace("  assert.match(workspaceSource, /'data-polish-ws-empty-tree'/)\n", '')
face = face.replace("  assert.match(workspaceSource, /treeDefaults\\(\\)/)\n", "  assert.match(workspaceSource, /treeDefaults\\(\\)/)\n")
fs.writeFileSync(f, face)

let c = fs.readFileSync('CHANGELOG.md', 'utf8')
c = c.replace(`- An empty tree now says "No workspaces yet." and offers the same add flow, instead of rendering a
  header over nothing.
`, '')
fs.writeFileSync('CHANGELOG.md', c)
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
d = d.replace(`An empty tree now says "No workspaces yet." and offers the same add flow`, '')
fs.writeFileSync('docs/better-workspace.md', d)
console.log('specs, changelog and docs trimmed')
