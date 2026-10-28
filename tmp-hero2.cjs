const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => { if (!src.includes(from)) throw new Error('missing: ' + from.slice(0, 50)); src = src.replace(from, to) }

swap(`export function HeroWorkspacePicker(props) {
  const services = (props && props.services) || {}
  const workspaceState = useLive(services.workspacesLive)
  const look = React.useMemo(() => readAppearance(), [])
  const list = (workspaceState && (workspaceState.items || workspaceState.workspaces)) || []
  if (list.length === 0) return null
  return React.createElement('div', { 'data-polish-hero': 'true', style: WS_HERO },`, `export function HeroWorkspacePicker(props) {
  const services = (props && props.services) || {}
  const workspaceState = useLive(services.workspacesLive)
  const look = React.useMemo(() => readAppearance(), [])
  const list = (workspaceState && (workspaceState.items || workspaceState.workspaces)) || []
  // The slot hands over \`open\`: the chip is closed most of the time, and rendering
  // the list unconditionally left it floating over the Hero copy.
  if (!props || props.open !== true || list.length === 0) return null
  const anchor = props.anchorRef && props.anchorRef.current
  const spot = anchor && anchor.getBoundingClientRect
    ? (() => {
      const box = anchor.getBoundingClientRect()
      return {
        position: 'fixed',
        top: Math.round(box.bottom + 6) + 'px',
        left: Math.max(8, Math.round(box.left)) + 'px',
        zIndex: 1200,
      }
    })()
    : {}
  return ReactDOM.createPortal(React.createElement('div', { 'data-polish-hero': 'true', style: Object.assign({}, WS_MENU, WS_HERO, spot, { maxHeight: '320px' }) },`)
swap(`      React.createElement('span', { style: WS_COUNT }, String((workspace.sessionIds || []).length)))
    }))
}`, `      React.createElement('span', { style: WS_COUNT }, String((workspace.sessionIds || []).length)))
    })), document.body)
}`)
fs.writeFileSync(p, src)
console.log('hero picker now respects open and paints a card')
