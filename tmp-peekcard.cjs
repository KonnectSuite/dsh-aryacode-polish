const fs = require('node:fs')
let s = fs.readFileSync('client/workspace.js', 'utf8')

// state
const stateAnchor = '  const [helpOpen, setHelpOpen] = React.useState(false)'
if (!s.includes(stateAnchor)) throw new Error('state anchor missing')
s = s.replace(stateAnchor, '  const [costPeek, setCostPeek] = React.useState(null)\n' + stateAnchor)

// the card, right before the help card so both portals live together
const cardAnchor = '  const helpCard = helpOpen'
if (!s.includes(cardAnchor)) throw new Error('help card anchor missing')
s = s.replace(cardAnchor, `  const peekGroup = costPeek ? rows.find((group) => group.workspace.workspaceId === costPeek.workspaceId) : undefined
  const peekTotal = peekGroup ? sumCost(peekGroup.sessions, sessionState) : undefined
  const peekTokens = peekGroup ? sumTokens(peekGroup.sessions, sessionState) : undefined
  const number = (value) => new Intl.NumberFormat('en-US').format(Math.round(Number(value) || 0))
  const peekRows = peekTokens === undefined || peekTokens.priced === 0
    ? []
    : [
      ['Cache hit', peekTokens.billed > 0 ? String(peekTokens.hit) + String.fromCharCode(37) : ''],
      ['Uncached input', number(peekTokens.uncached) + ' tok'],
      ['Cached input', number(peekTokens.cacheRead) + ' tok'],
      peekTokens.cacheWrite > 0 ? ['Cache write', number(peekTokens.cacheWrite) + ' tok'] : null,
      ['Output', number(peekTokens.output) + ' tok'],
      ['Requests', number(peekTokens.requests)],
      ['Priced sessions', number(peekTokens.priced) + ' of ' + number((peekGroup && peekGroup.sessions.length) || 0)],
    ].filter(Boolean)
  const costPeekCard = costPeek && peekTokens && peekTokens.priced > 0
    ? ReactDOM.createPortal(
      React.createElement('div', {
        'data-polish-cost-peek': 'open',
        style: Object.assign({}, SWITCHER_BACKDROP, { zIndex: 1350 }),
        onPointerDown: (event) => { if (event.target === event.currentTarget) setCostPeek(null) },
      },
      React.createElement('div', {
        style: Object.assign({}, SWITCHER_CARD, { padding: '12px 14px', width: 'min(330px, calc(100vw - 32px))' }),
      },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' },
      },
        React.createElement('span', { style: { flex: '1 1 auto', fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, 'Estimated cost \\u2014 ' + costPeek.label),
        React.createElement('span', { 'data-polish-cost-peek-total': 'true', style: { flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: '12px' } }, costLabel(peekTotal))),
      React.createElement('div', {
        style: { display: 'flex', gap: '2px', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))', marginBottom: '10px' },
      },
        peekTokens.cacheRead > 0 ? React.createElement('span', { key: 'hit', style: { flexGrow: peekTokens.cacheRead, background: 'color-mix(in srgb, CanvasText 22%, transparent)' } }) : null,
        peekTokens.uncached + peekTokens.cacheWrite > 0 ? React.createElement('span', { key: 'miss', style: { flexGrow: peekTokens.uncached + peekTokens.cacheWrite, background: 'color-mix(in srgb, CanvasText 48%, transparent)' } }) : null,
        peekTokens.output > 0 ? React.createElement('span', { key: 'out', style: { flexGrow: peekTokens.output, background: 'color-mix(in srgb, CanvasText 72%, transparent)' } }) : null),
      peekRows.map((pair) => React.createElement('div', {
        key: pair[0],
        'data-polish-cost-peek-row': pair[0],
        style: { display: 'flex', gap: '12px', justifyContent: 'space-between', padding: '2px 0', fontSize: '12px' },
      },
        React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary, #61666b)' } }, pair[0]),
        React.createElement('span', { style: { fontVariantNumeric: 'tabular-nums' } }, pair[1]))),
      React.createElement('div', {
        style: { marginTop: '10px', fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary, rgba(97,102,107,0.85))' },
      }, 'Based on recorded usage and published rates. Your provider\\u2019s bill is authoritative.'),
      React.createElement('button', {
        type: 'button',
        'data-polish-cost-peek-close': 'true',
        style: Object.assign({}, WS_ROW_ACTION, { width: 'auto', padding: '0 10px', marginTop: '8px', height: '24px' }),
        onClick: () => setCostPeek(null),
      }, 'Close'),
      ),
      document.body)
    : null

${cardAnchor}`)

fs.writeFileSync('client/workspace.js', s)
console.log('cost peek card inserted')
