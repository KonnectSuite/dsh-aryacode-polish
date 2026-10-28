import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  folderLookOf,
  withFolderLook,
  FOLDER_LOOK_PREFIX,
  filterTree,
  flattenRows,
  moveBefore,
  folderKey,
  addFolder,
  removeFolder,
  readFolders,
  writeFolders,
  folderNamesOf,
  fileUnder,
  unfiled,
  markOf,
  sortRows,
  sortOf,
  readSort,
  writeSort,
  lookOf,
  withPreset,
  withoutPreset,
  presetNames,
  readPresets,
  writePresets,
  DENSITY_GLYPHS,
  DENSITY_METRICS,
  DENSITY_TITLES,
  jumpWorkspace,
  nextDensity,
  withMark,
  readMarks,
  writeMarks,
  treeText,
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
  workspaceRows,
  densityOf,
  readDensity,
  writeDensity,
  splitArchived,
  splitPinned,
  costOf,
  costLabel, sumCost, folderHasRunning, readHelp, writeHelp, sumCostLabel,
  GLYPHS,
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
    assert.deepEqual(appearanceOf(one, 'ws1'), { tone: 'blue', strong: false, glyph: undefined, note: undefined })
    const two = withAppearance(one, 'ws1', { strong: true })
    assert.deepEqual(appearanceOf(two, 'ws1'), { tone: 'blue', strong: true, glyph: undefined, note: undefined })
    assert.deepEqual(appearanceOf(one, 'ws1'), { tone: 'blue', strong: false, glyph: undefined, note: undefined }, 'the first map is untouched')
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

describe('glyph and note', () => {
  it('keeps a glyph and a note beside the tone', () => {
    const map = withAppearance({}, 'w1', { tone: 'blue', strong: true, glyph: '🚀', note: 'release work' })
    assert.deepEqual(appearanceOf(map, 'w1'), { tone: 'blue', strong: true, glyph: '🚀', note: 'release work' })
    assert.deepEqual(map.w1, { tone: 'blue', strong: true, glyph: '🚀', note: 'release work' })
  })

  it('drops a field that is cleared without losing the others', () => {
    const map = withAppearance({}, 'w1', { tone: 'green', glyph: '🐍', note: 'python' })
    const noGlyph = withAppearance(map, 'w1', { glyph: '' })
    assert.deepEqual(appearanceOf(noGlyph, 'w1'), { tone: 'green', strong: false, glyph: undefined, note: 'python' })
    const bare = withAppearance(withAppearance(noGlyph, 'w1', { tone: undefined, note: '' }), 'w1', {})
    assert.equal(bare.w1, undefined)
  })

  it('refuses a glyph that is not a short badge', () => {
    const map = withAppearance({}, 'w1', { glyph: 'this is far too long to be a badge' })
    assert.equal(appearanceOf(map, 'w1').glyph, undefined)
    assert.equal(appearanceOf(withAppearance({}, 'w1', { glyph: 'ok' }), 'w1').glyph, 'ok')
  })

  it('offers a picker palette', () => {
    assert.ok(Array.isArray(GLYPHS) && GLYPHS.length >= 8)
    for (const glyph of GLYPHS) assert.ok(glyph.length <= 4, glyph + ' is a badge, not a sentence')
  })
})

describe('filing a workspace under a folder', () => {
  it('moves the workspace name behind the folder prefix', () => {
    assert.equal(fileUnder('Alpha', 'Work'), 'Work/Alpha')
    assert.equal(fileUnder('Work/Alpha', 'Work'), 'Work/Alpha')
    assert.equal(fileUnder('Old/Alpha', 'Work'), 'Work/Alpha')
  })

  it('files a nested workspace under the folder that received it, not under its old parent', () => {
    assert.equal(fileUnder('A/B/Gamma', 'C'), 'C/Gamma')
  })

  it('leaves odd input alone instead of inventing a prefix', () => {
    assert.equal(fileUnder('', 'Work'), '')
    assert.equal(fileUnder('Alpha', ''), 'Alpha')
    assert.equal(fileUnder('Work/', 'Team'), 'Team')
  })
})

