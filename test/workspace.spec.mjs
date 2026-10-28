import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  firstRunning,
  actionEntries,
  treeDefaults,
  highlightParts,
  folderLookOf,
  withFolderLook,
  FOLDER_LOOK_PREFIX,
  filterTree,
  parseQuery,
  startOfToday,
  queryHasToken,
  withToken,
  filterSummary,
  rangeWithin,
  readViews,
  writeViews,
  upsertView,
  removeView,
  viewSummary,
  selectionLabel,
  countMatches,
  treeTotals,
  orderFolders,
  moveFolder,
  applyFolderOrder,
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
  SORTS,
  SORT_TITLES,
  costDetail,
  ageLabel,
  ageTitle,
  elapsedLabel,
  sumTokens,
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
  restoreLabel,
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

it('type-ahead matches the prefix of a session title', () => {
  const rows = [
    { workspace: { workspaceId: 'w1', title: 'Work' }, sessions: [{ id: 's1', displayTitle: 'Greeting' }, { id: 's2', displayTitle: 'Build the thing' }] },
    { workspace: { workspaceId: 'w2', title: 'Play' }, sessions: [{ id: 's3', displayTitle: 'Garden' }] },
  ]
  const walk = flattenRows(rows, {}, '')
  const titles = walk.map((entry) => {
    const group = rows.find((item) => item.workspace.workspaceId === entry.workspaceId) || {}
    if (entry.kind === 'workspace') return workspaceLabel(group.workspace)
    const row = (group.sessions || []).find((item) => item.id === entry.id) || {}
    return String(row.displayTitle || row.title || '')
  })
  const hit = titles.findIndex((title) => title.toLowerCase().startsWith('bu'))
  assert.equal(titles[hit], 'Build the thing')
  assert.equal(titles.findIndex((title) => title.toLowerCase().startsWith('z')), -1)
})

it('highlights the filtered part of a title, and only the first one', () => {
  assert.deepEqual(highlightParts('Build the thing', 'the'), { before: 'Build ', hit: 'the', after: ' thing' })
  assert.deepEqual(highlightParts('Build the thing', 'THE'), { before: 'Build ', hit: 'the', after: ' thing' }, 'the match keeps the text casing, not the query casing')
  assert.deepEqual(highlightParts('Build', 'zz'), { before: 'Build', hit: '', after: '' })
  assert.deepEqual(highlightParts('Build', '   '), { before: 'Build', hit: '', after: '' })
  assert.deepEqual(highlightParts(undefined, 'x'), { before: '', hit: '', after: '' })
})

it('the palette offers a new session per workspace', () => {
  const rows = [
    { workspace: { workspaceId: 'w1', title: 'Work/Alpha' }, sessions: [] },
    { workspace: { workspaceId: 'w2', title: 'Beta' }, sessions: [] },
  ]
  const entries = actionEntries(rows)
  assert.deepEqual(entries.map((entry) => entry.id), ['new:w1', 'new:w2'])
  assert.deepEqual(entries.map((entry) => entry.title), ['New session in Work/Alpha', 'New session in Beta'])
  assert.ok(entries.every((entry) => entry.kind === 'action' && entry.workspaceId))
  assert.deepEqual(actionEntries(undefined), [])
})

it('a reset really resets every view knob', () => {
  const defaults = treeDefaults()
  assert.deepEqual(Object.keys(defaults).sort(), ['density', 'expanded', 'folders', 'query', 'sort'])
  assert.equal(defaults.query, '')
  assert.deepEqual(defaults.expanded, {})
  assert.deepEqual(defaults.folders, {})
  assert.equal(defaults.density, 'comfortable')
  assert.equal(defaults.sort, 'host')
})

it('Sort by spend ranks workspaces by what they cost', () => {
  const groups = [
    { workspace: { workspaceId: 'a', title: 'Alpha' }, sessions: [] },
    { workspace: { workspaceId: 'b', title: 'Bravo' }, sessions: [] },
    { workspace: { workspaceId: 'c', title: 'Charlie' }, sessions: [] },
  ]
  const totals = { a: { usd: 0.5 }, b: { usd: 2.25 } }
  const ranked = sortRows(groups, 'cost', (group) => totals[group.workspace.workspaceId])
  assert.deepEqual(ranked.map((group) => group.workspace.workspaceId), ['b', 'a', 'c'])
})

