const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

const oldRow = `        React.createElement('span', { style: WS_PIN, 'aria-hidden': 'true' }, '\\u2605'),
        React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
        React.createElement('span', { style: WS_COUNT_NOTE }, group ? workspaceLabel(group) : '')))`
if (!src.includes(oldRow)) throw new Error('pinned row anchor missing')
src = src.replace(oldRow, `        React.createElement('span', { style: WS_PIN, 'aria-hidden': 'true' }, '\\u2605'),
        React.createElement('span', { style: WS_TITLE }, row.displayTitle || row.id),
        costLabel(costOf(sessionState, row.id))
          ? React.createElement('span', { 'data-polish-pinned-cost': row.id, style: WS_COST }, costLabel(costOf(sessionState, row.id)))
          : null,
        React.createElement('span', { style: WS_COUNT_NOTE }, group ? workspaceLabel(group) : ''),
        hover === 'pinned:' + row.id
          ? React.createElement('button', {
            type: 'button',
            'data-polish-pinned-unpin': row.id,
            title: 'Unpin this session',
            'aria-label': 'Unpin this session',
            style: WS_ROW_ACTION,
            onClick: (event) => { event.stopPropagation(); services.unpinSession(row.id) },
          }, '\\u2605')
          : null))`)

const pinnedRowAttr = `          'data-polish-ws-pinned-row': row.id,`
if (!src.includes(pinnedRowAttr)) throw new Error('pinned attr anchor missing')
src = src.replace(pinnedRowAttr, pinnedRowAttr + `
          onMouseEnter: () => setHover('pinned:' + row.id),
          onMouseLeave: () => setHover(null),`)

fs.writeFileSync(p, src)
console.log('pinned rows gained cost and a hover unpin')