describe('folders that exist before their content', () => {
  it('adds a folder once, refusing empties, dupes and nesting', () => {
    assert.deepEqual(addFolder([], 'Work'), ['Work'])
    assert.deepEqual(addFolder(['Work'], 'Work'), ['Work'])
    assert.deepEqual(addFolder(['Work'], '  '), ['Work'])
    assert.deepEqual(addFolder(['Work'], 'A/B'), ['Work'], 'a folder name is one segment')
    assert.deepEqual(addFolder(['Work'], '/Team/'), ['Work', 'Team'], 'stray slashes are trimmed')
    assert.deepEqual(addFolder(['a', 'b'], 'c'), ['a', 'b', 'c'], 'order is kept')
  })

  it('removes only the named folder', () => {
    assert.deepEqual(removeFolder(['a', 'b'], 'a'), ['b'])
    assert.deepEqual(removeFolder(['a', 'b'], 'zz'), ['a', 'b'])
    assert.deepEqual(removeFolder(['a'], ''), ['a'])
  })

  it('round-trips and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeFolders(['Work', 'Team'], storage)
    assert.deepEqual(readFolders(storage), ['Work', 'Team'])
    assert.deepEqual(readFolders({ getItem: () => 'not json', setItem: () => {} }), [])
    assert.deepEqual(readFolders({ getItem: () => '{"a":1}', setItem: () => {} }), [])
    assert.deepEqual(readFolders(undefined), [])
  })

  it('draws declared folders after the implied ones', () => {
    const rows = [{ workspace: { workspaceId: 'w1', title: 'Work/Alpha' } }]
    assert.deepEqual(folderNamesOf(rows, ['Team', 'Work']), ['Work', 'Team'])
    assert.deepEqual(folderNamesOf([], ['Solo']), ['Solo'])
    assert.deepEqual(folderNamesOf(rows, []), ['Work'])
  })
})

describe('lifting a workspace back out of a folder', () => {
  it('drops the folder prefix and nothing else', () => {
    assert.equal(unfiled('Work/Alpha'), 'Alpha')
    assert.equal(unfiled('A/B/Gamma'), 'Gamma')
    assert.equal(unfiled('Alpha'), 'Alpha')
    assert.equal(unfiled(''), '')
    assert.equal(unfiled('/'), '')
  })

  it('round-trips with fileUnder', () => {
    assert.equal(fileUnder(unfiled('Work/Alpha'), 'Team'), 'Team/Alpha')
  })
})

describe('session marks and the tree as text', () => {
  it('keeps a flag and a note, and drops what is cleared', () => {
    const map = withMark({}, 's1', { flag: true, note: 'look here' })
    assert.deepEqual(markOf(map, 's1'), { flag: true, note: 'look here' })
    assert.deepEqual(markOf(withMark(map, 's1', { flag: false }), 's1'), { flag: false, note: 'look here' })
    assert.deepEqual(withMark(withMark(map, 's1', { flag: false, note: '' }), 's1', {}).s1, undefined)
    assert.deepEqual(markOf(undefined, 'nope'), { flag: false, note: undefined })
  })

  it('round-trips marks and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeMarks({ s1: { flag: true } }, storage)
    assert.deepEqual(readMarks(storage), { s1: { flag: true } })
    assert.deepEqual(readMarks({ getItem: () => 'nope', setItem: () => {} }), {})
    assert.deepEqual(readMarks(undefined), {})
  })

  it('writes the tree as indented text', () => {
    const rows = [
      { workspace: { workspaceId: 'w1', title: 'Work/Alpha' }, sessions: [{ id: 's1', displayTitle: 'First' }, { id: 's2', displayTitle: 'Second' }] },
      { workspace: { workspaceId: 'w2', title: 'Loose' }, sessions: [] },
    ]
    const text = treeText(rows, ['Work'], (id) => markOf({ s2: { flag: true } }, id))
    assert.equal(text, 'Work\n  Work/Alpha\n    First\n    ⚑ Second\nLoose')
  })
})

