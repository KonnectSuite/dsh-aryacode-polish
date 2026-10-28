const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const startMark = '  const treeMenu = menu && menu.kind === \'tree\''
const endMark = '  const switcherCard = switcher'
const from = s.indexOf(startMark)
const to = s.indexOf(endMark)
if (from < 0 || to < 0 || to < from) throw new Error('block bounds not found')
const fresh = `  const treeMenu = menu && menu.kind === 'tree'
    ? ReactDOM.createPortal(
      React.createElement('div', {
        'data-polish-ws-menu': 'tree',
        'data-polish-tree-menu': 'open',
        style: Object.assign({}, WS_MENU, { position: 'fixed', top: menu.anchor.top, left: menu.anchor.left }),
      }, treeMenuItems()),
      document.body,
    )
    : null

`
s = s.slice(0, from) + fresh + s.slice(to)

// the item list, built as an array so no paren counting is involved
const anchor = '  const treeMenu = menu && menu.kind === \'tree\''
s = s.replace(anchor, `  const treeMenuItems = () => {
    const items = []
    items.push(React.createElement('button', {
      key: 'copy',
      type: 'button',
      'data-polish-tree-copy': 'true',
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); copyTree() },
    }, 'Copy the tree'))
    items.push(React.createElement('button', {
      key: 'fold',
      type: 'button',
      'data-polish-tree-fold': 'true',
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); foldAll() },
    }, allFolded ? 'Expand everything' : 'Fold everything'))
    DENSITIES.forEach((each) => {
      const mark = densityOf(density) === each ? '\\u2713 ' : ''
      items.push(React.createElement('button', {
        key: 'density:' + each,
        type: 'button',
        'data-polish-tree-density': each,
        style: WS_MENU_ITEM,
        onClick: () => { setMenu(null); setDensity(each); writeDensity(each) },
      }, mark + DENSITY_TITLES[each]))
    })
    SORTS.forEach((each) => {
      const mark = sortOf(sort) === each ? '\\u2713 ' : ''
      items.push(React.createElement('button', {
        key: 'sort:' + each,
        type: 'button',
        'data-polish-tree-sort': each,
        style: WS_MENU_ITEM,
        onClick: () => { setMenu(null); setSort(each); writeSort(each) },
      }, mark + (each === 'name' ? 'Sort A to Z' : 'Host order')))
    })
    items.push(React.createElement('button', {
      key: 'reset',
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
    }, 'Reset the tree'))
    items.push(React.createElement('button', {
      key: 'help',
      type: 'button',
      'data-polish-tree-help': 'true',
      style: WS_MENU_ITEM,
      onClick: () => { setMenu(null); setHelpOpen(true); writeHelp(true); setHelpSeen(true) },
    }, 'Show the shortcuts'))
    return items
  }

  const treeMenu = menu && menu.kind === 'tree'`)

fs.writeFileSync(p, s)
console.log('tree menu rebuilt from an item array')
