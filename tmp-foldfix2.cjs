const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

swap(`  // "Everything is folded" has to include the folders, otherwise the header button says
  // "Expand all" while a folded folder keeps hiding its workspaces.
  const allFolded = rows.length > 0
    && rows.every(row => expanded[row.workspace.workspaceId] === false)
    && folderNames.every(name => folders[name] !== true)`,
`  // One click should always do the useful thing: if anything is folded, the button
  // expands everything (folders included); only when nothing is folded does it fold.
  const anyFolded = rows.some(row => expanded[row.workspace.workspaceId] === false)
    || folderNames.some(name => folders[name] === true)
  const allFolded = rows.length > 0 && !anyFolded`)

swap(`  const foldAll = () => {
    if (allFolded) {
      setExpanded({})
      setFolders({})
      return
    }`, `  const foldAll = () => {
    if (anyFolded) {
      setExpanded({})
      setFolders({})
      return
    }`)

fs.writeFileSync(p, src)
console.log('fold button now expands when anything is folded')
