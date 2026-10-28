const fs = require('node:fs')
const j = JSON.parse(fs.readFileSync('package.json', 'utf8'))
j.version = '0.38.0'
fs.writeFileSync('package.json', JSON.stringify(j, null, 2) + '\n')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
const head = '## [0.37.0]'
if (!c.includes(head)) throw new Error('changelog anchor missing')
c = c.replace(head, `## [0.38.0] - 2026-10-28

### Added

- Right-click the WORKS PACES header for a menu that names the whole surface: copy the tree, fold or
  expand everything, pick a density, pick a sort order, reset the view, or open the shortcut sheet —
  the icons are no longer the only way in.
- An empty tree now says "No workspaces yet." and offers the same add flow, instead of rendering a
  header over nothing.

${head}`)
fs.writeFileSync('CHANGELOG.md', c)
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('## The header menu')) {
  d += `
## The header menu

The header carries five small glyphs, and small glyphs are a poor inventory of what a panel can do.
Right-clicking the header opens the same actions spelled out — copy the tree, fold or expand
everything, the three densities, the two sort orders, "Reset the tree" (which returns to
\`treeDefaults()\`: no filter, nothing folded, comfortable rows, host order) and the shortcut sheet.
The menu is generated from the same lists the icons use (\`DENSITIES\`, \`SORTS\`), so a new density
appears in both places at once.
`
}
fs.writeFileSync('docs/better-workspace.md', d)
console.log('0.38.0 prepared')
