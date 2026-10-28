const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const need = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }

// 1. pure action builder beside rankMatches
need('export function rankMatches(', 'rankMatches')
s = s.replace('export function rankMatches(', `/**
 * The palette is not only a jumper: every workspace contributes a "start a session here" action, so
 * Ctrl-K can create work as well as find it. Kept pure so the entries are testable without React.
 */
export function actionEntries(rows) {
  return (rows || []).map((group) => ({
    id: 'new:' + group.workspace.workspaceId,
    kind: 'action',
    workspaceId: group.workspace.workspaceId,
    title: 'New session in ' + workspaceLabel(group.workspace),
    workspace: workspaceLabel(group.workspace),
  }))
}

export function rankMatches(`)

// 2. items include the actions
need('    return items\n  }, [allRows])', 'switchItems tail')
s = s.replace(`    return items
  }, [allRows])
  const switchHits = switcher ? rankMatches(switchItems, switcher.query) : []`,
`    actionEntries(allRows).forEach((entry) => items.push(entry))
    return items
  }, [allRows])
  const switchHits = switcher ? rankMatches(switchItems, switcher.query) : []`)

fs.writeFileSync(p, s)
console.log('actions wired into the palette items')
