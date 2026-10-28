const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

swap(`  const allFolded = rows.length > 0 && rows.every(row => expanded[row.workspace.workspaceId] === false)`,
`  const folderNames = Array.from(new Set(rows.map(row => folderKey(row.workspace)).filter(Boolean)))
  // "Everything is folded" has to include the folders, otherwise the header button says
  // "Expand all" while a folded folder keeps hiding its workspaces.
  const allFolded = rows.length > 0
    && rows.every(row => expanded[row.workspace.workspaceId] === false)
    && folderNames.every(name => folders[name] !== true)`)

swap(`  const foldAll = () => {
    if (allFolded) { setExpanded({}); return }
    const next = {}
    rows.forEach((row) => { next[row.workspace.workspaceId] = false })
    setExpanded(next)
  }`,
`  const foldAll = () => {
    if (allFolded) {
      setExpanded({})
      setFolders({})
      return
    }
    const next = {}
    rows.forEach((row) => { next[row.workspace.workspaceId] = false })
    const nextFolders = {}
    folderNames.forEach((name) => { nextFolders[name] = true })
    setExpanded(next)
    setFolders(nextFolders)
  }`)

fs.writeFileSync(p, src)
console.log('fold-all covers folders')
