const fs = require('node:fs')
// hand the source flow and the workspace creator to the seat
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
src = src.replace(
  "export function installWorkspaceSeat(ctx, configForms) {",
  "export function installWorkspaceSeat(ctx, configForms, extras = {}) {",
)
src = src.replace(
  "        slots, ctx,",
  "        slots, ctx,\n        sourceFlow: extras.sourceFlow,\n        configForms,",
)
fs.writeFileSync(p, src)
console.log('extras wired: ' + src.includes('extras.sourceFlow'))
const q = 'client/face.js'
let face = fs.readFileSync(q, 'utf8')
face = face.replace(
  "  installWorkspaceSeat(ctx, configForms)",
  "  installWorkspaceSeat(ctx, configForms, { sourceFlow: WorkspaceSourceFlow })",
)
fs.writeFileSync(q, face)
console.log('face passes flow: ' + face.includes('{ sourceFlow: WorkspaceSourceFlow }'))
