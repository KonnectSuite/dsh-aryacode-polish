const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const must = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }

// A. drop a dragged session on the Pinned header to pin it
must("      'data-polish-ws-pinned': 'head',", 'pinned head')
s = s.replace(`      'data-polish-ws-pinned': 'head',
      style: WS_SECTION,
      onClick: () => setPinOpen((open) => !open),
    },`, `      'data-polish-ws-pinned': 'head',
      style: Object.assign({}, WS_SECTION, {
        background: dropping === 'pinned'
          ? 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05))'
          : undefined,
      }),
      onClick: () => setPinOpen((open) => !open),
      onDragOver: (event) => {
        if (!drag || drag.kind !== 'session') return
        event.preventDefault()
        setDropping('pinned')
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event) => {
        event.preventDefault()
        setDropping(null)
        if (!drag || drag.kind !== 'session') return
        const moving = drag
        setDrag(null)
        Promise.resolve()
          .then(() => services.pinSession(moving.id))
          .then(() => setNotice('Pinned that session.'))
          .catch(() => setNotice('Could not pin that session.'))
      },
    },`)

// B. a pinned row can be dragged back out; dropOnWorkspace releases it
must("      onDragStart: () => setDrag({ kind: 'session', id: row.id, workspaceId: workspace.workspaceId }),", 'session drag')
s = s.replace(`          'data-polish-ws-pinned-row': row.id,`, `          'data-polish-ws-pinned-row': row.id,
          draggable: true,
          onDragStart: () => setDrag({ kind: 'pinned', id: row.id, workspaceId: group ? group.workspace.workspaceId : undefined }),`)
must('  const dropOnWorkspace = (targetId) => {', 'dropOnWorkspace')
s = s.replace(`    if (!moving || moving.kind !== 'workspace' || moving.id === targetId) return`, `    if (moving && moving.kind === 'pinned') {
      Promise.resolve()
        .then(() => services.unpinSession(moving.id))
        .then(() => setNotice('Unpinned that session.'))
        .catch(() => setNotice('Could not unpin that session.'))
      return
    }
    if (!moving || moving.kind !== 'workspace' || moving.id === targetId) return`)

// C. type-ahead over the walk
must('    if (event.key === \'ArrowDown\' || event.key === \'ArrowUp\') {', 'arrow branch')
s = s.replace(`    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {`, `    const typed = event.key
    if (typed.length === 1 && typed !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && walk.length > 0) {
      event.preventDefault()
      const next = (typeBufferRef.current + typed).toLowerCase()
      typeBufferRef.current = next
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current)
      typeTimerRef.current = setTimeout(() => { typeBufferRef.current = '' }, 700)
      const found = walk.findIndex((entry) => {
        const title = entry.kind === 'workspace'
          ? workspaceLabel((rows.find((item) => item.workspace.workspaceId === entry.workspaceId) || {}).workspace || {})
          : ((rows.find((item) => item.workspace.workspaceId === entry.workspaceId) || {}).sessions || [])
            .filter((item) => item.id === entry.id)
            .map((item) => String(item.displayTitle || item.title || ''))
            .join('')
        return String(title).toLowerCase().startsWith(next)
      })
      if (found >= 0) setCursor(found)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {`)

// refs beside cursor state
must('  const [cursor, setCursor] = React.useState(-1)', 'cursor state')
s = s.replace('  const [cursor, setCursor] = React.useState(-1)', `  const [cursor, setCursor] = React.useState(-1)
  const typeBufferRef = React.useRef('')
  const typeTimerRef = React.useRef(null)`)

fs.writeFileSync(p, s)
console.log('patched pin-drop, pinned drag-out and type-ahead')
