const fs = require('node:fs')
const src = fs.readFileSync('client/workspace.js', 'utf8')
try {
  new Function('React', 'ReactDOM', 'document', src.replace(/^export /gm, ''))
  console.log('parses')
} catch (error) {
  console.log('PARSE FAIL: ' + error.message)
  const lines = src.split('\n')
  const m = /line (\d+)/.exec(String(error.stack || ''))
  if (m) console.log('near: ' + lines[Number(m[1]) - 1])
}
