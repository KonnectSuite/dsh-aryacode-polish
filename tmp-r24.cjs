const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. a persistent "seen the help" flag
const anchor = `export function folderHasRunning(inside) {`
if (!src.includes(anchor)) throw new Error('folderHasRunning anchor missing')
src = src.replace(anchor, [
  "const HELP_KEY = 'aryacode-polish:help.v1'",
  '',
  '/** Whether the shortcut sheet has been opened once on this machine. */',
  'export function readHelp(storage) {',
  '  try {',
  "    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)",
  '    if (!store) return false',
  '    return store.getItem(HELP_KEY) === ' + "'1'",
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  'export function writeHelp(seen, storage) {',
  '  try {',
  "    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)",
  "    if (!store) return",
  "    if (seen) store.setItem(HELP_KEY, '1')",
  '    else store.removeItem(HELP_KEY)',
  '  } catch {',
  '    // a locked-down webview simply forgets it was shown',
  '  }',
  '}',
  '',
  anchor,
].join('\n'))

// 2. state + the '?' key + a hint line that stops showing once the sheet is opened
const stateAnchor = `  const [folderTarget, setFolderTarget] = React.useState(null)`
if (!src.includes(stateAnchor)) throw new Error('state anchor missing')
src = src.replace(stateAnchor, stateAnchor + `
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [helpSeen, setHelpSeen] = React.useState(() => readHelp())`)

const keyHookAnchor = `    const onEscape = (event) => {
      if (event.key === 'Escape') setSwitcher(null)
    }`
if (!src.includes(keyHookAnchor)) throw new Error('escape anchor missing')
src = src.replace(keyHookAnchor, keyHookAnchor + `
    const onHelp = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.key !== '?') return
      event.preventDefault()
      setHelpOpen((prev) => {
        if (!prev) { writeHelp(true); setHelpSeen(true) }
        return !prev
      })
    }
    document.addEventListener('keydown', onHelp)`)

const keyCleanupAnchor = `      document.removeEventListener('keydown', onEscape)`
if (!src.includes(keyCleanupAnchor)) throw new Error('cleanup anchor missing')
src = src.replace(keyCleanupAnchor, keyCleanupAnchor + `
      document.removeEventListener('keydown', onHelp)`)

fs.writeFileSync(p, src)
console.log('help state + key wired')
