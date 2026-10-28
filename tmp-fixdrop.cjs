const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const old = `      onDragOver: (event) => {
        if (!drag || drag.kind !== 'workspace' || drag.id === workspace.workspaceId) return
        event.preventDefault()
        setDropping('workspace:' + workspace.workspaceId)
      },`
if (!s.includes(old)) throw new Error('workspace dragOver anchor missing')
s = s.replace(old, `      onDragOver: (event) => {
        if (!drag) return
        if (drag.kind === 'pinned') {
          event.preventDefault()
          setDropping('workspace:' + workspace.workspaceId)
          return
        }
        if (drag.kind !== 'workspace' || drag.id === workspace.workspaceId) return
        event.preventDefault()
        setDropping('workspace:' + workspace.workspaceId)
      },`)
fs.writeFileSync(p, s)
console.log('a workspace row now accepts a dragged pinned session')
