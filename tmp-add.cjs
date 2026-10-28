const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// readable workspace label
src = src.replace(
  `React.createElement('span', { style: WS_TITLE, title: workspace.path || workspace.title }, workspace.title || workspace.workspaceId),`,
  `React.createElement('span', { style: WS_TITLE, title: workspace.path || workspace.title }, workspaceLabel(workspace)),`,
)

// header with the Add control, and the source menu it opens
src = src.replace(
  `    React.createElement('div', { 'data-polish-ws': 'tree', style: WS_TREE },`,
  `    React.createElement('div', { 'data-polish-ws': 'header', style: WS_HEADER },
      React.createElement('span', { style: WS_HEADER_TITLE }, 'Workspaces'),
      React.createElement('button', {
        type: 'button',
        'data-polish-ws-add': 'true',
        title: 'Add a workspace',
        'aria-label': 'Add a workspace',
        style: WS_ADD,
        onClick: () => { setAdding(true); setNotice('') },
      }, '+')),
    notice
      ? React.createElement('div', { 'data-polish-ws': 'notice', style: WS_NOTICE }, notice)
      : null,
    adding && services.sourceFlow
      ? React.createElement(services.sourceFlow, {
        configForms: services.configForms(),
        open: true,
        onPicked: async (path) => {
          if (!path) return
          try {
            await services.createWorkspace(path)
            setAdding(false)
          } catch (error) {
            setNotice((error && error.message) || 'Could not add that folder.')
          }
        },
        onCancel: () => setAdding(false),
        onError: (message) => setNotice(message || 'Could not add that folder.'),
      })
      : null,
    React.createElement('div', { 'data-polish-ws': 'tree', style: WS_TREE },`,
)
fs.writeFileSync(p, src)
console.log('label wired: ' + src.includes('workspaceLabel(workspace)'))
console.log('add button: ' + src.includes("'data-polish-ws-add': 'true'"))