describe('folder density and workspace hopping', () => {
  const walk = [
    { kind: 'workspace', id: 'w1', workspaceId: 'w1' },
    { kind: 'session', id: 's1', workspaceId: 'w1' },
    { kind: 'session', id: 's2', workspaceId: 'w1' },
    { kind: 'workspace', id: 'w2', workspaceId: 'w2' },
    { kind: 'session', id: 's3', workspaceId: 'w2' },
    { kind: 'workspace', id: 'w3', workspaceId: 'w3' },
  ]

  it('hops forward and backward between workspace heads, wrapping', () => {
    assert.equal(jumpWorkspace(walk, -1, 1), 0)
    assert.equal(jumpWorkspace(walk, 0, 1), 3)
    assert.equal(jumpWorkspace(walk, 2, 1), 3)
    assert.equal(jumpWorkspace(walk, 3, 1), 5)
    assert.equal(jumpWorkspace(walk, 5, 1), 0)
    assert.equal(jumpWorkspace(walk, 3, -1), 0)
    assert.equal(jumpWorkspace(walk, 0, -1), 5)
    assert.equal(jumpWorkspace([], 0, 1), -1)
    assert.equal(jumpWorkspace([{ kind: 'session', id: 's' }], -1, 1), -1)
  })

  it('cycles comfortable -> compact -> folders -> comfortable', () => {
    assert.equal(nextDensity('comfortable'), 'compact')
    assert.equal(nextDensity('compact'), 'folders')
    assert.equal(nextDensity('folders'), 'comfortable')
    assert.equal(nextDensity('nonsense'), 'compact')
  })

  it('hides sessions in the folders density but keeps workspaces', () => {
    assert.equal(DENSITY_METRICS.folders.sessions, false)
    assert.equal(DENSITY_METRICS.compact.sessions, true)
    assert.ok(DENSITY_GLYPHS.folders.length > 0)
    assert.ok(DENSITY_TITLES.folders.length > 0)
  })
})

describe('appearance presets', () => {
  it('keeps tone, weight and glyph but never the note', () => {
    const look = lookOf({ w1: { tone: 'blue', strong: true, glyph: '🚀', note: 'private' } }, 'w1')
    assert.deepEqual(look, { tone: 'blue', strong: true, glyph: '🚀' })
  })

  it('adds, replaces and forgets a preset by name', () => {
    let map = withPreset({}, '  Rocket  ', { tone: 'rose', glyph: '🚀' })
    assert.deepEqual(presetNames(map), ['Rocket'])
    map = withPreset(map, 'Rocket', { tone: 'green' })
    assert.deepEqual(map.Rocket, { tone: 'green', strong: false, glyph: undefined })
    assert.deepEqual(withoutPreset(map, 'Rocket'), {})
  })

  it('refuses an empty look and an empty name', () => {
    assert.deepEqual(withPreset({}, 'Nothing', {}), {})
    assert.deepEqual(withPreset({}, '   ', { tone: 'blue' }), {})
  })

  it('round-trips presets and survives junk', () => {
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writePresets({ Rocket: { tone: 'blue' } }, storage)
    assert.deepEqual(readPresets(storage), { Rocket: { tone: 'blue' } })
    assert.deepEqual(readPresets({ getItem: () => '{oops', setItem: () => {} }), {})
  })
})

