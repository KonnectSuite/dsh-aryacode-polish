import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filterTree,
  flattenRows,
  moveBefore,
  menuRuntime,
  rowMenuEntries,
  workspaceLabel,
  sessionRank,
  shippedBrowserEntry,
  workspaceRows,
} from '../client/workspace.js'

const session = (id, title, updatedAt) => ({ id, displayTitle: title, updatedAt })

describe('the better workspace tree', () => {
  it('reorders only on a real timestamp, because the Host list order is the display order', () => {
    const list = [session('a', 'alpha', 1), session('c', 'charlie', 9), session('b', 'bravo', 9)]
    assert.deepEqual(list.slice().sort(sessionRank).map(row => row.displayTitle), ['charlie', 'bravo', 'alpha'])
    const untimed = [{ id: 'z', displayTitle: 'z' }, { id: 'y', displayTitle: 'y' }]
    assert.deepEqual(untimed.slice().sort(sessionRank).map(row => row.id), ['z', 'y'])
  })

  it('pairs each workspace with the sessions it owns, keeping the Host order', () => {
    const rows = workspaceRows(
      [{ workspaceId: 'w1', title: 'One', sessionIds: ['s1', 's2'] }],
      [session('s1', 'older'), session('s2', 'newer')],
    )
    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].sessions.map(row => row.displayTitle), ['older', 'newer'])
  })

  it('drops sessions that are no longer in the list instead of rendering holes', () => {
    const rows = workspaceRows([{ workspaceId: 'w1', title: 'One', sessionIds: ['gone'] }], [])
    assert.deepEqual(rows[0].sessions, [])
  })

  it('survives a workspace with no sessionIds at all', () => {
    const rows = workspaceRows([{ workspaceId: 'w1', title: 'One' }], [session('s1', 'x', 1)])
    assert.deepEqual(rows[0].sessions, [])
  })
})

describe('reading the shipped registration', () => {
  const slotsWith = (entries) => ({
    entries: key => (key === 'sidebar.workspaces' ? entries : []),
  })

  it('finds the shipped browser and ignores our own shadow', () => {
    const shipped = { options: { name: 'sidebar.workspaces' }, children: {} }
    const ours = { options: { name: 'sidebar.workspaces', priority: -1 } }
    assert.equal(shippedBrowserEntry(slotsWith([ours, shipped])), shipped)
  })

  it('reports nothing while only our shadow is registered', () => {
    assert.equal(shippedBrowserEntry(slotsWith([{ options: { priority: -1 } }])), undefined)
  })
})

describe('menu runtime', () => {
  const slots = {
    entries: key => {
      if (key === 'sidebar.workspaces') {
        return [{
          options: { name: 'sidebar.workspaces' },
          children: {
            'sidebar.workspaces.session.menu.item': {
              inject: { hooks: { menuOpenState: (_standard, context) => () => context } },
            },
          },
          inject: () => ({ copySessionId: () => {} }),
        }]
      }
      if (key === 'sidebar.workspaces.session.menu.item') {
        return [
          { component: () => null, options: { id: 'rename', order: 200 } },
          { component: () => null, options: { id: 'pin', order: 100 } },
        ]
      }
      return []
    },
  }
  const ctx = { get: () => ({ bind: ns => key => `${ns}:${key}` }) }

  it('hands a row its own open-state pair through the owner hook factory', () => {
    const runtime = menuRuntime(ctx, slots, { wide: true })
    const pair = [true, () => {}]
    assert.equal(runtime.bindHook(pair)(), pair)
  })

  it('passes the owner inject face to the occupants', () => {
    const runtime = menuRuntime(ctx, slots, { wide: true })
    assert.equal(typeof runtime.injected.copySessionId, 'function')
  })

  it('binds labels to the occupant namespace', () => {
    const runtime = menuRuntime(ctx, slots, { wide: true })
    assert.equal(runtime.translate('ui-workspace')('menu.pin'), 'ui-workspace:menu.pin')
  })

  it('falls back to the identity hook when there is no factory', () => {
    const bare = { entries: () => [] }
    const runtime = menuRuntime({ get: () => undefined }, bare, { wide: false })
    const pair = [false, () => {}]
    assert.equal(runtime.bindHook(pair)(), pair)
  })

  it('sorts the shipped occupants by their declared order', () => {
    assert.deepEqual(rowMenuEntries(slots).map(entry => entry.options.id), ['pin', 'rename'])
  })

  it('keeps pinned sessions first and the Host order otherwise', () => {
    const rows = filterTree(
      [{ workspace: { workspaceId: 'w', title: 'W' }, sessions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }],
      '',
      new Set(['c']),
    )
    assert.deepEqual(rows[0].sessions.map(row => row.id), ['c', 'a', 'b'])
  })

  it('filters by workspace label and by session title', () => {
    const input = [
      { workspace: { workspaceId: 'w1', title: 'Alpha' }, sessions: [{ id: 's1', displayTitle: 'session one' }, { id: 's2', displayTitle: 'other' }] },
      { workspace: { workspaceId: 'w2', title: 'Beta' }, sessions: [{ id: 's3', displayTitle: 'session two' }] },
    ]
    const bySession = filterTree(input, 'session', new Set())
    assert.deepEqual(bySession.map(row => row.workspace.workspaceId), ['w1', 'w2'])
    assert.deepEqual(bySession[0].sessions.map(row => row.id), ['s1'])
    const byWorkspace = filterTree(input, 'beta', new Set())
    assert.deepEqual(byWorkspace.map(row => row.workspace.workspaceId), ['w2'])
    assert.deepEqual(byWorkspace[0].sessions.map(row => row.id), ['s3'])
    assert.deepEqual(filterTree(input, 'nothing here', new Set()), [])
  })

  it('opens every kept group while filtering, so a match is always visible', () => {
    const rows = [{ workspace: { workspaceId: 'w' }, sessions: [{ id: 's1' }, { id: 's2' }] }]
    const folded = { w: false }
    assert.deepEqual(flattenRows(rows, folded, '').map(item => item.kind), ['workspace'])
    assert.deepEqual(flattenRows(rows, folded, 's').map(item => item.kind), ['workspace', 'session', 'session'])
    assert.deepEqual(flattenRows(rows, {}, '').map(item => item.id), ['w', 's1', 's2'])
  })

  it('moves a row in front of another without losing it', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    assert.deepEqual(moveBefore(list, 'c', 'a').map(row => row.id), ['c', 'a', 'b'])
    assert.deepEqual(moveBefore(list, 'a', 'c').map(row => row.id), ['b', 'a', 'c'])
    assert.deepEqual(moveBefore(list, 'a', 'missing'), list)
    assert.deepEqual(moveBefore(list, 'a', 'a'), list)
  })

  it('humanises a workspace whose title merely repeats its id', () => {
    assert.equal(workspaceLabel({ workspaceId: 'default-workspace1', title: 'default-workspace1' }), 'Default workspace1')
    assert.equal(workspaceLabel({ workspaceId: 'w', title: 'Rockwell line' }), 'Rockwell line')
    assert.equal(workspaceLabel({ workspaceId: '' }), 'Workspace')
  })
})
