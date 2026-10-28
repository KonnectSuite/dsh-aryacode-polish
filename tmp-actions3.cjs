const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const need = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }

// click path runs the same action
need(`            onClick: () => {
              setSwitcher(null)
              if (hit.kind === 'workspace') { revealWorkspace(hit.workspaceId); return }
              services.openSession(hit.id)
            },`, 'click branch')
s = s.replace(`            onClick: () => {
              setSwitcher(null)
              if (hit.kind === 'workspace') { revealWorkspace(hit.workspaceId); return }
              services.openSession(hit.id)
            },`,
`            onClick: () => {
              setSwitcher(null)
              if (hit.kind === 'workspace') { revealWorkspace(hit.workspaceId); return }
              if (hit.kind === 'action') { runAction(hit); return }
              services.openSession(hit.id)
            },`)

// the label shows a marker and its hint says what it does
need("          React.createElement('span', { style: WS_TITLE }, hit.kind === 'workspace' ? '⌂ ' + hit.title : hit.title),\n          React.createElement('span', { style: SWITCHER_HINT }, hit.kind === 'workspace' ? 'workspace' : hit.workspace)))))), document.body)",
  'row labels')
s = s.replace("          React.createElement('span', { style: WS_TITLE }, hit.kind === 'workspace' ? '⌂ ' + hit.title : hit.title),\n          React.createElement('span', { style: SWITCHER_HINT }, hit.kind === 'workspace' ? 'workspace' : hit.workspace)))))), document.body)",
"          React.createElement('span', { style: WS_TITLE }, hit.kind === 'workspace' ? '\\u2302 ' + hit.title : (hit.kind === 'action' ? '\\u25B8 ' + hit.title : hit.title)),\n          React.createElement('span', { style: SWITCHER_HINT }, hit.kind === 'workspace' ? 'workspace' : (hit.kind === 'action' ? 'action' : hit.workspace)))))), document.body)")

fs.writeFileSync(p, s)
console.log('click path and labels wired')
