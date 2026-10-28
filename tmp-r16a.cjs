const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1. pure sort helpers, appended after nextDensity
const anchor = `export function nextDensity(value) {`
if (!src.includes(anchor)) throw new Error('nextDensity anchor missing')
if (src.includes('export function sortRows(')) throw new Error('already patched')
const sortBlock = `export const SORT_KEY = 'aryacode-polish:sort.v1'
export const SORTS = ['host', 'name']

export function sortOf(value) {
  return SORTS.indexOf(value) === -1 ? 'host' : value
}

export function readSort(storage) {
  try {
    const store = storage || globalThis.localStorage
    const raw = store ? store.getItem(SORT_KEY) : null
    return sortOf(raw === null || raw === undefined ? 'host' : raw)
  } catch {
    return 'host'
  }
}

export function writeSort(value, storage) {
  try {
    const store = storage || globalThis.localStorage
    if (store) store.setItem(SORT_KEY, sortOf(value))
  } catch {}
}

// Folder membership is the primary key so a folder's workspaces stay together;
// '' sorts before any folder name, which keeps unfiled workspaces on top.
export function sortRows(rows, mode) {
  if (sortOf(mode) !== 'name') return rows
  const ranked = rows.map((group, index) => ({
    group,
    index,
    folder: folderKey(group.workspace) || '',
    label: workspaceLabel(group.workspace).toLowerCase(),
  }))
  ranked.sort((a, b) => {
    if (a.folder !== b.folder) {
      if (a.folder === '') return -1
      if (b.folder === '') return 1
      return a.folder < b.folder ? -1 : 1
    }
    if (a.label !== b.label) return a.label < b.label ? -1 : 1
    return a.index - b.index
  })
  return ranked.map((entry) => entry.group)
}

`
src = src.replace(anchor, sortBlock + anchor)

// 2. state + sort application
const rowAnchor = `  const rows = filterTree(allRows, query, pinned)`
if (!src.includes(rowAnchor)) throw new Error('rows anchor missing')
src = src.replace(rowAnchor, `  const rows = filterTree(sortRows(allRows, sort), query, pinned)`)

const stateAnchor = `  const metrics = DENSITY_METRICS[densityOf(density)]`
if (!src.includes(stateAnchor)) throw new Error('metrics anchor missing')
src = src.replace(stateAnchor, `  const [sort, setSort] = React.useState(() => readSort())\n` + stateAnchor)

// 3. header button beside the density button
const densityBtn = `    React.createElement('button', {
      key: 'density',
      type: 'button',
      'data-polish-ws-density': densityOf(density),`
if (!src.includes(densityBtn)) throw new Error('density button anchor missing')
const sortBtn = `    React.createElement('button', {
      key: 'sort',
      type: 'button',
      'data-polish-ws-sort': sortOf(sort),
      title: sortOf(sort) === 'name' ? 'Sort workspaces by host order' : 'Sort workspaces A to Z',
      style: WS_HEADER_BUTTON,
      onClick: () => {
        const next = sortOf(sort) === 'name' ? 'host' : 'name'
        writeSort(next)
        setSort(next)
      },
    }, sortOf(sort) === 'name' ? 'A→Z' : '↕'),
`
src = src.replace(densityBtn, sortBtn + densityBtn)

// 4. switcher: include workspaces as their own hits
const itemsAnchor = `    allRows.forEach((group) => {
      const workspace = workspaceLabel(group.workspace)
      group.sessions.forEach((row) => {
        items.push({ id: row.id, title: row.displayTitle || row.id, workspace })
      })
    })`
if (!src.includes(itemsAnchor)) throw new Error('switcher items anchor missing')
src = src.replace(itemsAnchor, `    allRows.forEach((group) => {
      const workspace = workspaceLabel(group.workspace)
      items.push({ id: 'workspace:' + group.workspace.workspaceId, kind: 'workspace', workspaceId: group.workspace.workspaceId, title: workspace, workspace: '' })
      group.sessions.forEach((row) => {
        items.push({ id: row.id, kind: 'session', title: row.displayTitle || row.id, workspace })
      })
    })`)

// 5. choosing a workspace hit reveals it in the tree instead of opening a session
const pickSession = `            setSwitcher(null)
            services.openSession(hit.id)`
if (!src.includes(pickSession)) throw new Error('enter handler anchor missing')
src = src.replace(pickSession, `            setSwitcher(null)
            if (hit.kind === 'workspace') {
              revealWorkspace(hit.workspaceId)
              return
            }
            services.openSession(hit.id)`)

const clickSession = `            onClick: () => { setSwitcher(null); services.openSession(hit.id) },`
if (!src.includes(clickSession)) throw new Error('click handler anchor missing')
src = src.replace(clickSession, `            onClick: () => {
              setSwitcher(null)
              if (hit.kind === 'workspace') { revealWorkspace(hit.workspaceId); return }
              services.openSession(hit.id)
            },`)

// 6. the switcher row shows a house for a workspace and its folder for a session
const titleSpan = `          React.createElement('span', { style: WS_TITLE }, hit.title),
          React.createElement('span', { style: SWITCHER_HINT }, hit.workspace)))))), document.body)`
if (!src.includes(titleSpan)) throw new Error('switcher title anchor missing')
src = src.replace(titleSpan, `          React.createElement('span', { style: WS_TITLE }, hit.kind === 'workspace' ? '⌂ ' + hit.title : hit.title),
          React.createElement('span', { style: SWITCHER_HINT }, hit.kind === 'workspace' ? 'workspace' : hit.workspace)))))), document.body)`)

// 7. revealWorkspace: fold the folder open, its workspace open, and put the cursor on it
const propsAnchor = `  const openMenu = (event, row, workspace) => {`
if (!src.includes(propsAnchor)) throw new Error('openMenu anchor missing')
src = src.replace(propsAnchor, `  const revealWorkspace = (workspaceId) => {
    const group = allRows.find((row) => row.workspace.workspaceId === workspaceId)
    if (!group) return
    const key = folderKey(group.workspace)
    if (key !== undefined) setFolders((prev) => Object.assign({}, prev, { [key]: false }))
    setExpanded((prev) => Object.assign({}, prev, { [workspaceId]: true }))
    setCursor(workspaceId)
    setNotice('Jumped to ' + workspaceLabel(group.workspace) + '.')
  }

` + propsAnchor)

fs.writeFileSync(p, src)
console.log('sort + switcher workspaces patched')
