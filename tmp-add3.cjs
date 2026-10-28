const fs = require('node:fs')
const p = 'client/workspace.js'
let lines = fs.readFileSync(p, 'utf8').split('\n')

// 1) remove the block that landed inside the style object
const start = lines.findIndex(line => line.includes("'data-polish-ws': 'header'"))
if (start < 0) { console.log('no header to remove'); process.exit(1) }
let end = start
while (!lines[end].includes('      : null,')) end++
lines.splice(start, end - start + 1)

// 2) insert it as the first child, after the tree div's style object closes
const overflow = lines.findIndex(line => line.includes("overflowY: 'auto',"))
let close = overflow
while (!/^\s{2}\},\s*$/.test(lines[close])) close++
const block = [
  "    React.createElement('div', { 'data-polish-ws': 'header', style: WS_HEADER },",
  "      React.createElement('span', { style: WS_HEADER_TITLE }, 'Workspaces'),",
  "      React.createElement('button', {",
  "        type: 'button',",
  "        'data-polish-ws-add': 'true',",
  "        title: 'Add a workspace',",
  "        'aria-label': 'Add a workspace',",
  "        style: WS_ADD,",
  "        onClick: () => { setAdding(true); setNotice('') },",
  "      }, '+')),",
  "    notice ? React.createElement('div', { 'data-polish-ws': 'notice', style: WS_NOTICE }, notice) : null,",
  "    adding && services.sourceFlow",
  "      ? React.createElement(services.sourceFlow, {",
  "        configForms: services.configForms(),",
  "        open: true,",
  "        onPicked: async (path) => {",
  "          if (!path) return",
  "          try {",
  "            await services.createWorkspace(path)",
  "            setAdding(false)",
  "          } catch (error) {",
  "            setNotice((error && error.message) || 'Could not add that folder.')",
  "          }",
  "        },",
  "        onCancel: () => setAdding(false),",
  "        onError: (message) => setNotice(message || 'Could not add that folder.'),",
  "      })",
  "      : null,",
]
lines.splice(close + 1, 0, ...block)
fs.writeFileSync(p, lines.join('\n'))
console.log('block moved to first child (after line ' + (close + 1) + ')')