it('A workspace with no spend sinks below a priced one, whatever its name', () => {
  const groups = [
    { workspace: { workspaceId: 'aaa', title: 'AAA' }, sessions: [] },
    { workspace: { workspaceId: 'zzz', title: 'ZZZ' }, sessions: [] },
  ]
  const totals = { zzz: { usd: 0.01 } }
  const ranked = sortRows(groups, 'cost', (group) => totals[group.workspace.workspaceId])
  assert.deepEqual(ranked.map((group) => group.workspace.workspaceId), ['zzz', 'aaa'])
})

it('Elapsed time reads as a running clock, never as a date', () => {
  assert.equal(elapsedLabel(0), '0s')
  assert.equal(elapsedLabel(900), '0s')
  assert.equal(elapsedLabel(7_000), '7s')
  assert.equal(elapsedLabel(59_000), '59s')
  assert.equal(elapsedLabel(60_000), '1m')
  assert.equal(elapsedLabel(90 * 60_000), '1h')
  assert.equal(elapsedLabel(26 * 3_600_000), '1d')
  assert.equal(elapsedLabel(-5), '')
  assert.equal(elapsedLabel('nope'), '')
})

it('Ages read in the shortest honest unit', () => {
  const now = 1_700_000_000_000
  assert.equal(ageLabel(now - 5_000, now), 'now')
  assert.equal(ageLabel(now - 59_000, now), 'now')
  assert.equal(ageLabel(now - 60_000, now), '1m')
  assert.equal(ageLabel(now - 59 * 60_000, now), '59m')
  assert.equal(ageLabel(now - 60 * 60_000, now), '1h')
  assert.equal(ageLabel(now - 23 * 3_600_000, now), '23h')
  assert.equal(ageLabel(now - 24 * 3_600_000, now), '1d')
  assert.equal(ageLabel(now - 6 * 86_400_000, now), '6d')
  assert.equal(ageLabel(now - 7 * 86_400_000, now), '1w')
})

it('A row with no usable stamp shows no age', () => {
  const now = 1_700_000_000_000
  assert.equal(ageLabel(undefined, now), '')
  assert.equal(ageLabel(0, now), '')
  assert.equal(ageLabel('nope', now), '')
  assert.equal(ageLabel(now + 5_000, now), 'now')
  assert.equal(ageTitle(0), '')
})

it('The age tooltip carries the exact moment, not the label itself', () => {
  const shown = ageTitle(Date.UTC(2026, 9, 28, 9, 15))
  assert.ok(shown.length > 0)
  assert.ok(!/^(now|[0-9]+[mhdw])$/.test(shown))
})

it('Sort by recency puts the workspace touched last on top', () => {
  const groups = [
    { workspace: { workspaceId: 'old', title: 'Old' }, sessions: [{ id: 's1', updatedAt: 1_000 }] },
    { workspace: { workspaceId: 'new', title: 'New' }, sessions: [{ id: 's2', updatedAt: 9_000 }, { id: 's3', updatedAt: 4_000 }] },
    { workspace: { workspaceId: 'mid', title: 'Mid' }, sessions: [{ id: 's4', updatedAt: 5_000 }] },
  ]
  const ranked = sortRows(groups, 'recent')
  assert.deepEqual(ranked.map((group) => group.workspace.workspaceId), ['new', 'mid', 'old'])
})

it('A workspace nothing has touched sinks below a dated one, whatever its name', () => {
  const groups = [
    { workspace: { workspaceId: 'aaa', title: 'AAA' }, sessions: [{ id: 's1', updatedAt: 0 }] },
    { workspace: { workspaceId: 'zzz', title: 'ZZZ' }, sessions: [{ id: 's2', updatedAt: 250 }] },
  ]
  assert.deepEqual(sortRows(groups, 'recent').map((group) => group.workspace.workspaceId), ['zzz', 'aaa'])
})

it('Recency without a usable stamp falls back to names, not to a crash', () => {
  const groups = [
    { workspace: { workspaceId: 'b', title: 'Bravo' }, sessions: [] },
    { workspace: { workspaceId: 'a', title: 'Alpha' } },
  ]
  assert.deepEqual(sortRows(groups, 'recent').map((group) => group.workspace.workspaceId), ['a', 'b'])
})

it('Every sort mode is named once, and cost is one of them', () => {
  assert.deepEqual(SORTS, ['host', 'name', 'cost', 'recent'])
  assert.equal(SORT_TITLES.cost, 'Most spent first')
  assert.equal(SORT_TITLES.recent, 'Recent first')
  assert.equal(sortOf('cost'), 'cost')
  for (const mode of SORTS) assert.equal(typeof SORT_TITLES[mode], 'string')
})

