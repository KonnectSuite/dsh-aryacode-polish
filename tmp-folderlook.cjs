const fs = require('node:fs')
const path = 'client/workspace.js'
let src = fs.readFileSync(path, 'utf8')
const before = src
const must = (needle, label) => {
  if (!src.includes(needle)) throw new Error('anchor missing: ' + label)
}

// 1. folder-look helpers beside the workspace appearance helpers
must('\nconst WS_TONE = {', 'WS_TONE')
src = src.replace('\nconst WS_TONE = {', `
export const FOLDER_LOOK_PREFIX = 'folder:'

/**
 * A folder is only a title prefix, so its look is stored under a reserved key in the same map the
 * workspace looks use. One storage key means one migration when a folder is renamed.
 */
export function folderLookOf(map, name) {
  return appearanceOf(map, FOLDER_LOOK_PREFIX + name)
}

export function withFolderLook(map, name, patch) {
  return withAppearance(map, FOLDER_LOOK_PREFIX + name, patch)
}

const WS_TONE = {`)

// 2. folder header draws its own look
must("'aria-hidden': 'true' }, folded ?", 'caret')
src = src.replace(`      React.createElement('span', { 'aria-hidden': 'true' }, folded ? '›' : '⌄'),
      React.createElement('span', { style: WS_TITLE }, folder),`, `      React.createElement('span', { 'aria-hidden': 'true' }, folded ? '\\u203A' : '\\u2304'),
      folderLook.tone
        ? React.createElement('span', {
          'data-polish-folder-tone': folder,
          'aria-hidden': 'true',
          style: Object.assign({}, WS_TONE, { background: TONE_COLOR[folderLook.tone] }),
        })
        : null,
      folderLook.glyph
        ? React.createElement('span', { 'data-polish-folder-glyph': folder, 'aria-hidden': 'true', style: WS_GLYPH }, folderLook.glyph)
        : null,
      React.createElement('span', { style: folderLook.strong ? Object.assign({}, WS_TITLE, { fontWeight: 600 }) : WS_TITLE }, folder),`)

// define folderLook inside the row loop
must('    const folder = folderOf(workspace)\n    const folded = folder !== undefined && folders[folder] === true',
  'folder vars')
src = src.replace('    const folder = folderOf(workspace)\n    const folded = folder !== undefined && folders[folder] === true',
  '    const folder = folderOf(workspace)\n    const folderLook = folder === undefined ? {} : folderLookOf(look, folder)\n    const folded = folder !== undefined && folders[folder] === true')

// 3. a folder menu on right-click
must("if (collapseSiblings) setNotice('Alt+click folds the other folders too.')", 'collapse notice')
src = src.replace(`          if (collapseSiblings) setNotice('Alt+click folds the other folders too.')
        },`, `          if (collapseSiblings) setNotice('Alt+click folds the other folders too.')
        },
        onContextMenu: (event) => {
          event.preventDefault()
          event.stopPropagation()
          setMenu({ kind: 'folderLook', folder, anchor: { top: event.clientY, left: event.clientX }, empty: declared.indexOf(folder) !== -1 && inside.length === 0 })
        },`)

// 4. the folder menu itself
must('  const markMenu = menu && menu.kind', 'markMenu')
src = src.replace('  const markMenu = menu && menu.kind', `  const folderLookMenu = menu && menu.kind === 'folderLook'
    ? (() => {
      const current = folderLookOf(look, menu.folder)
      const paint = (patch) => setLook((prev) => withFolderLook(prev, menu.folder, patch))
      return React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
        React.createElement('div', { style: WS_PAINT_ROW },
          TONE_ORDER.map((tone) => React.createElement('button', {
            key: tone,
            type: 'button',
            'data-polish-folder-tone-pick': tone,
            'aria-label': 'Colour ' + tone,
            title: tone,
            style: Object.assign({}, WS_SWATCH, {
              background: TONE_COLOR[tone],
              boxShadow: current.tone === tone ? '0 0 0 1.5px var(--dsw-alias-label-secondary, #61666b)' : undefined,
            }),
            onClick: () => paint({ tone }),
          })),
          React.createElement('button', {
            key: 'none',
            type: 'button',
            'data-polish-folder-tone-pick': 'none',
            'aria-label': 'No colour',
            title: 'No colour',
            style: Object.assign({}, WS_SWATCH, { background: 'transparent' }),
            onClick: () => paint({ tone: undefined }),
          })),
        React.createElement('div', { style: WS_PAINT_ROW },
          GLYPHS.map((glyph) => React.createElement('button', {
            key: glyph,
            type: 'button',
            'data-polish-folder-glyph-pick': glyph,
            'aria-label': 'Glyph ' + glyph,
            title: glyph,
            style: Object.assign({}, WS_SWATCH, { background: 'transparent', fontSize: '14px' }),
            onClick: () => paint({ glyph: current.glyph === glyph ? undefined : glyph }),
          }))),
        React.createElement('button', {
          type: 'button',
          'data-polish-folder-strong': current.strong ? 'on' : 'off',
          style: WS_MENU_ITEM,
          onClick: () => paint({ strong: !current.strong }),
        }, current.strong ? 'Weight: bold \\u2713' : 'Weight: normal'),
        React.createElement('div', { style: WS_MENU_HINT }, 'Colour, glyph and weight for this folder'),
        React.createElement('button', {
          type: 'button',
          'data-polish-folder-look-rename': menu.folder,
          style: WS_MENU_ITEM,
          onClick: () => {
            const anchor = menu.anchor
            const moving = rows.filter((entry) => folderOf(entry.workspace) === menu.folder).map((entry) => entry.workspace)
            setFolderDraft(menu.folder)
            setMenu({ kind: 'renameFolder', folder: menu.folder, anchor, members: moving })
          },
        }, 'Rename folder\\u2026'),
        menu.empty
          ? React.createElement('button', {
            type: 'button',
            'data-polish-folder-look-remove': menu.folder,
            style: WS_MENU_ITEM,
            onClick: () => {
              const name = menu.folder
              setDeclared((prev) => removeFolder(prev, name))
              setLook((prev) => withFolderLook(prev, name, { tone: undefined, glyph: undefined, strong: false }))
              setNotice('Folder removed.')
              closeMenu()
            },
          }, 'Remove this folder')
          : null)
    })()
    : null

  const markMenu = menu && menu.kind`)

// 5. render it
must('  switcherCard,\n  helpCard,\n  sessionMenu,', 'children tail')
src = src.replace('  switcherCard,\n  helpCard,\n  sessionMenu,', '  switcherCard,\n  helpCard,\n  folderLookMenu,\n  sessionMenu,')

// 6. a renamed folder keeps its look
must("              setNotice('Folder renamed.')", 'rename notice')
src = src.replace("              setNotice('Folder renamed.')", `              setLook((prev) => {
                const next = Object.assign({}, prev)
                if (next[FOLDER_LOOK_PREFIX + from] !== undefined) next[FOLDER_LOOK_PREFIX + target] = next[FOLDER_LOOK_PREFIX + from]
                delete next[FOLDER_LOOK_PREFIX + from]
                return next
              })
              setNotice('Folder renamed.')`)

if (src === before) throw new Error('nothing changed')
fs.writeFileSync(path, src)
console.log('patched')
