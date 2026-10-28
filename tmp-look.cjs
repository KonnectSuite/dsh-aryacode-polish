const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const before = src.length
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

/* 1. appearance helpers */
swap(`const WS_FILTER = {`, `const LOOK_KEY = 'aryacode-polish:workspace-appearance.v1'

export const TONE_ORDER = ['slate', 'blue', 'green', 'amber', 'rose', 'violet']

export const TONE_COLOR = {
  slate: '#8a8f98',
  blue: '#4a72d0',
  green: '#2f9e6b',
  amber: '#c8892f',
  rose: '#c2496a',
  violet: '#7a5cc4',
}

export function appearanceOf(map, workspaceId) {
  const entry = (map && map[workspaceId]) || {}
  return {
    tone: TONE_COLOR[entry.tone] ? entry.tone : undefined,
    strong: entry.strong === true,
  }
}

export function withAppearance(map, workspaceId, patch) {
  const next = Object.assign({}, map || {})
  const merged = Object.assign({}, appearanceOf(next, workspaceId), patch || {})
  if (!merged.tone && merged.strong !== true) delete next[workspaceId]
  else next[workspaceId] = { tone: merged.tone, strong: merged.strong === true }
  return next
}

export function readAppearance(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return {}
    const raw = store.getItem(LOOK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeAppearance(map, storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? undefined : localStorage)
    if (!store) return
    store.setItem(LOOK_KEY, JSON.stringify(map || {}))
  } catch {
    /* a locked-down webview must not break the tree */
  }
}

const WS_TONE = {
  flex: 'none',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  boxShadow: '0 0 0 2px var(--dsw-alias-bg-base, transparent)',
}

const WS_SWATCH = {
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  border: '0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))',
  cursor: 'pointer',
  padding: 0,
}

const WS_PAINT_ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 8px',
}

const WS_FILTER = {`)

/* 2. state */
swap(`  const [dropping, setDropping] = React.useState(null)`, `  const [dropping, setDropping] = React.useState(null)
  const [look, setLook] = React.useState(() => readAppearance())
  const paintLook = (workspaceId, patch) => {
    setLook((prev) => {
      const next = withAppearance(prev, workspaceId, patch)
      writeAppearance(next)
      return next
    })
  }`)

/* 3. workspace menu gains the paint entry */
swap(`      React.createElement('button', {
        type: 'button',
        style: Object.assign({}, WS_MENU_ITEM, { color: 'var(--dsw-alias-label-error, #d92d20)' }),`, `      React.createElement('button', {
        type: 'button',
        'data-polish-ws-appearance': 'open',
        style: WS_MENU_ITEM,
        onClick: () => {
          const workspace = menu.workspace
          setMenu({ kind: 'paint', workspace, anchor: menu.anchor })
        },
      }, 'Colour and weight…'),
      React.createElement('button', {
        type: 'button',
        style: Object.assign({}, WS_MENU_ITEM, { color: 'var(--dsw-alias-label-error, #d92d20)' }),`)

/* 4. the paint panel, rendered beside the other two menus */
swap(`  const sessionMenu = menu && menu.kind === 'session'`, `  const paintMenu = menu && menu.kind === 'paint'
    ? (() => {
      const workspace = menu.workspace
      const current = appearanceOf(look, workspace.workspaceId)
      return React.createElement(RowMenu, { anchor: menu.anchor, onClose: closeMenu },
        React.createElement('div', { style: WS_PAINT_ROW },
          TONE_ORDER.map((tone) => React.createElement('button', {
            key: tone,
            type: 'button',
            'data-polish-tone': tone,
            'aria-label': 'Colour ' + tone,
            title: tone,
            style: Object.assign({}, WS_SWATCH, {
              background: TONE_COLOR[tone],
              boxShadow: current.tone === tone
                ? '0 0 0 1.5px var(--dsw-alias-label-secondary, #61666b)'
                : undefined,
            }),
            onClick: () => paintLook(workspace.workspaceId, { tone }),
          })),
          React.createElement('button', {
            key: 'none',
            type: 'button',
            'data-polish-tone': 'none',
            'aria-label': 'No colour',
            title: 'No colour',
            style: Object.assign({}, WS_SWATCH, { background: 'transparent' }),
            onClick: () => paintLook(workspace.workspaceId, { tone: undefined }),
          })),
        React.createElement('button', {
          type: 'button',
          'data-polish-ws-strong': current.strong ? 'on' : 'off',
          style: WS_MENU_ITEM,
          onClick: () => paintLook(workspace.workspaceId, { strong: !current.strong }),
        }, current.strong ? 'Weight: bold ✓' : 'Weight: normal'))
    })()
    : null

  const sessionMenu = menu && menu.kind === 'session'`)

/* 5. rows wear the look */
swap(`    React.createElement('span', { style: WS_TITLE }, workspaceLabel(workspace)),`, `    look[workspace.workspaceId] && appearanceOf(look, workspace.workspaceId).tone
      ? React.createElement('span', {
        style: Object.assign({}, WS_TONE, { background: TONE_COLOR[appearanceOf(look, workspace.workspaceId).tone] }),
      })
      : null,
    React.createElement('span', {
      style: Object.assign({}, WS_TITLE, {
        fontWeight: appearanceOf(look, workspace.workspaceId).strong ? 600 : undefined,
      }),
    }, workspaceLabel(workspace)),`)

/* 6. the paint menu has to ride along in the tree's return value */
swap(`  sessionMenu,
  workspaceMenu)`, `  sessionMenu,
  paintMenu,
  workspaceMenu)`)

fs.writeFileSync(p, src)
console.log('appearance patch applied (' + before + ' -> ' + src.length + ' bytes)')
