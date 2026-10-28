const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let body = fs.readFileSync(p, 'utf8')
body = body
  .replace("test('sumCost adds up", "it('sumCost adds up")
  .replace("test('sumCost keeps", "it('sumCost keeps")
  .replace("test('sumCost says", "it('sumCost says")
fs.writeFileSync(p, body)
console.log('spec uses it()')
