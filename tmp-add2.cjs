const fs = require('node:fs')
const p = 'client/workspace.js'
const lines = fs.readFileSync(p, 'utf8').split('\n')
// insert the header + add flow just before the tree container at line 418 (1-based)
const at = 417
if (!lines[at].includes("'data-polish-ws': 'tree'")) {
  console.log('anchor moved: ' + lines[at].trim())
  process.exit(1)
}
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
// styles used by the header
const styleBlock = [
  "const WS_HEADER = { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 4px 4px' }",
  "const WS_HEADER_TITLE = { flex: 1, minWidth: 0, fontSize: 'calc(' + \"var(--dsh-content-font-size-secondary, 13px)\" + ' - 2px)', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--dsw-alias-label-quaternary, #8a8a8a)' }",
  "const WS_ADD = { flex: 'none', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', fontSize: '15px', lineHeight: 1, borderRadius: 'var(--dsw-radius-sm)', cursor: 'pointer' }",
  "const WS_NOTICE = { margin: '0 4px 6px', fontSize: 'calc(' + \"var(--dsh-content-font-size-secondary, 13px)\" + ' - 2px)', color: 'var(--dsw-alias-label-secondary)' }",
]
const treeIndex = lines.findIndex(line => line.startsWith('const WS_TREE'))
lines.splice(treeIndex, 0, ...styleBlock)
lines.splice(at + styleBlock.length, 0, ...block)
fs.writeFileSync(p, lines.join('\n'))
console.log('inserted header at ' + at)
