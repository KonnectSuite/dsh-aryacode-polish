const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* 1. glyphs + note in the appearance record */
swap(`export function appearanceOf(map, workspaceId) {
  const entry = (map && map[workspaceId]) || {}
  return {
    tone: TONE_COLOR[entry.tone] ? entry.tone : undefined,
    strong: entry.strong === true,
  }
}`,
`/** Glyphs a workspace can wear instead of the folder icon. */
export const GLYPHS = ['📁', '🚀', '🧪', '🐍', '⚙️', '📦', '🧭', '✨', '🧠', '🗂️']

export function appearanceOf(map, workspaceId) {
  const entry = (map && map[workspaceId]) || {}
  return {
    tone: TONE_COLOR[entry.tone] ? entry.tone : undefined,
    strong: entry.strong === true,
    glyph: typeof entry.glyph === 'string' && entry.glyph.length > 0 && entry.glyph.length <= 4 ? entry.glyph : undefined,
    note: typeof entry.note === 'string' && entry.note.length > 0 ? entry.note : undefined,
  }
}`)

swap(`export function withAppearance(map, workspaceId, patch) {
  const next = Object.assign({}, map || {})
  const merged = Object.assign({}, appearanceOf(next, workspaceId), patch || {})
  if (!merged.tone && merged.strong !== true) delete next[workspaceId]
  else next[workspaceId] = { tone: merged.tone, strong: merged.strong === true }
  return next
}`,
`export function withAppearance(map, workspaceId, patch) {
  const next = Object.assign({}, map || {})
  const merged = Object.assign({}, appearanceOf(next, workspaceId), patch || {})
  const entry = {}
  if (merged.tone) entry.tone = merged.tone
  if (merged.strong === true) entry.strong = true
  if (merged.glyph) entry.glyph = merged.glyph
  if (merged.note) entry.note = merged.note
  if (Object.keys(entry).length === 0) delete next[workspaceId]
  else next[workspaceId] = entry
  return next
}`)

/* 2. the row wears the glyph and shows the note on hover */
swap(`    React.createElement(CaretGlyph, { open }),
    React.createElement(FolderGlyph),`,
`    React.createElement(CaretGlyph, { open }),
    looks.glyph
      ? React.createElement('span', { 'data-polish-ws-glyph': looks.glyph, style: WS_GLYPH }, looks.glyph)
      : React.createElement(FolderGlyph),`)

swap(`      onMouseEnter: () => setHover('workspace:' + workspace.workspaceId),
      onMouseLeave: () => setHover(null),`,
`      title: looks.note || undefined,
      onMouseEnter: () => setHover('workspace:' + workspace.workspaceId),
      onMouseLeave: () => setHover(null),`)

/* 3. the glyph size */
swap(`const WS_SECTION = {`,
`const WS_GLYPH = {
  flex: 'none',
  width: '16px',
  textAlign: 'center',
  fontSize: '13px',
  lineHeight: 1,
}

const WS_SECTION = {`)

/* 4. menu entries */
swap(`        'data-polish-ws-appearance': 'open',`,
`        'data-polish-glyph': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const target = menu.workspace
          const anchor = menu.anchor
          closeMenu()
          setMenu({ kind: 'glyph', workspace: target, anchor })
        },
      }, 'Glyph…'),
      React.createElement('button', {
        type: 'button',
        'data-polish-note': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const target = menu.workspace
          const anchor = menu.anchor
          closeMenu()
          setMenu({ kind: 'note', workspace: target, anchor, value: appearanceOf(look, target.workspaceId).note || '' })
        },
      }, 'Note…'),
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-appearance': 'open',`)

fs.writeFileSync(p, src)
console.log('glyph and note added to rows and menu')
