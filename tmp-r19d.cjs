const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. commitRename handles both kinds
const oldCommit = `    if (!draft || !services.renameWorkspace) return
    const title = String(draft.value || '').trim()
    if (title === '' || title === draft.label) return
    try {
      await services.renameWorkspace(draft.workspaceId, title)`
if (!src.includes(oldCommit)) throw new Error('commit anchor missing')
src = src.replace(oldCommit, `    if (!draft) return
    const title = String(draft.value || '').trim()
    if (title === '' || title === draft.label) return
    if (draft.sessionId) {
      if (!services.requestRenameSession) return
      try {
        await services.requestRenameSession(draft.sessionId, title)
        setNotice('Renamed to ' + title + '.')
      } catch (error) {
        setNotice(error && error.message ? error.message : 'Could not rename that session.')
      }
      return
    }
    if (!services.renameWorkspace) return
    try {
      await services.renameWorkspace(draft.workspaceId, title)`)

// 2. double-click opens the editor instead of renaming immediately
const rowOld = `        Promise.resolve(services.requestRenameSession(row.id, row.displayTitle || row.id))
          .then(() => setNotice('Renamed that session.'))
          .catch((error) => setNotice(error && error.message ? error.message : 'Could not rename that session.'))`
if (!src.includes(rowOld)) throw new Error('row handler anchor missing')
src = src.replace(rowOld, `        const title = row.displayTitle || row.id
        setRenaming({ sessionId: row.id, label: title, value: title })`)

// 3. the editor row says what it is editing
const inputOld = `      'data-polish-ws-rename-input': 'true',
      autoFocus: true,
      value: renaming.value,
      placeholder: 'Workspace name (use Work/Name to file it)',
      'aria-label': 'Workspace name',`
if (!src.includes(inputOld)) throw new Error('input anchor missing')
src = src.replace(inputOld, `      'data-polish-ws-rename-input': 'true',
      'data-polish-session-rename-input': renaming.sessionId ? renaming.sessionId : undefined,
      autoFocus: true,
      value: renaming.value,
      placeholder: renaming.sessionId ? 'Session title' : 'Workspace name (use Work/Name to file it)',
      'aria-label': renaming.sessionId ? 'Session title' : 'Workspace name',`)

fs.writeFileSync(p, src)
console.log('session rename editor wired')
