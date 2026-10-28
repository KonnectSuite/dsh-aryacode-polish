const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* A. the pure helper, beside folderKey */
swap(`export function folderKey(workspace) {`,
`/**
 * The title a workspace needs to sit under \`folder\`: its own name moved behind the
 * folder prefix, with any previous prefix replaced rather than stacked.
 */
export function fileUnder(label, folder) {
  const name = String(label || '').trim()
  const target = String(folder || '').trim()
  if (!name || !target) return name
  const cut = name.lastIndexOf('/')
  const bare = (cut >= 0 ? name.slice(cut + 1) : name).trim()
  return bare ? target + '/' + bare : target
}

export function folderKey(workspace) {`)

/* B. folder header takes a workspace drop */
swap(`        title: folded ? 'Expand ' + folder : 'Collapse ' + folder,
        style: WS_FOLDER_ROW,
        onClick: () => setFolders((prev) => Object.assign({}, prev, { [folder]: prev[folder] !== true })),`,
`        title: folded ? 'Expand ' + folder : 'Collapse ' + folder,
        style: Object.assign({}, WS_FOLDER_ROW, {
          background: dropping === 'folder:' + folder
            ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
            : undefined,
        }),
        onClick: () => setFolders((prev) => Object.assign({}, prev, { [folder]: prev[folder] !== true })),
        onDragOver: (event) => {
          if (!drag || drag.kind !== 'workspace') return
          if (folderOf(rows.find((entry) => entry.workspace.workspaceId === drag.id)?.workspace) === folder) return
          event.preventDefault()
          setDropping('folder:' + folder)
        },
        onDragLeave: () => setDropping(null),
        onDrop: (event) => {
          event.preventDefault()
          setDropping(null)
          if (!drag || drag.kind !== 'workspace') return
          const moving = rows.find((entry) => entry.workspace.workspaceId === drag.id)
          if (!moving || folderOf(moving.workspace) === folder) return
          const title = fileUnder(workspaceLabel(moving.workspace), folder)
          Promise.resolve()
            .then(() => services.renameWorkspace(moving.workspace.workspaceId, title))
            .then(() => setNotice('Filed under ' + folder + '.'))
            .catch(() => setNotice('Could not file that workspace.'))
        },`)

/* C. a note card on hover */
swap(`  const [noteDraft, setNoteDraft] = React.useState('')`,
`  const [noteDraft, setNoteDraft] = React.useState('')
  const [card, setCard] = React.useState(null)`)

swap(`      onMouseEnter: () => setHover('workspace:' + workspace.workspaceId),
      onMouseLeave: () => setHover(null),`,
`      onMouseEnter: (event) => {
        setHover('workspace:' + workspace.workspaceId)
        const note = appearanceOf(look, workspace.workspaceId).note
        if (!note) return
        const box = event.currentTarget.getBoundingClientRect()
        setCard({ text: note, top: box.bottom + 6, left: Math.max(8, box.left) })
      },
      onMouseLeave: () => { setHover(null); setCard(null) },`)

/* D. render the card */
swap(`  const paintMenu = menu && menu.kind === 'paint'`,
`  const noteCard = card
    ? ReactDOM.createPortal(React.createElement('div', {
      'data-polish-note-card': 'true',
      style: Object.assign({}, WS_NOTE_CARD, { top: card.top, left: card.left }),
    }, card.text), document.body)
    : null

  const paintMenu = menu && menu.kind === 'paint'`)

swap(`  glyphMenu,
  noteMenu,`, `  glyphMenu,
  noteMenu,
  noteCard,`)

/* E. the card style */
swap(`const WS_GLYPH = {`,
`const WS_NOTE_CARD = {
  position: 'fixed',
  zIndex: 1250,
  maxWidth: '260px',
  padding: '6px 9px',
  borderRadius: 'var(--dsw-radius-md, 8px)',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))',
  background: 'Canvas',
  color: 'var(--dsw-alias-label-secondary, #61666b)',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',
  lineHeight: 1.35,
  boxShadow: 'var(--dsw-elevation-prominent, 0 2px 8px rgba(0, 0, 0, 0.08))',
  pointerEvents: 'none',
  whiteSpace: 'pre-wrap',
}

const WS_GLYPH = {`)

fs.writeFileSync(p, src)
console.log('folder drops and note cards added')
