const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

/* note draft state */
swap(`  const [look, setLook] = React.useState(() => readAppearance())`,
`  const [look, setLook] = React.useState(() => readAppearance())
  const [noteDraft, setNoteDraft] = React.useState('')`)

/* seed the draft when the note editor opens */
swap(`          setMenu({ kind: 'note', workspace: target, anchor, value: appearanceOf(look, target.workspaceId).note || '' })`,
`          setNoteDraft(appearanceOf(look, target.workspaceId).note || '')
          setMenu({ kind: 'note', workspace: target, anchor })`)

/* the two panels */
swap(`  const paintMenu = menu && menu.kind === 'paint'`,
`  const glyphMenu = menu && menu.kind === 'glyph'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('div', { style: WS_GLYPH_GRID },
        GLYPHS.map((glyph) => React.createElement('button', {
          key: 'glyph:' + glyph,
          type: 'button',
          'data-polish-glyph-pick': glyph,
          title: 'Use ' + glyph,
          style: Object.assign({}, WS_GLYPH_BUTTON, {
            background: appearanceOf(look, menu.workspace.workspaceId).glyph === glyph
              ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06))'
              : undefined,
          }),
          onClick: () => {
            const target = menu.workspace
            closeMenu()
            paintLook(target.workspaceId, { glyph })
          },
        }, glyph)),
        React.createElement('button', {
          key: 'glyph:none',
          type: 'button',
          'data-polish-glyph-pick': 'none',
          style: WS_GLYPH_BUTTON,
          onClick: () => {
            const target = menu.workspace
            closeMenu()
            paintLook(target.workspaceId, { glyph: '' })
          },
        }, '⌫')))
    : null

  const noteMenu = menu && menu.kind === 'note'
    ? React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
      React.createElement('input', {
        'data-polish-note-input': 'true',
        type: 'text',
        value: noteDraft,
        placeholder: 'A note for this workspace',
        autoFocus: true,
        style: WS_NOTE_INPUT,
        onChange: (event) => setNoteDraft(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Escape') { event.stopPropagation(); closeMenu(); return }
          if (event.key !== 'Enter') return
          const target = menu.workspace
          const value = noteDraft.trim()
          closeMenu()
          paintLook(target.workspaceId, { note: value })
        },
      }),
      React.createElement('div', { style: WS_MENU_HINT }, 'Enter saves, Escape cancels'))
    : null

  const paintMenu = menu && menu.kind === 'paint'`)

/* styles */
swap(`const WS_GLYPH = {`,
`const WS_GLYPH_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 26px)',
  gap: '2px',
  padding: '2px',
}

const WS_GLYPH_BUTTON = {
  width: '26px',
  height: '26px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  fontSize: '15px',
  lineHeight: 1,
  cursor: 'pointer',
}

const WS_NOTE_INPUT = {
  width: '220px',
  boxSizing: 'border-box',
  padding: '5px 8px',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12))',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  outline: 'none',
}

const WS_MENU_HINT = {
  padding: '4px 8px 2px',
  fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 2px)',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
}

const WS_GLYPH = {`)

/* hand both panels to the tree */
swap(`  switcherCard,
  sessionMenu,
  archivedMenu,`,
`  switcherCard,
  sessionMenu,
  glyphMenu,
  noteMenu,
  archivedMenu,`)

fs.writeFileSync(p, src)
console.log('glyph picker and note editor added')
