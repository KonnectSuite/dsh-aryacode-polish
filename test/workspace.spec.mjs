import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filterTree,
  flattenRows,
  moveBefore,
  folderKey,
  rankMatches,
  readFolded,
  writeFolded,
  planReorder,
  readOrder,
  writeOrder,
  TONE_ORDER,
  TONE_COLOR,
  appearanceOf,
  withAppearance,
  readAppearance,
  writeAppearance,
  menuRuntime,
  rowMenuEntries,
  workspaceLabel,
  sessionRank,
  shippedBrowserEntry,
  workspaceRows,  densityOf,
  readDensity,
  writeDensity,
  splitArchived,

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

describe('folders and order presets', () => {
  it('files a slashed title under its prefix', () => {
    assert.equal(folderKey({ title: 'Work/Client A', workspaceId: 'a' }), 'Work')
    assert.equal(folderKey({ title: 'Work/Deep/Client B', workspaceId: 'b' }), 'Work/Deep')
    assert.equal(folderKey({ title: 'plain', workspaceId: 'c' }), undefined)
    assert.equal(folderKey({ title: 'trailing/', workspaceId: 'd' }), undefined)
    assert.equal(folderKey({ title: '/leading', workspaceId: 'e' }), undefined)
  })

  it('plans the moves that turn one order into another', () => {
    assert.deepEqual(planReorder(['a', 'b', 'c'], ['a', 'b', 'c']), [])
    assert.deepEqual(planReorder(['a', 'b', 'c'], ['c', 'a', 'b']), [{ movingId: 'c', beforeId: 'a' }])
    assert.deepEqual(planReorder(['a', 'b', 'c'], ['b', 'a', 'c']), [{ movingId: 'b', beforeId: 'a' }])
  })

  it('never moves something it does not have', () => {
    assert.deepEqual(planReorder(['a'], ['z', 'a']), [])
    assert.deepEqual(planReorder([], ['a']), [])
    assert.deepEqual(planReorder(['a', 'b'], []), [])
  })

  it('round-trips a saved order through storage and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeOrder(['a', 'b'], storage)
    assert.deepEqual(readOrder(storage), ['a', 'b'])
    assert.deepEqual(readOrder({ getItem: () => '{"nope":1}', setItem: () => {} }), [])
    assert.deepEqual(readOrder(undefined), [])
  })
})

describe('quick switcher and folded state', () => {
  it('ranks prefix matches above contains matches, keeping arrival order inside a rank', () => {
    const items = [
      { id: 'a', title: 'Regression check' },
      { id: 'b', title: 'Greeting' },
      { id: 'c', title: 'gre' },
    ]
    // 'Greeting' and 'gre' both start with the query, so arrival order decides
    // between them; 'Regression check' only mentions it later and falls behind.
    assert.deepEqual(rankMatches(items, 'gre').map(i => i.id), ['b', 'c', 'a'])
  })

  it('returns the first rows for an empty query and nothing for a miss', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: String(i), title: 'row ' + i }))
    assert.equal(rankMatches(items, '').length, 40)
    assert.deepEqual(rankMatches(items, 'zzz'), [])
    assert.deepEqual(rankMatches(undefined, 'x'), [])
  })

  it('matches on the workspace label when a caller passes its own text', () => {
    const items = [{ id: 'a', title: 'ok', workspace: 'KonnectSuite' }]
    assert.deepEqual(rankMatches(items, 'konnect', item => item.workspace), items)
  })

  it('round-trips folded state and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeFolded({ workspaces: { w1: false }, folders: { Work: true } }, storage)
    assert.deepEqual(readFolded(storage), { workspaces: { w1: false }, folders: { Work: true } })
    assert.deepEqual(readFolded({ getItem: () => 'nope{', setItem: () => {} }), { workspaces: {}, folders: {} })
    assert.deepEqual(readFolded(undefined), { workspaces: {}, folders: {} })
  })
})

describe('density and the archived section', () => {
  const memoryStorage = () => {
    const memory = new Map()
    return { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
  }

  it('reads comfort by default and survives junk', () => {
    assert.equal(densityOf(undefined), 'comfortable')
    assert.equal(densityOf('compact'), 'compact')
    assert.equal(densityOf('cozy'), 'comfortable')
    assert.equal(readDensity(undefined), 'comfortable')
    assert.equal(readDensity({ getItem: () => 'cozy', setItem: () => {} }), 'comfortable')
    assert.equal(readDensity({ getItem: () => { throw new Error('locked') }, setItem: () => {} }), 'comfortable')
  })

  it('remembers the chosen density', () => {
    const storage = memoryStorage()
    writeDensity('compact', storage)
    assert.equal(readDensity(storage), 'compact')
    writeDensity('comfortable', storage)
    assert.equal(readDensity(storage), 'comfortable')
    assert.doesNotThrow(() => writeDensity('compact', undefined))
  })

  it('splits archived sessions out of the rows a workspace shows', () => {
    const sessions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    assert.deepEqual(splitArchived(sessions, ['b']), { active: [{ id: 'a' }, { id: 'c' }], archived: [{ id: 'b' }] })
    assert.deepEqual(splitArchived(sessions, new Set(['c'])), { active: [{ id: 'a' }, { id: 'b' }], archived: [{ id: 'c' }] })
    assert.deepEqual(splitArchived(sessions, undefined), { active: sessions, archived: [] })
    assert.deepEqual(splitArchived(undefined, ['a']), { active: [], archived: [] })
  })
})