it('Sorting by spend without totals falls back to names, not to a crash', () => {
  const groups = [
    { workspace: { workspaceId: 'b', title: 'Bravo' }, sessions: [] },
    { workspace: { workspaceId: 'a', title: 'Alpha' }, sessions: [] },
  ]
  assert.deepEqual(sortRows(groups, 'cost').map((group) => group.workspace.workspaceId), ['a', 'b'])
})

it('Reads every bucket the cost projection publishes', () => {
  const snapshot = {
    projectionsBySession: {
      s1: { values: { polishCost: { tokens: 100, cacheRead: 70, uncached: 20, cacheWrite: 4, output: 6, requests: 2, costUsd: '0.01', incomplete: false, models: [{}, {}] } } },
    },
  }
  assert.deepEqual(costDetail(snapshot, 's1'), {
    cacheRead: 70,
    uncached: 20,
    cacheWrite: 4,
    output: 6,
    requests: 2,
    tokens: 100,
    usd: '0.01',
    cny: undefined,
    incomplete: false,
    models: 2,
  })
})

it('A session without a priced view has no detail, and a bad value never throws', () => {
  assert.equal(costDetail(undefined, 's1'), undefined)
  assert.equal(costDetail({ projectionsBySession: {} }, 's1'), undefined)
  assert.equal(costDetail({ projectionsBySession: { s1: { values: { polishCost: 'nope' } } } }, 's1'), undefined)
  assert.equal(costDetail({ projectionsBySession: { s1: { values: { polishCost: { tokens: 0 } } } } }, 's1'), undefined)
})

it('Rolls a workspace up into buckets and a cache-hit share', () => {
  const snapshot = {
    projectionsBySession: {
      s1: { values: { polishCost: { tokens: 100, cacheRead: 70, uncached: 20, cacheWrite: 4, output: 6, requests: 1, costUsd: '0.01' } } },
      s2: { values: { polishCost: { tokens: 50, cacheRead: 0, uncached: 50, cacheWrite: 0, output: 0, requests: 1, costUsd: '0.02' } } },
      s3: { values: { polishCost: { tokens: 9, costCny: '0.5' } } },
    },
  }
  const sessions = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }]
  const totals = sumTokens(sessions, snapshot)
  assert.equal(totals.cacheRead, 70)
  assert.equal(totals.uncached, 70)
  assert.equal(totals.cacheWrite, 4)
  assert.equal(totals.output, 6)
  assert.equal(totals.requests, 2)
  assert.equal(totals.priced, 3)
  assert.equal(totals.billed, 150)
  assert.equal(totals.hit, 47)
})

it('A group with nothing priced reports zero priced sessions', () => {
  const totals = sumTokens([{ id: 'x' }], { projectionsBySession: {} })
  assert.equal(totals.priced, 0)
  assert.equal(totals.billed, 0)
  assert.equal(totals.hit, 0)
})

it('the status store decides, not the row', () => {
  const rows = [
    { workspace: { workspaceId: 'w1' }, sessions: [{ id: 's1', displayTitle: 'One', running: false }] },
  ]
  // Row summaries never carry running; the slot's status store does.
  assert.deepEqual(firstRunning(rows, (row) => row.id === 's1'), { workspaceId: 'w1', sessionId: 's1', title: 'One' })
  assert.equal(firstRunning(rows, () => false), undefined)
  assert.equal(folderHasRunning([{ sessions: [{ id: 's9', running: false }] }], (row) => row.id === 's9'), true)
})


it('the bulk restore button says what it will do', () => {
  assert.equal(restoreLabel(1), 'Restore the archived session')
  assert.equal(restoreLabel(0), 'Restore the archived session')
  assert.equal(restoreLabel(4), 'Restore all 4 archived')
  assert.equal(restoreLabel('3'), 'Restore all 3 archived')
})


it('parses the filter operators without swallowing the words', () => {
  assert.deepEqual(parseQuery('! secret'), { text: 'secret', running: true, flagged: false, scope: '', age: '' })
  assert.deepEqual(parseQuery('#'), { text: '', running: false, flagged: true, scope: '', age: '' })
  assert.deepEqual(parseQuery('@work alpha'), { text: 'alpha', running: false, flagged: false, scope: 'work', age: '' })
  assert.deepEqual(parseQuery('  '), { text: '', running: false, flagged: false, scope: '', age: '' })
})

