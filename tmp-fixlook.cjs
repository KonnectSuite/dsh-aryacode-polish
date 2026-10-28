const fs = require('node:fs')
let s = fs.readFileSync('tmp-look.cjs', 'utf8')
s = s.replace(`swap(\`        {workspaceMenu}
        {sessionMenu}\`, \`        {workspaceMenu}
        {paintMenu}
        {sessionMenu}\`)`, `swap(\`  sessionMenu,
  workspaceMenu)\`, \`  sessionMenu,
  paintMenu,
  workspaceMenu)\`)`)
fs.writeFileSync('tmp-look.cjs', s)
console.log('patch script fixed')
