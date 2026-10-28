const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const swap = (from, to) => {
  if (!src.includes(from)) throw new Error('missing anchor: ' + from.slice(0, 70))
  src = src.replace(from, to)
}

swap(`export const DENSITIES = ['comfortable', 'compact']`,
`export const DENSITIES = ['comfortable', 'compact', 'folders']`)

swap(`export const DENSITY_METRICS = {
  comfortable: { row: '28px' },
  compact: { row: '22px' },
}`,
`export const DENSITY_METRICS = {
  comfortable: { row: '28px', sessions: true },
  compact: { row: '22px', sessions: true },
  folders: { row: '24px', sessions: false },
}

export const DENSITY_TITLES = {
  comfortable: 'Use compact rows',
  compact: 'Show folders only',
  folders: 'Use comfortable rows',
}

export const DENSITY_GLYPHS = {
  comfortable: '\\u2263',
  compact: '\\u2261',
  folders: '\\u25a4',
}`)

swap(`export function densityOf(value) {
  return value === 'compact' ? 'compact' : 'comfortable'
}`,
`export function densityOf(value) {
  return DENSITIES.indexOf(value) >= 0 ? value : 'comfortable'
}

export function nextDensity(value) {
  const list = DENSITIES
  return list[(list.indexOf(densityOf(value)) + 1) % list.length]
}`)

swap(`export function moveBefore(list, movingId, beforeId) {`,
`/** Where the cursor lands when hopping to the next or previous workspace head. */
export function jumpWorkspace(list, cursor, step) {
  const flat = Array.isArray(list) ? list : []
  const heads = []
  flat.forEach((item, index) => {
    if (item && item.kind === 'workspace') heads.push(index)
  })
  if (heads.length === 0) return -1
  if (cursor === undefined || cursor < 0) return step > 0 ? heads[0] : heads[heads.length - 1]
  if (step > 0) {
    const after = heads.find(index => index > cursor)
    return after === undefined ? heads[0] : after
  }
  const before = heads.filter(index => index < cursor)
  return before.length === 0 ? heads[heads.length - 1] : before[before.length - 1]
}

export function moveBefore(list, movingId, beforeId) {`)

swap(`    React.createElement('button', {
      key: 'density',
      type: 'button',
      'data-polish-ws-density': densityOf(density),
      title: densityOf(density) === 'compact' ? 'Use comfortable rows' : 'Use compact rows',
      'aria-label': densityOf(density) === 'compact' ? 'Use comfortable rows' : 'Use compact rows',
      style: WS_ADD,
      onClick: () => {
        const next = densityOf(density) === 'compact' ? 'comfortable' : 'compact'
        setDensity(next)
        writeDensity(next)
      },
    }, densityOf(density) === 'compact' ? '≡' : '≣'),`,
`    React.createElement('button', {
      key: 'density',
      type: 'button',
      'data-polish-ws-density': densityOf(density),
      title: DENSITY_TITLES[densityOf(density)],
      'aria-label': DENSITY_TITLES[densityOf(density)],
      style: WS_ADD,
      onClick: () => {
        const next = nextDensity(density)
        setDensity(next)
        writeDensity(next)
      },
    }, DENSITY_GLYPHS[densityOf(density)]),`)

swap(`    const sessions = group.sessions`,
`    const sessions = metrics.sessions ? group.sessions : []`)

fs.writeFileSync(p, src)
console.log('density, titles, jump helpers patched')
