const fs = require('node:fs')
const src = fs.readFileSync('client/workspace.js', 'utf8')
new Function('React', 'ReactDOM', 'document', src.replace(/^export /gm, ''))
console.log('parses')
