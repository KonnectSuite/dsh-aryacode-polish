import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  menuRuntime,
  rowMenuEntries,
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
})
