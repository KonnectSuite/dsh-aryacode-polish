/**
 * The review lenses this bundle ships as skills.
 *
 * Two things are worth pinning: the files are valid skills the filesystem provider
 * will accept (front-matter it parses, name matching the directory), and the
 * preset actually mounts the provider over this directory — a skill that is not
 * discovered is a file nobody reads.
 */
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildDefinition } from '../presets/arya-standard/definition.js'
import { skillsDirectory } from '../presets/arya-standard/files.js'

const SKILLS = ['review', 'review-security', 'review-bugs']

/** Split a SKILL.md into its front-matter map and body. */
function parseSkill(path) {
  const raw = readFileSync(path, 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  assert.ok(match, `${path} has no front-matter`)
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (field !== null) fields[field[1]] = field[2].trim()
  }
  return { fields, body: match[2] }
}

test('every lens is a discoverable skill with the fields the provider needs', () => {
  for (const name of SKILLS) {
    const path = join(skillsDirectory(), name, 'SKILL.md')
    assert.ok(existsSync(path), `missing ${path}`)
    const { fields, body } = parseSkill(path)
    assert.equal(fields.name, name, 'the name matches the directory the provider derives it from')
    assert.ok(fields.description.length > 40, `${name} needs a usable description`)
    assert.ok(body.trim().length > 400, `${name} body is too thin to be a lens`)
    // Both surfaces stay open: a person can invoke the lens, and so can the model
    // when the user asks for a review in prose.
    assert.equal(fields['disable-model-invocation'], 'false')
    assert.equal(fields['user-invocable'], 'true')
  }
})

test('the router names both lenses and refuses to run both at once', () => {
  const { body } = parseSkill(join(skillsDirectory(), 'review', 'SKILL.md'))
  assert.ok(body.includes('review-security'))
  assert.ok(body.includes('review-bugs'))
  assert.ok(/exactly one|only one|Do not review "both"/i.test(body), 'the router must pick one lens')
  assert.ok(/did not examine|Not examined/i.test(body), 'a review must name its blind spots')
})

test('each lens reports findings in the documented shape', () => {
  for (const name of ['review-security', 'review-bugs']) {
    const { body } = parseSkill(join(skillsDirectory(), name, 'SKILL.md'))
    assert.ok(/\[severity\]/i.test(body), `${name} needs the finding shape`)
    assert.ok(/path:line/i.test(body), `${name} must require a location`)
    assert.ok(/Not examined/i.test(body), `${name} must name what it did not read`)
  }
})

test('the preset mounts a second skill provider over only this directory', () => {
  const definition = buildDefinition()
  const row = definition.plugins.find((plugin) => plugin.id === 'arya-review-skills')
  assert.ok(row, 'the row is missing from the preset')
  assert.equal(row.name, '@deepseek-ai/dsh-skill-filesystem')
  assert.equal(row.config.providerName, 'arya-review', 'a second provider owns its own name')
  assert.equal(row.config.includeDefaultRoots, false, 'the shipped provider keeps the project and user roots')
  assert.equal(row.config.watch, false, 'a packaged directory does not change at runtime')
  assert.deepEqual(row.config.customSkillDirs, [skillsDirectory()])
  for (const name of SKILLS) {
    assert.ok(existsSync(join(row.config.customSkillDirs[0], name, 'SKILL.md')))
  }
})

test('every preset derived from Arya Standard carries the lenses', async () => {
  const { buildDefinition: qwen } = await import('../presets/arya-qwen/definition.js')
  // Arya Automation Engineer moved to @aryacode/dsh-engineering, where its own test now checks this.
  for (const definition of [buildDefinition(), qwen()]) {
    assert.ok(
      definition.plugins.some((plugin) => plugin.id === 'arya-review-skills'),
      `${definition.id} is missing the review skill provider`,
    )
  }
})
