const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// the sheet, built beside the switcher card
const anchor = `  const switcherCard = switcher`
if (!src.includes(anchor)) throw new Error('switcher card anchor missing')
const sheet = [
  '  const HELP_ROWS = [',
  "    ['Enter', 'open the highlighted session'],",
  "    ['[ / ]', 'jump to the previous or next workspace'],",
  "    ['/', 'focus the filter; Escape clears it'],",
  "    ['Ctrl+K', 'jump to any session or workspace'],",
  "    ['Shift+F10', 'open the row menu'],",
  "    ['Alt+click', 'a folder, to fold every other folder'],",
  "    ['Double-click', 'a workspace or session, to rename it'],",
  "    ['Drag', 'a row onto another to move it there'],",
  "    ['?', 'this sheet'],",
  '  ]',
  '  const helpCard = helpOpen',
  "    ? ReactDOM.createPortal(React.createElement('div', {",
  "        'data-polish-ws-help': 'open',",
  '        style: Object.assign({}, SWITCHER_BACKDROP, { zIndex: 1350 }),',
  '        onPointerDown: (event) => { if (event.target === event.currentTarget) setHelpOpen(false) },',
  '      },',
  '      React.createElement(\'div\', {',
  '        style: Object.assign({}, SWITCHER_CARD, { padding: \'14px 16px\', width: \'min(440px, calc(100vw - 32px))\', maxHeight: \'70vh\' }),',
  '      },',
  "      React.createElement('div', { style: { fontWeight: 600, marginBottom: '8px' } }, 'Workspace shortcuts'),",
  '      HELP_ROWS.map((pair) => React.createElement(\'div\', {',
  "        key: pair[0],",
  "        'data-polish-ws-help-row': pair[0],",
  "        style: { display: 'flex', gap: '12px', padding: '3px 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #61666b)' },",
  '      },',
  "        React.createElement('span', { style: { minWidth: '92px', fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-primary, #1f2328)' } }, pair[0]),",
  "        React.createElement('span', null, pair[1]))),",
  '      React.createElement(\'button\', {',
  '        type: \'button\',',
  "        'data-polish-ws-help-close': 'true',",
  '        style: Object.assign({}, WS_ROW_ACTION, { width: \'auto\', padding: \'0 10px\', marginTop: \'10px\', height: \'24px\' }),',
  "        onClick: () => setHelpOpen(false),",
  "      }, 'Close')))),",
  '    )',
  '    : null',
  '  const helpHint = !helpSeen && !helpOpen',
  '    ? React.createElement(\'div\', {',
  "        'data-polish-ws-help-hint': 'true',",
  "        style: { padding: '2px 6px 4px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, #8a8f98)' },",
  '      },',
  "      'Press ', React.createElement('kbd', null, '?'), ' for the shortcuts.')",
  '    : null',
  '',
  anchor,
].join('\n')
src = src.replace(anchor, sheet)

fs.writeFileSync(p, src)
console.log('shortcut sheet built')
