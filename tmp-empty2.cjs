const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const start = s.indexOf('  if (rows.length === 0 && !query.trim()) {')
const end = s.indexOf('  children.push(React.createElement(\'div\', {\n    key: \'header\',', start)
if (start < 0 || end < 0) throw new Error('empty block bounds not found')
// keep the block but let the tree decide from live data it already renders
const replacement = `  if (rows.length === 0 && allRows.length === 0 && !query.trim()) {
    children.push(React.createElement('div', {
      key: 'empty',
      'data-polish-ws-empty-tree': 'true',
      style: WS_MENU_HINT,
    }, 'No workspaces yet.'))
    children.push(React.createElement('button', {
      key: 'empty-add',
      type: 'button',
      'data-polish-ws-empty-add': 'true',
      style: WS_EMPTY_ADD,
      onClick: () => { setAdding(true); setNotice('') },
    }, 'Add a workspace'))
  }

`
s = s.slice(0, start) + replacement + s.slice(end)
fs.writeFileSync(p, s)
console.log('condition now requires allRows to be empty too')
