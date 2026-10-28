const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('unfiled')) { console.log('already'); process.exit(0) }
src = src.replace("  fileUnder,\n", "  fileUnder,\n  unfiled,\n")
src += `
describe('lifting a workspace back out of a folder', () => {
  it('drops the folder prefix and nothing else', () => {
    assert.equal(unfiled('Work/Alpha'), 'Alpha')
    assert.equal(unfiled('A/B/Gamma'), 'Gamma')
    assert.equal(unfiled('Alpha'), 'Alpha')
    assert.equal(unfiled(''), '')
    assert.equal(unfiled('/'), '')
  })

  it('round-trips with fileUnder', () => {
    assert.equal(fileUnder(unfiled('Work/Alpha'), 'Team'), 'Team/Alpha')
  })
})
`
fs.writeFileSync(p, src)
console.log('unfiled tests added')