it('a running operator keeps only live sessions and drops empty workspaces', () => {
  const rows = filterTree(
    [
      { workspace: { workspaceId: 'w1', title: 'W one' }, sessions: [{ id: 'live' }, { id: 'idle' }] },
      { workspace: { workspaceId: 'w2', title: 'W two' }, sessions: [{ id: 'quiet' }] },
    ],
    '!',
    new Set(),
    { isRunning: (row) => row.id === 'live' },
  )
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].sessions.map((row) => row.id), ['live'])
})

it('a flag operator reads the marks and a scope narrows to a folder', () => {
  const rows = filterTree(
    [
      { workspace: { workspaceId: 'w1', title: 'Work/Alpha' }, sessions: [{ id: 'a' }, { id: 'b' }] },
      { workspace: { workspaceId: 'w2', title: 'Beta' }, sessions: [{ id: 'c' }] },
    ],
    '# @work',
    new Set(),
    { isRunning: () => false, flagged: new Set(['b']) },
  )
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].sessions.map((row) => row.id), ['b'])
})


it('the filter line explains an empty operator result instead of quoting a symbol', () => {
  assert.equal(filterSummary('!', 0), 'No sessions are running.')
  assert.equal(filterSummary('#', 0), 'Nothing is flagged.')
  assert.equal(filterSummary('! #', 0), 'Nothing is both running and flagged.')
  assert.equal(filterSummary('@nowhere', 0), 'Nothing lives under "nowhere".')
  assert.equal(filterSummary('zzz', 0), 'Nothing matches "zzz".')
  assert.equal(filterSummary('!', 1), '1 match')
  assert.equal(filterSummary('!', 3), '3 matches')
})


it('an operator filter does not count the headers it merely kept', () => {
  const source = [
    { workspace: { workspaceId: 'w1', title: 'Work/Alpha' }, sessions: [{ id: 'a' }] },
    { workspace: { workspaceId: 'w2', title: 'Work/Beta' }, sessions: [{ id: 'b' }, { id: 'c' }] },
  ]
  const options = { isRunning: () => false, flagged: new Set(['b']) }
  /* one flagged session, plus the header the operator had to keep alive: not 4 */
  assert.equal(countMatches(filterTree(source, '#', new Set(), options), '#'), 1)
  /* a name match counts the header it actually named, once */
  assert.equal(countMatches(filterTree(source, 'alpha', new Set(), options), 'alpha'), 2)
  assert.equal(countMatches([], ''), 0)
})


it('a shift-click selects the span between anchor and target, either direction', () => {
  const ids = ['a', 'b', 'c', 'd']
  assert.deepEqual(rangeWithin(ids, 'b', 'd'), ['b', 'c', 'd'])
  assert.deepEqual(rangeWithin(ids, 'c', 'a'), ['a', 'b', 'c'])
  assert.deepEqual(rangeWithin(ids, 'b', 'b'), ['b'])
  assert.deepEqual(rangeWithin(ids, 'nope', 'c'), ['c'])
  assert.deepEqual(rangeWithin(undefined, 'a', 'b'), ['b'])
})

it('a selection never announces itself when empty', () => {
  assert.equal(selectionLabel(1), '1 selected')
  assert.equal(selectionLabel(4), '4 selected')
  assert.equal(selectionLabel(0), '')
  assert.equal(selectionLabel(undefined), '')
})


function fakeStore() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  }
}

it('a saved view survives a round trip and rejects nonsense', () => {
  const store = fakeStore()
  writeViews([{ name: 'Nightly', query: '! ', sort: 'recent', density: 'compact' }], store)
  assert.deepEqual(readViews(store), [{ name: 'Nightly', query: '! ', sort: 'recent', density: 'compact' }])
  store.setItem('aryacode-polish:views.v1', 'not json')
  assert.deepEqual(readViews(store), [])
  store.setItem('aryacode-polish:views.v1', JSON.stringify([{ name: '  ' }, { name: 'Ok', sort: 'nonsense', density: 'nonsense' }]))
  assert.deepEqual(readViews(store), [{ name: 'Ok', query: '', sort: 'host', density: 'comfortable' }])
})

it('saving under the same name replaces, and twelve is the ceiling', () => {
  let views = upsertView([], { name: 'A', query: 'x', sort: 'name', density: 'compact' })
  views = upsertView(views, { name: 'A', query: 'y', sort: 'recent', density: 'folders' })
  assert.equal(views.length, 1)
  assert.equal(views[0].query, 'y')
  assert.equal(upsertView(views, { name: '' }).length, 1)
  let many = []
  for (let at = 0; at < 15; at += 1) many = upsertView(many, { name: 'v' + at })
  assert.equal(many.length, 12)
  assert.deepEqual(removeView(views, 'A'), [])
})

