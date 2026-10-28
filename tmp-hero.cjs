const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const before = src.length
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 60))
  src = src.replace(from, to)
}

/* Hero picker: the same workspaces, in the blank-session Hero. */
swap(`/**
 * Add and dispose the seat with the switch.`, `const WS_HERO = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  minWidth: '220px',
  maxHeight: '320px',
  overflowY: 'auto',
  padding: '4px',
}

const WS_HERO_TITLE = {
  fontSize: 'calc(' + "var(--dsh-content-font-size-secondary, 13px)" + ' - 2px)',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--dsw-alias-label-quaternary, #8a8a8a)',
  padding: '4px 6px 2px',
}

/**
 * The Hero's workspace picker. Same data and same colours as the sidebar tree,
 * reachable before a session exists — the Hero slot wants a list that calls
 * \`onPick(workspaceId)\`, so this is a flat list rather than the tree.
 */
export function HeroWorkspacePicker(props) {
  const services = (props && props.services) || {}
  const workspaceState = useLive(services.workspacesLive)
  const look = React.useMemo(() => readAppearance(), [])
  const list = (workspaceState && (workspaceState.items || workspaceState.workspaces)) || []
  if (list.length === 0) return null
  return React.createElement('div', { 'data-polish-hero': 'true', style: WS_HERO },
    React.createElement('div', { style: WS_HERO_TITLE }, 'Workspaces'),
    list.map((workspace) => {
      const looks = appearanceOf(look, workspace.workspaceId)
      return React.createElement('button', {
        key: workspace.workspaceId,
        type: 'button',
        'data-polish-hero-row': workspace.workspaceId,
        style: Object.assign({}, WS_ROW, {
          fontWeight: looks.strong ? 600 : 500,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
        }),
        onClick: () => {
          if (props.onPick) props.onPick(workspace.workspaceId)
          if (props.onClose) props.onClose()
        },
      },
      React.createElement(FolderGlyph),
      looks.tone
        ? React.createElement('span', { style: Object.assign({}, WS_TONE, { background: TONE_COLOR[looks.tone] }) })
        : null,
      React.createElement('span', { style: WS_TITLE }, workspaceLabel(workspace)),
      React.createElement('span', { style: WS_COUNT }, String((workspace.sessionIds || []).length)))
    }))
}

/**
 * Add and dispose the seat with the switch.`)

/* install both seats, dispose both */
swap(`  let dispose
  let unlisten`, `  let dispose
  let disposeHero
  let unlisten`)

swap(`          seated.slots.inject('sidebar.workspaces', () => seated.slots.register({
            name: 'sidebar.workspaces',
            priority: -1,
            inject: () => ({ services }),
          }, BetterWorkspace))`, `          seated.slots.inject('sidebar.workspaces', () => seated.slots.register({
            name: 'sidebar.workspaces',
            priority: -1,
            inject: () => ({ services }),
          }, BetterWorkspace))
          // The Hero picker is its own single slot, so it needs its own -1 seat;
          // both live and die with the one switch.
          disposeHero = seated.slots.inject('conversation.hero.workspace', () => seated.slots.register({
            name: 'conversation.hero.workspace',
            priority: -1,
            inject: () => ({ services }),
          }, HeroWorkspacePicker))`)

swap(`    if (typeof dispose === 'function') {
      try {
        dispose()
      } catch {}
    }
    dispose = undefined
  }`, `    if (typeof disposeHero === 'function') {
      try {
        disposeHero()
      } catch {}
    }
    disposeHero = undefined
    if (typeof dispose === 'function') {
      try {
        dispose()
      } catch {}
    }
    dispose = undefined
  }`)

swap(`  return () => {
    if (typeof unlisten === 'function') unlisten()
    if (typeof dispose === 'function') dispose()
  }`, `  return () => {
    if (typeof unlisten === 'function') unlisten()
    if (typeof disposeHero === 'function') disposeHero()
    if (typeof dispose === 'function') dispose()
  }`)

fs.writeFileSync(p, src)
console.log('hero picker added (' + before + ' -> ' + src.length + ' bytes)')
