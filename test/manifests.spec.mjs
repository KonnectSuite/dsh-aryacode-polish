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
})

test('the bundle declares which Harness it runs on', () => {
  // The market reads `dsh.engines.dsh` to decide compatibility, and an install
  // onto an older Host fails at mount time with a stack the user cannot read.
  // Declaring the range makes the card honest and the install refusable.
  const range = pkg.dsh?.engines?.dsh
  assert.equal(typeof range, 'string', 'dsh.engines.dsh names the Harness range this bundle was built against')
  assert.match(range, /^[\^~]?\d+\.\d+\.\d+/, `"${range}" must be a semver range`)
})

test('runtime dependencies are only what the host cannot supply', () => {
  // `zod` is the harness's own schema library, pinned by every projection in the
  // tree, but it is not part of the Shell's frozen client module table and is not
  // hoisted into a profile, so the bundle installs its own copy. Anything else
  // here would mean the bundle duplicates the host; keep the list to that one.
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ['zod'], 'only zod may be a runtime dependency')
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
