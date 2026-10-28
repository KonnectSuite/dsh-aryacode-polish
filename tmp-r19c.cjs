const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('renameSessionPrompt')) throw new Error('already patched')

// replace the dead requestRenameSession service with a direct Remote rename
const old = `            requestRenameSession: (id, title) => {
              /* the shipped rename dialog owns the transaction; we only raise the request */
              const ui = ctx.get('uiWorkspace') || seated.uiWorkspace
              if (!ui || typeof ui.requestSessionRename !== 'function') throw new Error('no rename dialog here')
              ui.requestSessionRename(id, title)
            },`
if (!src.includes(old)) throw new Error('service anchor missing')
src = src.replace(old, `            requestRenameSession: async (id, title) => {
              /* the workspace navigation service does not own rename, so call the Host verb */
              const answer = await seated.remote.session.rename({ sessionId: id, title })
              if (answer && answer.ok === false) throw new Error((answer.error && answer.error.message) || 'rename was refused')
            },`)

// the row handler now awaits, reports failure, and returns the promise
const rowOld = `        try {
          services.requestRenameSession(row.id, row.displayTitle || row.id)
        } catch (error) {
          setNotice(error && error.message ? error.message : 'Could not rename that session.')
        }`
if (!src.includes(rowOld)) throw new Error('row handler anchor missing')
src = src.replace(rowOld, `        Promise.resolve(services.requestRenameSession(row.id, row.displayTitle || row.id))
          .then(() => setNotice('Renamed that session.'))
          .catch((error) => setNotice(error && error.message ? error.message : 'Could not rename that session.'))`)

fs.writeFileSync(p, src)
console.log('rename via remote')
