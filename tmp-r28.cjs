const fs = require('node:fs')
const p = 'client/workspace.js'
let s = fs.readFileSync(p, 'utf8')
const must = (needle, label) => { if (!s.includes(needle)) throw new Error('anchor missing: ' + label) }

// 1. highlight helper beside folderLookOf
must('export function folderLookOf(map, name) {', 'folderLookOf')
s = s.replace(`export function folderLookOf(map, name) {`, `/**
 * Splits a title around the first case-insensitive occurrence of the filter, so a row can show WHY it
 * survived the filter instead of just being one of the survivors.
 */
export function highlightParts(text, query) {
  const whole = String(text === undefined || text === null ? '' : text)
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return { before: whole, hit: '', after: '' }
  const at = whole.toLowerCase().indexOf(needle)
  if (at < 0) return { before: whole, hit: '', after: '' }
  return {
    before: whole.slice(0, at),
    hit: whole.slice(at, at + needle.length),
    after: whole.slice(at + needle.length),
  }
}

export function folderLookOf(map, name) {`)

// 2. mark style
must('\nconst WS_TONE = {', 'WS_TONE')
s = s.replace('\nconst WS_TONE = {', `
const WS_MARK = {
  borderRadius: '2px',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.1))',
}

const WS_TONE = {`)

// 3. title helper inside the component, after the RowBoundary memo
must('  const RowBoundary = React.useMemo(() => rowBoundary(), [])', 'RowBoundary')
s = s.replace('  const RowBoundary = React.useMemo(() => rowBoundary(), [])', `  const RowBoundary = React.useMemo(() => rowBoundary(), [])
  const titleNode = (text) => {
    const parts = highlightParts(text, query)
    if (!parts.hit) return parts.before
    return [
      parts.before,
      React.createElement('mark', { key: 'hit', 'data-polish-hit': 'true', style: WS_MARK }, parts.hit),
      parts.after,
    ]
  }`)

// 4. session title uses it
must("    }, row.displayTitle || row.id),", 'session title')
s = s.replace("    }, row.displayTitle || row.id),", "    }, titleNode(row.displayTitle || row.id)),")

// 5. workspace label uses it
must("    }, workspaceLabel(workspace)),", 'workspace label')
s = s.replace("    }, workspaceLabel(workspace)),", "    }, titleNode(workspaceLabel(workspace))),")

// 6. a match count while filtering
must('  const shownCount = rows.reduce((sum, row) => sum + row.sessions.length, 0)', 'shownCount')
s = s.replace('  const shownCount = rows.reduce((sum, row) => sum + row.sessions.length, 0)', `  const shownCount = rows.reduce((sum, row) => sum + row.sessions.length, 0)
  const matchCount = query.trim()
    ? rows.length + rows.reduce((sum, row) => sum + row.sessions.length, 0)
    : 0`)

// 7. Home/End jump to the ends of the walk
must("    if (event.key === 'Enter') {", 'enter branch')
s = s.replace("    if (event.key === 'Enter') {", `    if ((event.key === 'Home' || event.key === 'End') && walk.length > 0) {
      event.preventDefault()
      setCursor(event.key === 'Home' ? 0 : walk.length - 1)
      return
    }
    if (event.key === 'Enter') {`)

fs.writeFileSync(p, s)
console.log('patched highlighting, match count and Home/End')
