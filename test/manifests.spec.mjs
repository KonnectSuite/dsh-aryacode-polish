/**
 * The published package shape.
 *
 * The row is only installable if the declared entry points exist and the tarball
 * actually carries them: `files` controls what `pnpm pack` includes, and a
 * missing `lib/index.js` fails at mount time inside the user's profile, not at
 * pack time.
 */
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const exists = (relative) => existsSync(new URL(relative, root))

test('the package is the polish bundle', () => {
  assert.equal(pkg.name, '@aryacode/dsh-aryacode-polish')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.license, 'MIT')
})

test('the bundle declares its composition patch', () => {
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.ok(exists('cordis.patch.yml'))
})

test('the mount point exists where the exports promise it', () => {
  const main = pkg.exports['.']
  assert.equal(main.types, './lib/index.d.ts')
  assert.equal(main.default, './lib/index.js')
  assert.ok(exists('lib/index.js'), 'lib/index.js is the row mount point')
  assert.ok(exists('lib/index.d.ts'))
})

test('the tarball carries every file the row needs', () => {
  const files = pkg.files ?? []
  for (const required of ['cordis.patch.yml', 'entries/**/*', 'lib/**/*', 'locale/*.json', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
    assert.ok(files.includes(required), `files must include ${required}`)
  }
})

test('the peer dependency is the host Cordis range', () => {
  assert.ok(pkg.peerDependencies?.['@deepseek-ai/cordis'], 'cordis is a peer, not a dependency')
  assert.ok(!pkg.dependencies, 'a bundle ships no runtime dependencies of its own')
})

test('dependency specs are registry ranges, never local paths or URLs', () => {
  const specs = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies }
  for (const [name, spec] of Object.entries(specs)) {
    assert.ok(
      !/^(file:|link:|workspace:|git\+|https?:)/.test(spec),
      `${name} uses "${spec}", which breaks installs with ERR_PNPM_EXOTIC_SUBDEP`,
    )
  }
})
