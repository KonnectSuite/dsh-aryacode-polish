const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('fileUnder')) { console.log('already'); process.exit(0) }
src = src.replace("  folderKey,\n", "  folderKey,\n  fileUnder,\n")
src += `
describe('filing a workspace under a folder', () => {
  it('moves the workspace name behind the folder prefix', () => {
    assert.equal(fileUnder('Alpha', 'Work'), 'Work/Alpha')
    assert.equal(fileUnder('Work/Alpha', 'Work'), 'Work/Alpha')
    assert.equal(fileUnder('Old/Alpha', 'Work'), 'Work/Alpha')
  })

  it('files a nested workspace under the folder that received it, not under its old parent', () => {
    assert.equal(fileUnder('A/B/Gamma', 'C'), 'C/Gamma')
  })

  it('leaves odd input alone instead of inventing a prefix', () => {
    assert.equal(fileUnder('', 'Work'), '')
    assert.equal(fileUnder('Alpha', ''), 'Alpha')
    assert.equal(fileUnder('Work/', 'Team'), 'Team')
  })
})
`
fs.writeFileSync(p, src)
console.log('fileUnder tests added')
