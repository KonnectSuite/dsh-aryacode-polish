const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. hint line under the filter
if (!src.includes('if (helpHint)')) {
  const i = src.indexOf('  if (notice) {')
  if (i < 0) throw new Error('notice anchor missing')
  src = src.slice(0, i) + '  if (helpHint) children.push(helpHint)\n\n' + src.slice(i)
}

// 2. the sheet joins the portals at the tree's tail
if (!src.includes('  helpCard,')) {
  const i = src.indexOf('\n  switcherCard,\n')
  if (i < 0) throw new Error('portal tail anchor missing')
  src = src.slice(0, i) + '\n  switcherCard,\n  helpCard,' + src.slice(i + '\n  switcherCard,'.length)
}

// 3. a ? button in the header
if (!src.includes("'data-polish-ws-help-open'")) {
  const i = src.indexOf("      key: 'add',")
  if (i < 0) throw new Error('header add anchor missing')
  const button = [
    "    React.createElement('button', {",
    "      key: 'help',",
    "      type: 'button',",
    "      'data-polish-ws-help-open': 'true',",
    "      title: 'Workspace shortcuts',",
    "      'aria-label': 'Workspace shortcuts',",
    '      style: WS_ADD,',
    '      onClick: () => { writeHelp(true); setHelpSeen(true); setHelpOpen(true) },',
    "    }, '?'),",
    '',
  ].join('\n')
  src = src.slice(0, i) + button + src.slice(i)
}

fs.writeFileSync(p, src)
console.log('attached')