it('a view summarises the knobs it would change', () => {
  assert.equal(viewSummary({ query: '! ', sort: 'recent', density: 'compact' }), '! \u00b7 Recent first \u00b7 Compact')
  assert.equal(viewSummary({ query: '', sort: 'host', density: 'comfortable' }), 'Host order')
  assert.equal(viewSummary(undefined), '')
})


it('the header totals count work and money without inventing either', () => {
  const snapshot = {
    projectionsBySession: {
      a: { values: { polishCost: { costUsd: '0.25', costCny: '1.80', incomplete: false } } },
      b: { values: { polishCost: { costUsd: '0.75', costCny: '5.40', incomplete: false } } },
    },
  }
  const rows = [
    { workspace: { workspaceId: 'w1', title: 'W one' }, sessions: [{ id: 'a' }, { id: 'b' }] },
    { workspace: { workspaceId: 'w2', title: 'W two' }, sessions: [{ id: 'c' }] },
  ]
  const totals = treeTotals(rows, snapshot)
  assert.equal(totals.sessions, 3)
  assert.equal(totals.workspaces, 2)
  assert.equal(totals.priced, 2)
  assert.equal(totals.usd, '1.00000000')
  assert.equal(totals.cny, '7.20000000')

  assert.deepEqual(treeTotals([], snapshot), {
    sessions: 0,
    workspaces: 0,
    priced: 0,
    usd: undefined,
    cny: undefined,
  })
})

it('folders can stand in a hand-kept order', () => {
  assert.deepEqual(orderFolders(['Work', 'Home', 'Zeta'], ['Zeta', 'Home']), ['Zeta', 'Home', 'Work'])
  assert.deepEqual(orderFolders(['B', 'A'], []), ['A', 'B'], 'no order means alphabetical')

  const rows = [
    { workspace: { workspaceId: 'a', title: 'Work/one' }, sessions: [] },
    { workspace: { workspaceId: 'b', title: 'Home/two' }, sessions: [] },
    { workspace: { workspaceId: 'c', title: 'loose' }, sessions: [] },
  ]
  assert.deepEqual(applyFolderOrder(rows, ['Home', 'Work']).map((r) => r.workspace.workspaceId), ['b', 'a', 'c'])
  assert.deepEqual(applyFolderOrder(rows, []).map((r) => r.workspace.workspaceId), ['b', 'a', 'c'], 'alphabetical when unset')

  assert.deepEqual(moveFolder([], ['A', 'B', 'C'], 'B', -1), ['B', 'A', 'C'])
  assert.deepEqual(moveFolder([], ['A', 'B', 'C'], 'A', -1), ['A', 'B', 'C'], 'the first stays first')
  assert.deepEqual(moveFolder(['C', 'B', 'A'], ['A', 'B', 'C'], 'B', 1), ['C', 'A', 'B'])
})

it('the chips and the date tokens speak the same language', () => {
  assert.equal(parseQuery('t:today').age, 'today')
  assert.equal(parseQuery('t:week ! #').age, 'week')
  assert.equal(parseQuery('t:week ! #').running, true)
  assert.equal(parseQuery('nothing here').age, '')

  assert.equal(queryHasToken('! t:today', 't:today'), true)
  assert.equal(queryHasToken('!', 't:today'), false)
  assert.equal(withToken('', 't:today'), 't:today')
  assert.equal(withToken('! t:today', 't:today'), '!', 'clicking an active chip takes the token away')
  assert.equal(withToken('alpha', '!'), 'alpha !')

  const noon = new Date(2026, 9, 28, 12, 0, 0).getTime()
  assert.equal(startOfToday(noon), new Date(2026, 9, 28, 0, 0, 0).getTime())

  const row = (id, hoursAgo) => ({ id, displayTitle: id, updatedAt: noon - hoursAgo * 3600 * 1000 })
  const rows = [{ workspace: { workspaceId: 'a', title: 'Work' }, sessions: [row('fresh', 2), row('old', 40)] }]
  const today = filterTree(rows, 't:today', new Set(), { now: noon })
  assert.deepEqual(today.flatMap((g) => g.sessions.map((s) => s.id)), ['fresh'])
  const week = filterTree(rows, 't:week', new Set(), { now: noon })
  assert.deepEqual(week.flatMap((g) => g.sessions.map((s) => s.id)), ['fresh', 'old'])
})
