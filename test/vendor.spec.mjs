import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * The face bundle carries one third-party library, so the rules around it get
 * their own spec: it must be the real upstream build, it must ship in the
 * tarball, and the build script must be what puts it in the bundle.
 */

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const vendor = readFileSync(new URL('vendor/html2canvas.min.js', root))

test('the vendored rasteriser is the real build and ships in the tarball', () => {
  assert.ok(vendor.length > 100_000, 'the vendored file is the upstream build, not a stub')
  assert.ok(
    vendor.subarray(0, 200).toString('utf8').includes('html2canvas'),
    'the vendored file carries the library banner, so its origin stays identifiable',
  )
  assert.ok(
    manifest.files.includes('vendor/**/*'),
    'vendor/ has to be in "files" or the installed plugin has no rasteriser',
  )
  assert.equal(
    manifest.devDependencies.html2canvas,
    '1.4.1',
    'the vendored copy is pinned to the version the build expects',
  )
  assert.equal(
    manifest.dependencies?.html2canvas,
    undefined,
    'the rasteriser is inlined, so it must not become a runtime dependency the profile has to install',
  )
})

test('the build inlines the vendored rasteriser into the face bundle', () => {
  const build = readFileSync(new URL('scripts/build-client.mjs', root), 'utf8')
  assert.ok(build.includes("readFileSync(new URL('vendor/html2canvas.min.js', root)"), 'the build reads the vendored file')
  const bundle = readFileSync(new URL('lib/client.js', root), 'utf8')
  assert.ok(bundle.includes('html2canvas'), 'the emitted bundle carries the rasteriser')
  assert.ok(bundle.length > 200_000, 'the emitted bundle is the face plus the rasteriser')
})
