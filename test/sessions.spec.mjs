import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readSubagentSessions } from '../entries/sessions.js'

/** A ctx whose session controller answers the given list items. */
function ctxWith(items) {
  return {
    get(name) {
      if (name !== 'sessionController') return undefined
      return { list: async () => ({ items }) }
    },
  }
}

describe('the subagent route', () => {
  it('reports only the sessions that carry a parent link', async () => {
    const answer = await readSubagentSessions(ctxWith([
      { sessionId: 'root-a', parentSessionId: undefined },
      { sessionId: 'child-a', parentSessionId: 'root-a' },
      { sessionId: 'root-b' },
      { sessionId: 'child-b', parentSessionId: 'root-b' },
    ]))
    assert.equal(answer.total, 4)
    assert.deepEqual(answer.items, [
      { id: 'child-a', parent: 'root-a' },
      { id: 'child-b', parent: 'root-b' },
    ])
  })

  it('answers empty when there is no controller, or nothing is linked', async () => {
    assert.deepEqual(await readSubagentSessions({ get: () => undefined }), { total: 0, items: [] })
    const plain = await readSubagentSessions(ctxWith([{ sessionId: 'a' }, { sessionId: 'b' }]))
    assert.deepEqual(plain, { total: 2, items: [] })
  })

  it('ignores an empty parent string', async () => {
    const answer = await readSubagentSessions(ctxWith([{ sessionId: 'a', parentSessionId: '' }]))
    assert.deepEqual(answer.items, [])
  })
})
