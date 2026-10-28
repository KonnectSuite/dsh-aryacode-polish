const fs = require('node:fs')
const p = 'client/switches.json'
const doc = JSON.parse(fs.readFileSync(p, 'utf8'))
if (!doc.switches.some(s => s.key === 'betterWorkspace')) {
  doc.switches.push({
    key: 'betterWorkspace',
    label: 'Better workspace',
    description: 'Replace the sidebar workspace list with our own tree: workspaces with their sessions, a right-click menu on a workspace (open, copy path, remove), and the shipped session menu inside it.',
    defaultOn: true,
  })
  fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n')
}
const reg = 'entries/registry.js'
let src = fs.readFileSync(reg, 'utf8')
if (!src.includes("id: 'betterWorkspace'")) {
  src = src.replace(
    /(\n\s*\{\s*\n\s*id: 'panelScreenshot')/,
    `
  {
    id: 'betterWorkspace',
    label: 'Better workspace',
    description: 'Replace the sidebar workspace list with our own tree, with a right-click menu on every workspace.',
    defaultOn: true,
  },$1`,
  )
  fs.writeFileSync(reg, src)
}
console.log('switches: ' + doc.switches.map(s => s.key).join(', '))
console.log('registry has betterWorkspace: ' + fs.readFileSync(reg, 'utf8').includes("id: 'betterWorkspace'"))
