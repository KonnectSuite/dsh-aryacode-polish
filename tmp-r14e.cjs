const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

swap(`            startSession: (workspaceId) => seated.uiWorkspace.startSession(workspaceId),`,
`            startSession: (workspaceId) => {
              const ui = seated.ctx.get('uiWorkspace') || seated.uiWorkspace
              if (!ui || typeof ui.startSession !== 'function') throw new Error('no workspace navigation here')
              return ui.startSession(workspaceId)
            },`)

swap(`      onClick: (event) => {
        event.stopPropagation()
        services.startSession(workspace.workspaceId)
      },`,
`      onClick: (event) => {
        event.stopPropagation()
        try {
          services.startSession(workspace.workspaceId)
          setNotice('Started a session.')
        } catch (error) {
          setNotice((error && error.message) || 'Could not start a session.')
        }
      },`)

fs.writeFileSync(p, src)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.22.3'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', log.replace('## [', '## [0.22.3] - 2026-10-28\n\nFixed: starting a session from a workspace row resolved the navigation service at click time and reports what happened instead of failing silently.\n\n## ['))
console.log('patched to 0.22.3')
