const fs = require('node:fs')
// empty state when there is nothing to show
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const need = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }
need('  const treeMenuItems = () => {', 'treeMenuItems')
s = s.replace(`  children.push(React.createElement('div', {
    key: 'header',`, `  if (rows.length === 0 && !query.trim()) {
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

  children.push(React.createElement('div', {
    key: 'header',`)
need('const WS_HERO = {', 'WS_HERO')
s = s.replace('const WS_HERO = {', `const WS_EMPTY_ADD = Object.assign({}, WS_MENU_ITEM, {
  alignSelf: 'flex-start',
  marginTop: '2px',
})

const WS_HERO = {`)
fs.writeFileSync(p, s)
console.log('empty state added')

// specs
const t = 'test/workspace.spec.mjs'
let spec = fs.readFileSync(t, 'utf8')
if (!spec.includes('treeDefaults')) {
  spec = spec.replace('  actionEntries,', '  actionEntries,\n  treeDefaults,')
  spec += `
it('a reset really resets every view knob', () => {
  const defaults = treeDefaults()
  assert.deepEqual(Object.keys(defaults).sort(), ['density', 'expanded', 'folders', 'query', 'sort'])
  assert.equal(defaults.query, '')
  assert.deepEqual(defaults.expanded, {})
  assert.deepEqual(defaults.folders, {})
  assert.equal(defaults.density, 'comfortable')
  assert.equal(defaults.sort, 'host')
})
`
  fs.writeFileSync(t, spec)
}
const f = 'test/client-face.spec.mjs'
let face = fs.readFileSync(f, 'utf8')
if (!face.includes('data-polish-tree-reset')) {
  face = face.replace(/^test\(/m, `test('the header menu names every tree action, and can reset the view', () => {
  assert.match(workspaceSource, /'data-polish-ws-menu': 'tree'/)
  assert.match(workspaceSource, /'data-polish-tree-density'/)
  assert.match(workspaceSource, /'data-polish-tree-sort'/)
  assert.match(workspaceSource, /'data-polish-tree-reset'/)
  assert.match(workspaceSource, /treeDefaults\\(\\)/)
  assert.match(workspaceSource, /'data-polish-ws-empty-tree'/)
})

test(`)
  fs.writeFileSync(f, face)
}
console.log('specs added')
