const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const need = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }

// Enter: run an action
need("            if (hit.kind === 'workspace') {", 'enter branch')
s = s.replace(`            if (hit.kind === 'workspace') {
              revealWorkspace(hit.workspaceId)
              return
            }
            services.openSession(hit.id)`,
`            if (hit.kind === 'workspace') {
              revealWorkspace(hit.workspaceId)
              return
            }
            if (hit.kind === 'action') {
              runAction(hit)
              return
            }
            services.openSession(hit.id)`)

// the runner, beside revealWorkspace
need('  const revealWorkspace = (workspaceId) => {', 'revealWorkspace')
s = s.replace('  const revealWorkspace = (workspaceId) => {',
`  const runAction = (hit) => {
    const started = services.startSession(hit.workspaceId)
    Promise.resolve(started)
      .then(() => setNotice('Started a session in ' + hit.workspace + '.'))
      .catch((error) => setNotice(error && error.message ? error.message : 'Could not start a session.'))
  }

  const revealWorkspace = (workspaceId) => {`)

// the row marker + attribute
need("            key: hit.id,\n            type: 'button',", 'switch row')
s = s.replace(`            key: hit.id,
            type: 'button',`,
`            key: hit.id,
            type: 'button',
            'data-polish-switcher-action': hit.kind === 'action' ? hit.workspaceId : undefined,`)

fs.writeFileSync(p, s)
console.log('action runner and row marker wired')
