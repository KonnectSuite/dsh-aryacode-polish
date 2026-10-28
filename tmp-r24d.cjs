const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// attach the hint under the filter and the sheet beside the other portals
const hintAnchor = `  if (notice) {`
if (!src.includes(hintAnchor)) throw new Error('notice anchor missing')
src = src.replace(hintAnchor, `  if (helpHint) children.push(helpHint)

${hintAnchor}`)

const attachAnchor = `    switcherCard,`
if (!src.includes(attachAnchor)) throw new Error('attach anchor missing')
src = src.replace(attachAnchor, `    switcherCard,
    helpCard,`)

// a header ? button too, so the sheet is reachable with a mouse
const headerAnchor = `    React.createElement('button', {
      type: 'button',
      'data-polish-ws-add': 'true',`
if (!src.includes(headerAnchor)) throw new Error('header add anchor missing')
src = src.replace(headerAnchor, `    React.createElement('button', {
      type: 'button',
      'data-polish-ws-help-open': 'true',
      title: 'Workspace shortcuts',
      'aria-label': 'Workspace shortcuts',
      style: WS_ADD,
      onClick: () => { writeHelp(true); setHelpSeen(true); setHelpOpen(true) },
    }, '?'),
${headerAnchor}`)

fs.writeFileSync(p, src)
console.log('hint, sheet and header button attached')
