const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. helper: is anything filed here running?
const anchor = `export function sumCost(sessions, snapshot) {`
if (!src.includes(anchor)) throw new Error('sumCost anchor missing')
src = src.replace(anchor, [
  '/** True when any session filed under these workspaces is running right now. */',
  'export function folderHasRunning(inside) {',
  '  return (inside || []).some((entry) => (entry.sessions || []).some((row) => row && row.running === true))',
  '}',
  '',
  anchor,
].join('\n'))

// 2. the folder header shows that state, and Alt+click folds every other folder
const clickOld = `        onClick: () => setFolders((prev) => Object.assign({}, prev, { [folder]: prev[folder] !== true })),`
if (!src.includes(clickOld)) throw new Error('folder click anchor missing')
src = src.replace(clickOld, `        onClick: (event) => {
          const collapseSiblings = event.altKey === true
          setFolders((prev) => {
            const next = Object.assign({}, prev)
            if (!collapseSiblings) {
              next[folder] = prev[folder] !== true
              return next
            }
            const folding = prev[folder] !== true
            folderNames.forEach((name) => { if (name !== folder) next[name] = folding })
            next[folder] = prev[folder] !== true
            return next
          })
          if (collapseSiblings) setNotice('Alt+click folds the other folders too.')
        },`)

const folderCountAnchor = `folderCostNode(inside, sessionState, folder),`
if (!src.includes(folderCountAnchor)) throw new Error('folder cost anchor missing')
src = src.replace(folderCountAnchor, `folderCostNode(inside, sessionState, folder),
      folderHasRunning(inside)
        ? React.createElement('span', { 'data-polish-folder-running': folder, title: 'A session inside is running', style: WS_DOT })
        : null,`)

// 3. repair the flag glyph that a later patch mojibaked again
src = src.replace(/'âš‘'/g, "'\\u2691'")

fs.writeFileSync(p, src)
console.log('folder running dot + alt+click wired')
