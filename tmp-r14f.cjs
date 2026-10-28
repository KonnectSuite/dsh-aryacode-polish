const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const from = `            startSession: (workspaceId) => {
              const ui = seated.ctx.get('uiWorkspace') || seated.uiWorkspace
              if (!ui || typeof ui.startSession !== 'function') throw new Error('no workspace navigation here')
              return ui.startSession(workspaceId)
            },`
const to = `            startSession: (workspaceId) => {
              /* the injected scope is not a ctx: read the service from the plugin's own ctx */
              const ui = ctx.get('uiWorkspace') || seated.uiWorkspace
              if (!ui || typeof ui.startSession !== 'function') throw new Error('no workspace navigation here')
              return ui.startSession(workspaceId)
            },`
if (!src.includes(from)) throw new Error('anchor missing')
src = src.replace(from, to)
fs.writeFileSync(p, src)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.22.4'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', log.replace('## [', '## [0.22.4] - 2026-10-28\n\nFixed: the workspace navigation service is read from the plugin context, because the injected scope refuses property reads it did not name.\n\n## ['))
console.log('0.22.4 ready')
