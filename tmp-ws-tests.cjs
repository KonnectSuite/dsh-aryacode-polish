const fs = require('node:fs')

// 1. unit tests for appearance
let spec = fs.readFileSync('test/workspace.spec.mjs', 'utf8')
spec = spec.replace(`  moveBefore,`, `  moveBefore,
  TONE_ORDER,
  TONE_COLOR,
  appearanceOf,
  withAppearance,
  readAppearance,
  writeAppearance,`)
spec += `
describe('appearance', () => {
  it('keeps a tone and a weight per workspace', () => {
    const one = withAppearance({}, 'ws1', { tone: 'blue' })
    assert.deepEqual(appearanceOf(one, 'ws1'), { tone: 'blue', strong: false })
    const two = withAppearance(one, 'ws1', { strong: true })
    assert.deepEqual(appearanceOf(two, 'ws1'), { tone: 'blue', strong: true })
    assert.deepEqual(appearanceOf(one, 'ws1'), { tone: 'blue', strong: false }, 'the first map is untouched')
  })

  it('drops an entry once nothing is left to say', () => {
    const painted = withAppearance({}, 'ws1', { tone: 'rose' })
    const cleared = withAppearance(painted, 'ws1', { tone: undefined })
    assert.deepEqual(cleared, {})
  })

  it('ignores a tone it does not know', () => {
    assert.equal(appearanceOf({ ws1: { tone: 'chartreuse' } }, 'ws1').tone, undefined)
    assert.equal(appearanceOf(undefined, 'ws1').strong, false)
  })

  it('offers six tones in a fixed order, each with a colour', () => {
    assert.deepEqual(TONE_ORDER, ['slate', 'blue', 'green', 'amber', 'rose', 'violet'])
    for (const tone of TONE_ORDER) assert.match(TONE_COLOR[tone], /^#[0-9a-f]{6}$/)
  })

  it('round-trips through a storage shim and survives a broken one', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    const map = withAppearance({}, 'ws1', { tone: 'green', strong: true })
    writeAppearance(map, storage)
    assert.deepEqual(readAppearance(storage), map)
    assert.deepEqual(readAppearance({ getItem: () => '{not json', setItem: () => {} }), {})
    assert.deepEqual(readAppearance(undefined), {})
  })
})
`
fs.writeFileSync('test/workspace.spec.mjs', spec)

// 2. bundle assertions
let face = fs.readFileSync('test/client-face.spec.mjs', 'utf8')
if (!face.includes("conversation.hero.workspace")) {
  face = face.replace(`const bundle = readFileSync(`, `const workspaceSource = readFileSync(new URL('../client/workspace.js', import.meta.url), 'utf8')\nconst bundle = readFileSync(`)
  face += `
test('the workspace seat also offers the Hero picker, with the same colours', () => {
  assert.ok(bundle.includes('conversation.hero.workspace'), 'the Hero seat is registered')
  assert.ok(bundle.includes('data-polish-hero'), 'the picker marks its rows')
  assert.ok(bundle.includes('data-polish-tone'), 'the palette exposes one button per tone')
  assert.ok(workspaceSource.includes('aryacode-polish:workspace-appearance'), 'the palette has a storage key')
  assert.ok(workspaceSource.includes('writeAppearance(next)'), 'a colour is written when it is chosen')
})
`
  fs.writeFileSync('test/client-face.spec.mjs', face)
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.version = '0.12.0'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log('tests + version ready: ' + pkg.version)
