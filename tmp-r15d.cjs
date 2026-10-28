const fs = require('node:fs')
const p = 'test/workspace.spec.mjs'
let s = fs.readFileSync(p, 'utf8')
if (!s.includes('withPreset')) {
  s = s.replace("  markOf,\n", "  markOf,\n  lookOf,\n  withPreset,\n  withoutPreset,\n  presetNames,\n  readPresets,\n  writePresets,\n")
  s += `
describe('appearance presets', () => {
  it('keeps tone, weight and glyph but never the note', () => {
    const look = lookOf({ w1: { tone: 'blue', strong: true, glyph: '🚀', note: 'private' } }, 'w1')
    assert.deepEqual(look, { tone: 'blue', strong: true, glyph: '🚀' })
  })

  it('adds, replaces and forgets a preset by name', () => {
    let map = withPreset({}, '  Rocket  ', { tone: 'rose', glyph: '🚀' })
    assert.deepEqual(presetNames(map), ['Rocket'])
    map = withPreset(map, 'Rocket', { tone: 'green' })
    assert.deepEqual(map.Rocket, { tone: 'green', strong: false, glyph: undefined })
    assert.deepEqual(withoutPreset(map, 'Rocket'), {})
  })

  it('refuses an empty look and an empty name', () => {
    assert.deepEqual(withPreset({}, 'Nothing', {}), {})
    assert.deepEqual(withPreset({}, '   ', { tone: 'blue' }), {})
  })

  it('round-trips presets and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writePresets({ Rocket: { tone: 'blue' } }, storage)
    assert.deepEqual(readPresets(storage), { Rocket: { tone: 'blue' } })
    assert.deepEqual(readPresets({ getItem: () => '{oops', setItem: () => {} }), {})
  })
})
`
  fs.writeFileSync(p, s)
  console.log('tests added')
} else console.log('already')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.23.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
const log = fs.readFileSync('CHANGELOG.md', 'utf8')
fs.writeFileSync('CHANGELOG.md', log.replace('## [', '## [0.23.0] - 2026-10-28\n\nAdded: save a workspace look as a named preset and apply it to another workspace from its menu.\n\n## ['))
