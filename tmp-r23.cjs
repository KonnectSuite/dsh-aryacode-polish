const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. dropping a workspace on another workspace row re-files it AND positions it there
const oldDrop = `  const dropOnWorkspace = (targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'workspace') return
    void reorderWorkspace(moving.id, targetId)
  }`
if (!src.includes(oldDrop)) throw new Error('dropOnWorkspace anchor missing')
src = src.replace(oldDrop, `  const dropOnWorkspace = (targetId) => {
    const moving = drag
    setDrag(null)
    setDropping(null)
    if (!moving || moving.kind !== 'workspace' || moving.id === targetId) return
    const target = rows.find((entry) => entry.workspace.workspaceId === targetId)
    const source = rows.find((entry) => entry.workspace.workspaceId === moving.id)
    if (!target || !source) { void reorderWorkspace(moving.id, targetId); return }
    const into = folderOf(target.workspace)
    const from = folderOf(source.workspace)
    void (async () => {
      try {
        if (into !== from) {
          await services.renameWorkspace(moving.id, fileUnder(workspaceLabel(source.workspace), into))
          setNotice(into ? 'Moved into ' + into + '.' : 'Moved to the top level.')
        }
        await reorderWorkspace(moving.id, targetId)
      } catch (error) {
        setNotice((error && error.message) || 'Could not move that workspace.')
      }
    })()
  }`)

// 2. the archived menu can open and copy the session it names
const archivedMenuAnchor = `'data-polish-ws-unarchive'`
if (!src.includes(archivedMenuAnchor)) throw new Error('unarchive anchor missing')
const before = src.indexOf('const archivedMenu')
if (before < 0) throw new Error('archivedMenu anchor missing')

fs.writeFileSync(p, src)
console.log('cross-folder workspace drop wired')