describe('workspace sort modes', () => {
  const rows = [
    { workspace: { workspaceId: 'a', path: 'C:/zulu', title: 'zulu', sessionIds: [] }, sessions: [] },
    { workspace: { workspaceId: 'b', path: 'C:/Work/alpha', title: 'Work/alpha', sessionIds: [] }, sessions: [] },
    { workspace: { workspaceId: 'c', path: 'C:/mike', title: 'mike', sessionIds: [] }, sessions: [] },
    { workspace: { workspaceId: 'd', path: 'C:/Work/bravo', title: 'Work/bravo', sessionIds: [] }, sessions: [] },
  ]

  it('leaves the host order alone unless asked', () => {
    assert.deepEqual(sortRows(rows, 'host').map(r => r.workspace.workspaceId), ['a', 'b', 'c', 'd'])
    assert.deepEqual(sortRows(rows, undefined).map(r => r.workspace.workspaceId), ['a', 'b', 'c', 'd'])
  })

  it('sorts unfiled workspaces first, then by folder, then by name', () => {
    assert.deepEqual(sortRows(rows, 'name').map(r => r.workspace.workspaceId), ['c', 'a', 'b', 'd'])
  })

  it('keeps a folder group together', () => {
    const ordered = sortRows(rows, 'name')
    const folders = ordered.map(r => (r.workspace.title.includes('/') ? r.workspace.title.split('/')[0] : ''))
    assert.deepEqual(folders, ['', '', 'Work', 'Work'])
  })

  it('falls back to host order for an unknown mode and round-trips storage', () => {
    assert.equal(sortOf('sideways'), 'host')
    const memory = new Map()
    const storage = { getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, v) }
    writeSort('name', storage)
    assert.equal(readSort(storage), 'name')
    assert.equal(readSort({ getItem: () => 'nonsense', setItem: () => {} }), 'host')
  })
})

describe('pinned sessions', () => {
  const sessions = [
    { id: 's1', displayTitle: 'one' },
    { id: 's2', displayTitle: 'two' },
    { id: 's3', displayTitle: 'three' },
  ]

  it('lifts pinned sessions out of their workspace, in order', () => {
    const split = splitPinned(sessions, ['s3', 's1'])
    assert.deepEqual(split.pinned.map(s => s.id), ['s1', 's3'])
    assert.deepEqual(split.rest.map(s => s.id), ['s2'])
  })

  it('returns everything untouched when nothing is pinned', () => {
    const split = splitPinned(sessions, [])
    assert.deepEqual(split.pinned, [])
    assert.deepEqual(split.rest.map(s => s.id), ['s1', 's2', 's3'])
  })

  it('ignores pin ids for sessions that are gone', () => {
    const split = splitPinned(sessions, ['s9'])
    assert.deepEqual(split.pinned, [])
    assert.equal(split.rest.length, 3)
  })

  it('survives an undefined list', () => {
    assert.deepEqual(splitPinned(undefined, ['s1']), { pinned: [], rest: [] })
  })
})

describe('per-session cost', () => {
  const snapshot = {
    projectionsBySession: {
      s1: { values: { polishCost: { costUsd: '0.000096', incomplete: false } }, state: 'ready', error: null },
      s2: { values: { polishCost: { costCny: '0.0042' } }, state: 'ready', error: null },
      s3: { values: {}, state: 'idle', error: null },
      s4: { values: { polishCost: { tokens: 10 } }, state: 'ready', error: null },
    },
  }

  it('reads the priced view the Host writes', () => {
    assert.deepEqual(costOf(snapshot, 's1'), { usd: '0.000096', cny: undefined, incomplete: false })
    assert.deepEqual(costOf(snapshot, 's2'), { usd: undefined, cny: '0.0042', incomplete: false })
  })

  it('hides itself when there is nothing priced', () => {
    assert.equal(costOf(snapshot, 's3'), undefined)
    assert.equal(costOf(snapshot, 's4'), undefined)
    assert.equal(costOf(snapshot, 'missing'), undefined)
    assert.equal(costOf(undefined, 's1'), undefined)
  })

  it('formats dollars, yuan and sub-cent amounts', () => {
    assert.equal(costLabel(costOf(snapshot, 's1')), '\u2248$0.000096')
    assert.equal(costLabel(costOf(snapshot, 's2')), '\u2248\u00a50.0042')
    assert.equal(costLabel({ usd: '1.5' }), '\u2248$1.50')
    assert.equal(costLabel({ usd: '0.05' }), '\u2248$0.050')
    assert.equal(costLabel({ usd: '0.9', incomplete: true }), '~$0.900')
    assert.equal(costLabel(undefined), '')
    assert.equal(costLabel({ usd: 'n/a' }), '')
  })
})


