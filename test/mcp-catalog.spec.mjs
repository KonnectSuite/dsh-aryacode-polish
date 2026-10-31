/**
 * The bundled MCP catalog: every entry has to be usable, because the page turns
 * one into a server with a single click.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'

import { MCP_CATALOG, MCP_CATEGORIES, catalogEntry, catalogEnvFields, draftFromCatalog, searchCatalog } from '../mcp/catalog.js'
import { normalizeServer } from '../mcp/validate.js'

test('the catalog is a non-empty, well-formed list', () => {
  assert.ok(MCP_CATALOG.length >= 30, 'the catalog should be worth browsing')
  const ids = new Set()
  for (const entry of MCP_CATALOG) {
    assert.equal(typeof entry.id, 'string')
    assert.equal(ids.has(entry.id), false, `duplicate catalog id ${entry.id}`)
    ids.add(entry.id)
    assert.ok(entry.name.length > 0, `${entry.id} needs a name`)
    assert.ok(entry.description.length > 10, `${entry.id} needs a description`)
    assert.ok(['stdio', 'streamable-http'].includes(entry.transport), `${entry.id} has an unknown transport`)
    assert.ok(MCP_CATEGORIES.some(category => category.id === entry.category), `${entry.id} has an unknown category`)
    if (entry.transport === 'stdio') {
      assert.equal(typeof entry.command, 'string')
      assert.ok(entry.command.length > 0)
      assert.ok(Array.isArray(entry.args))
    } else {
      assert.match(entry.url, /^https?:\/\//)
    }
    for (const variable of entry.env ?? []) {
      assert.equal(typeof variable.key, 'string')
      assert.ok(variable.key.length > 0)
      assert.equal(typeof variable.label, 'string')
      assert.equal(typeof variable.secret, 'boolean')
      assert.equal(typeof variable.required, 'boolean')
    }
  }
})

test('every catalog entry becomes a draft the validator accepts', () => {
  for (const entry of MCP_CATALOG) {
    const draft = draftFromCatalog(entry)
    const { server, errors } = normalizeServer(draft, { existing: [] })
    assert.deepEqual(errors, [], `${entry.id} would not save: ${JSON.stringify(errors)}`)
    assert.equal(server.source, `catalog:${entry.id}`)
    assert.equal(server.category, entry.category)
  }
})

test('catalog drafts leave secrets to the user', () => {
  const github = catalogEntry('github')
  const draft = draftFromCatalog(github, { GITHUB_PERSONAL_ACCESS_TOKEN: 'abc' })
  assert.equal(draft.env.GITHUB_PERSONAL_ACCESS_TOKEN, 'abc')
  assert.deepEqual(catalogEnvFields(github).map(field => field.key), ['GITHUB_PERSONAL_ACCESS_TOKEN'])
  const empty = draftFromCatalog(github)
  assert.deepEqual(empty.env, {})
})

test('search matches name, publisher, description and tags', () => {
  assert.ok(searchCatalog('playwright').some(entry => entry.id === 'playwright'))
  assert.ok(searchCatalog('MODELCONTEXTPROTOCOL').some(entry => entry.id === 'filesystem'))
  assert.ok(searchCatalog('sql').some(entry => entry.id === 'postgres'))
  assert.equal(searchCatalog('zzzz-not-a-server').length, 0)
  assert.deepEqual(
    searchCatalog('', 'search').map(entry => entry.id).sort(),
    ['brave-search', 'exa', 'google-maps', 'tavily'],
  )
})

test('catalogEntry answers by id and nothing else', () => {
  assert.equal(catalogEntry('filesystem').name, 'Filesystem')
  assert.equal(catalogEntry('nope'), undefined)
})
