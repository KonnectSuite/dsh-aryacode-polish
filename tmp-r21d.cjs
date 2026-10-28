const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')
const oldBlock = `      const entry = walk[cursor]
      const node = event.currentTarget.querySelector('[data-polish-ws-row="' + entry.workspace.workspaceId + '"], [data-polish-ws-session="' + entry.row.id + '"]')
      const box = node ? node.getBoundingClientRect() : event.currentTarget.getBoundingClientRect()
      const fake = { preventDefault: () => {}, stopPropagation: () => {}, clientX: Math.max(8, box.left + 12), clientY: box.bottom - 4 }
      if (entry.kind === 'workspace') openWorkspaceMenu(fake, entry.workspace)
      else openMenu(fake, entry.row, entry.workspace)
      return`
if (!src.includes(oldBlock)) throw new Error('keyboard block missing')
src = src.replace(oldBlock, `      const entry = walk[cursor]
      const group = rows.find((item) => item.workspace.workspaceId === entry.workspaceId)
      if (!group) return
      const row = entry.kind === 'workspace' ? undefined : (group.sessions || []).find((item) => item.id === entry.id)
      if (entry.kind !== 'workspace' && !row) return
      const selector = entry.kind === 'workspace'
        ? '[data-polish-ws-row="' + entry.id + '"]'
        : '[data-polish-ws-session="' + entry.id + '"]'
      const node = event.currentTarget.querySelector(selector)
      const box = node ? node.getBoundingClientRect() : event.currentTarget.getBoundingClientRect()
      const fake = { preventDefault: () => {}, stopPropagation: () => {}, clientX: Math.max(8, box.left + 12), clientY: box.bottom - 4 }
      if (entry.kind === 'workspace') openWorkspaceMenu(fake, group.workspace)
      else openMenu(fake, row, group.workspace)
      return`)
fs.writeFileSync(p, src)
console.log('keyboard menu resolves from rows')
