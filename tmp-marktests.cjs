const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('markOf')) { console.log('already'); process.exit(0) }
src = src.replace("  unfiled,\n", "  unfiled,\n  markOf,\n  withMark,\n  readMarks,\n  writeMarks,\n  treeText,\n")
src += `
describe('session marks and the tree as text', () => {
  it('keeps a flag and a note, and drops what is cleared', () => {
    const map = withMark({}, 's1', { flag: true, note: 'look here' })
    assert.deepEqual(markOf(map, 's1'), { flag: true, note: 'look here' })
    assert.deepEqual(markOf(withMark(map, 's1', { flag: false }), 's1'), { flag: false, note: 'look here' })
    assert.deepEqual(withMark(withMark(map, 's1', { flag: false, note: '' }), 's1', {}).s1, undefined)
    assert.deepEqual(markOf(undefined, 'nope'), { flag: false, note: undefined })
  })

  it('round-trips marks and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeMarks({ s1: { flag: true } }, storage)
    assert.deepEqual(readMarks(storage), { s1: { flag: true } })
    assert.deepEqual(readMarks({ getItem: () => 'nope', setItem: () => {} }), {})
    assert.deepEqual(readMarks(undefined), {})
  })

  it('writes the tree as indented text', () => {
    const rows = [
      { workspace: { workspaceId: 'w1', title: 'Work/Alpha' }, sessions: [{ id: 's1', displayTitle: 'First' }, { id: 's2', displayTitle: 'Second' }] },
      { workspace: { workspaceId: 'w2', title: 'Loose' }, sessions: [] },
    ]
    const text = treeText(rows, ['Work'], (id) => markOf({ s2: { flag: true } }, id))
    assert.equal(text, 'Work\\n  Work/Alpha\\n    First\\n    ⚑ Second\\nLoose')
  })
})
`
fs.writeFileSync(p, src)
console.log('mark tests added')
