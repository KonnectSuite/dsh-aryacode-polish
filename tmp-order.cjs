const fs = require('node:fs')
const lines = fs.readFileSync('client/workspace.js', 'utf8').split('\n')
lines.forEach((line, at) => {
  if (/data-polish-ws-empty-tree|const rows =|const allRows =|const treeMenuItems =|children.push\(React.createElement\('div', \{$/.test(line)) {
    console.log((at + 1) + ': ' + line.trim().slice(0, 100))
  }
})
