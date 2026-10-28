/**
 * Documentation the Plugins page and the release depend on.
 *
 * The card's title and description come from `locale/`, not from the row, and a
 * locale that drifts from `en` renders raw keys in the other language. The
 * changelog heading is matched against `package.json` so a version bump cannot
 * ship without its entry.
 */
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (relative) => readFileSync(new URL(relative, root), 'utf8')
const pkg = JSON.parse(read('package.json'))
const en = JSON.parse(read('locale/en.json'))
const zh = JSON.parse(read('locale/zh.json'))

const flatten = (value, prefix = '') =>
  Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      ? flatten(entry, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

test('the card carries a title and a description', () => {
  assert.equal(en.meta.title, 'AryaCode Polish')
  assert.ok(en.meta.description.length > 0)
})

test('every locale has exactly the keys en has', () => {
  assert.deepEqual(flatten(zh).sort(), flatten(en).sort())
})

test('the README documents the row and the feature seam', () => {
  const readme = read('README.md')
  assert.match(readme, /^## Switches$/m, 'the README needs a Switches section')
  assert.ok(readme.includes('polish'), 'the README must name the row id')
  assert.ok(readme.includes('entries/registry.js'), 'the README must point at the one place a feature is declared')
})

test('a parked investigation is kept beside the code', () => {
  assert.ok(
    existsSync(new URL('docs/parked-spellcheck.md', root)),
    'the spelling-corrections finding must stay reviewable',
  )
})

test('the changelog carries the shipped version', () => {
  const changelog = read('CHANGELOG.md')
  assert.ok(
    changelog.includes(`## [${pkg.version}]`),
    `CHANGELOG.md needs a "## [${pkg.version}]" heading`,
  )
})

test('the README does not hard-code a version', () => {
  // The packaged README is the card's page body, so a version written into its
  // prose is stale the moment the next release ships — which is exactly how
  // 0.3.5 shipped a page still describing 0.2.0. The version belongs in the
  // manifest and the page header, not in the prose.
  const readme = read('README.md')
  assert.ok(!/Status:[^\n]*\d+\.\d+\.\d+/.test(readme), 'the status line must not name a version')
})

test('the handoff describes the shipped package, not a plan', () => {
  // HANDOFF.md once told the next agent the repo was private and had "no package
  // scaffold yet", and that npm must never be the channel. All three were false
  // by the time it was read, and each cost time. Keep the briefing current.
  const handoff = read('HANDOFF.md')
  assert.ok(handoff.includes(pkg.name), 'the handoff must name the shipped package')
  for (const stale of ['No package scaffold yet', 'Never publish from npm', '(private)']) {
    assert.ok(!handoff.includes(stale), `HANDOFF.md still claims "${stale}"`)
  }
})

test('the README lists every switch the row exposes', () => {
  const readme = read('README.md')
  const switches = JSON.parse(read('client/switches.json')).switches

  switches.forEach((entry) => {
    assert.ok(readme.includes(entry.label), 'the README is missing the ' + entry.label + ' switch')
  })
})

test('the README has no stale feature count', () => {
  const readme = read('README.md')
  assert.doesNotMatch(readme, /\*\*(one|two|three|four|five|six|seven|eight|nine|ten) features shipped\*\*/i)
})