it('sumCost adds up what a group of sessions cost', () => {
  const snapshot = {
    projectionsBySession: {
      a: { values: { polishCost: { costUsd: '0.00010000' } } },
      b: { values: { polishCost: { costUsd: '0.00020000' } } },
      c: { values: {} },
    },
  }
  const total = sumCost([{ id: 'a' }, { id: 'b' }, { id: 'c' }], snapshot)
  assert.equal(total.usd, '0.00030000')
  assert.equal(total.cny, undefined)
  assert.equal(sumCostLabel([{ id: 'a' }, { id: 'b' }], snapshot), '\u2248$0.00030')
})

it('sumCost keeps the currency it actually saw', () => {
  const snapshot = {
    projectionsBySession: {
      a: { values: { polishCost: { costCny: '0.0042' } } },
    },
  }
  const total = sumCost([{ id: 'a' }], snapshot)
  assert.equal(total.usd, undefined)
  assert.equal(total.cny, '0.00420000')
  assert.equal(sumCostLabel([{ id: 'a' }], snapshot), '\u2248\u00a50.0042')
})

it('sumCost says nothing when no session is priced', () => {
  assert.equal(sumCost([], {}), undefined)
  assert.equal(sumCost([{ id: 'a' }], { projectionsBySession: {} }), undefined)
  assert.equal(sumCostLabel([{ id: 'a' }], undefined), '')
})


describe('a folder knows when something inside is running', () => {
  it('is true when any filed session is running', () => {
    const inside = [
      { sessions: [{ running: false }, { running: true }] },
      { sessions: [{ running: false }] },
    ]
    assert.equal(folderHasRunning(inside), true)
  })

  it('is false when nothing runs, and for an empty folder', () => {
    assert.equal(folderHasRunning([{ sessions: [{ running: false }] }]), false)
    assert.equal(folderHasRunning([]), false)
    assert.equal(folderHasRunning(undefined), false)
  })
})


describe('the shortcut sheet remembers it was opened', () => {
  it('starts unseen, remembers, and can be forgotten', () => {
    const store = new Map()
    const shim = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }
    assert.equal(readHelp(shim), false)
    writeHelp(true, shim)
    assert.equal(readHelp(shim), true)
    writeHelp(false, shim)
    assert.equal(readHelp(shim), false)
  })

  it('survives a storage that throws', () => {
    const angry = { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') }, removeItem: () => { throw new Error('nope') } }
    assert.equal(readHelp(angry), false)
    assert.doesNotThrow(() => writeHelp(true, angry))
  })
})

it('folder looks live beside workspace looks under a reserved prefix', () => {
  let map = {}
  map = withFolderLook(map, 'Work', { tone: 'green', glyph: '🚀' })
  assert.deepEqual(folderLookOf(map, 'Work'), { tone: 'green', strong: false, glyph: '🚀', note: undefined })
  assert.equal(FOLDER_LOOK_PREFIX + 'Work' in map, true)
  // a workspace id never collides with a folder key
  map = withAppearance(map, 'Work', { tone: 'blue' })
  assert.equal(folderLookOf(map, 'Work').tone, 'green')
  assert.equal(appearanceOf(map, 'Work').tone, 'blue')
  // clearing the last field drops the entry
  map = withFolderLook(map, 'Work', { tone: undefined, glyph: undefined, strong: false })
  assert.equal(FOLDER_LOOK_PREFIX + 'Work' in map, false)
  assert.equal(appearanceOf(map, 'Work').tone, 'blue')
})
