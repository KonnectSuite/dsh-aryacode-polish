const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let src = fs.readFileSync(p, 'utf8')
if (src.includes('glyph and note')) { console.log('already there'); process.exit(0) }
src = src.replace("  splitArchived,\n", "  splitArchived,\n  appearanceOf,\n  withAppearance,\n  GLYPHS,\n")
src += `
describe('glyph and note', () => {
  it('keeps a glyph and a note beside the tone', () => {
    const map = withAppearance({}, 'w1', { tone: 'blue', strong: true, glyph: '🚀', note: 'release work' })
    assert.deepEqual(appearanceOf(map, 'w1'), { tone: 'blue', strong: true, glyph: '🚀', note: 'release work' })
    assert.deepEqual(map.w1, { tone: 'blue', strong: true, glyph: '🚀', note: 'release work' })
  })

  it('drops a field that is cleared without losing the others', () => {
    const map = withAppearance({}, 'w1', { tone: 'green', glyph: '🐍', note: 'python' })
    const noGlyph = withAppearance(map, 'w1', { glyph: '' })
    assert.deepEqual(appearanceOf(noGlyph, 'w1'), { tone: 'green', strong: false, glyph: undefined, note: 'python' })
    const bare = withAppearance(withAppearance(noGlyph, 'w1', { tone: undefined, note: '' }), 'w1', {})
    assert.equal(bare.w1, undefined)
  })

  it('refuses a glyph that is not a short badge', () => {
    const map = withAppearance({}, 'w1', { glyph: 'this is far too long to be a badge' })
    assert.equal(appearanceOf(map, 'w1').glyph, undefined)
    assert.equal(appearanceOf(withAppearance({}, 'w1', { glyph: 'ok' }), 'w1').glyph, 'ok')
  })

  it('offers a picker palette', () => {
    assert.ok(Array.isArray(GLYPHS) && GLYPHS.length >= 8)
    for (const glyph of GLYPHS) assert.ok(glyph.length <= 4, glyph + ' is a badge, not a sentence')
  })
})
`
fs.writeFileSync(p, src)
console.log('glyph tests added')
