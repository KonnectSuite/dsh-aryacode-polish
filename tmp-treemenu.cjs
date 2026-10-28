const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const need = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }

// 1. pure defaults
need('export function actionEntries(rows) {', 'actionEntries')
s = s.replace('export function actionEntries(rows) {', `/**
 * The state a tree starts from. Reset uses it verbatim, and the test asserts it, because a "reset"
 * that quietly leaves one thing set is worse than no reset at all.
 */
export function treeDefaults() {
  return { query: '', expanded: {}, folders: {}, density: 'comfortable', sort: 'host' }
}

export function actionEntries(rows) {`)

// 2. header menu opener
need("  children.push(React.createElement('div', { key: 'header', 'data-polish-ws': 'header', style: WS_HEADER },",
  'header')
s = s.replace("  children.push(React.createElement('div', { key: 'header', 'data-polish-ws': 'header', style: WS_HEADER },",
`  children.push(React.createElement('div', {
    key: 'header',
    'data-polish-ws': 'header',
    style: WS_HEADER,
    onContextMenu: (event) => {
      event.preventDefault()
      setMenu({ kind: 'tree', anchor: { top: event.clientY, left: Math.max(8, event.clientX - 40) } })
    },
  },`)

// 3. the menu body, before the tree return
need('  const switcherCard = switcher', 'switcherCard')
s = s.replace('  const switcherCard = switcher', `  const treeMenu = menu && menu.kind === 'tree'
    ? ReactDOM.createPortal(React.createElement('div', {
      'data-polish-ws-menu': 'tree',
      'data-polish-tree-menu': 'open',
      style: Object.assign({}, WS_MENU, { position: 'fixed', top: menu.anchor.top, left: menu.anchor.left }),
    },
    React.createElement('button', {
      type: 'button',
      'data-polish-tree-copy': 'true',
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); copyTree() },
    }, 'Copy the tree'),
    React.createElement('button', {
      type: 'button',
      'data-polish-tree-fold': 'true',
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); foldAll() },
    }, allFolded ? 'Expand everything' : 'Fold everything'),
    ...DENSITIES.map((each) => React.createElement('button', {
      key: 'density:' + each,
      type: 'button',
      'data-polish-tree-density': each,
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); setDensity(each); writeDensity(each) },
    }, (densityOf(density) === each ? '\\u2713 ' : '') + DENSITY_TITLES[each])),
    ...SORTS.map((each) => React.createElement('button', {
      key: 'sort:' + each,
      type: 'button',
      'data-polish-tree-sort': each,
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); setSort(each); writeSort(each) },
    }, (sortOf(sort) === each ? '\\u2713 ' : '') + (each === 'name' ? 'Sort A to Z' : 'Host order'))),
    React.createElement('button', {
      type: 'button',
      'data-polish-tree-reset': 'true',
      style: WS_MENU_ITEM,
      onClick: () => {
        const defaults = treeDefaults()
        setMenu(null)
        setQuery(defaults.query)
        setExpanded(defaults.expanded)
        setFolders(defaults.folders)
        setDensity(defaults.density)
        writeDensity(defaults.density)
        setSort(defaults.sort)
        writeSort(defaults.sort)
        setCursor(-1)
        setNotice('Reset the tree.')
      },
    }, 'Reset the tree'),
    React.createElement('button', {
      type: 'button',
      'data-polish-tree-help': 'true',
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); setHelpOpen(true); writeHelp(true); setHelpSeen(true) },
    }, 'Show the shortcuts'))), document.body)
    : null

  const switcherCard = switcher`)

// 4. render it
need('  paintMenu,\n  workspaceMenu)', 'tree tail')
s = s.replace('  paintMenu,\n  workspaceMenu)', '  paintMenu,\n  treeMenu,\n  workspaceMenu)')

fs.writeFileSync(p, s)
console.log('tree menu wired')
