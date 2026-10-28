const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const start = src.indexOf('  const helpCard = helpOpen')
const end = src.indexOf('  const helpHint = ', start)
if (start < 0 || end < 0) throw new Error('helpCard block not found')
const clean = [
  '  const helpCard = helpOpen',
  '    ? ReactDOM.createPortal(',
  "      React.createElement('div', {",
  "        'data-polish-ws-help': 'open',",
  '        style: Object.assign({}, SWITCHER_BACKDROP, { zIndex: 1350 }),',
  '        onPointerDown: (event) => { if (event.target === event.currentTarget) setHelpOpen(false) },',
  '      },',
  "      React.createElement('div', {",
  "        style: Object.assign({}, SWITCHER_CARD, { padding: '14px 16px', width: 'min(440px, calc(100vw - 32px))', maxHeight: '70vh' }),",
  '      },',
  "      React.createElement('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Workspace shortcuts'),",
  "      HELP_ROWS.map((pair) => React.createElement('div', {",
  '        key: pair[0],',
  "        'data-polish-ws-help-row': pair[0],",
  "        style: { display: 'flex', gap: '12px', padding: '3px 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #61666b)' },",
  '      },',
  "        React.createElement('span', { style: { minWidth: '92px', fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-primary, #1f2328)' } }, pair[0]),",
  '        React.createElement(\'span\', null, pair[1]))),',
  "      React.createElement('button', {",
  "        type: 'button',",
  "        'data-polish-ws-help-close': 'true',",
  "        style: Object.assign({}, WS_ROW_ACTION, { width: 'auto', padding: '0 10px', marginTop: '10px', height: '24px' }),",
  '        onClick: () => setHelpOpen(false),',
  "      }, 'Close'))),",
  '      document.body)',
  '    : null',
  '',
].join('\n')
src = src.slice(0, start) + clean + src.slice(end)
fs.writeFileSync(p, src)
console.log('helpCard rebuilt')
