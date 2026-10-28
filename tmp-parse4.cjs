const fs = require('node:fs')
new Function('React', 'ReactDOM', 'document', fs.readFileSync('client/workspace.js', 'utf8').replace(/^export /gm, ''))
console.log('parses')
