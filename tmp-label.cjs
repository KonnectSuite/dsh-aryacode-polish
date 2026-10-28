const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// A readable label: the Host leaves `title` empty for the default workspace, so the
// id was on screen. Humanise the id instead of showing it raw.
src = src.replace(
  `export function BetterWorkspace(props) {`,
  `export function workspaceLabel(workspace) {
  const title = workspace && typeof workspace.title === 'string' ? workspace.title.trim() : ''
  if (title) return title
  const id = String((workspace && workspace.workspaceId) || '')
  const words = id.replace(/[-_]+/g, ' ').trim()
  if (!words) return 'Workspace'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function BetterWorkspace(props) {`,
)
src = src.replace(
  `  const [armed, setArmed] = React.useState(null)`,
  `  const [armed, setArmed] = React.useState(null)
  const [adding, setAdding] = React.useState(false)
  const [notice, setNotice] = React.useState('')`,
)
fs.writeFileSync(p, src)
console.log('label helper: ' + src.includes('export function workspaceLabel'))
console.log('add state: ' + src.includes('const [adding, setAdding]'))
