const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  "          const services = {\n            ctx: seated,",
  "          const services = {\n            ctx: seated,\n            configForms,\n            sourceFlow: extras.sourceFlow,",
)
src = src.replace(
  "            openSession: (id) => seated.uiWorkspace.openSession(id),",
  "            openSession: (id) => seated.uiWorkspace.openSession(id),\n            createWorkspace: (path) => seated.workspaces.create({ path }),",
)
fs.writeFileSync(p, src)
console.log('configForms+sourceFlow: ' + src.includes('sourceFlow: extras.sourceFlow'))
console.log('createWorkspace: ' + src.includes('createWorkspace: (path)'))
