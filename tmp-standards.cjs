const fs = require('node:fs')
const p = 'client/workspace.js'
let src = fs.readFileSync(p, 'utf8')

// 1) menuRuntime also hands back the standard hooks the shipped rows expect but
//    that only the renderer would have synthesised for them.
src = src.replace(
  `    translate: (ns) => {`,
  `    /**
     * The standard hooks the shipped rows call. The slot renderer synthesises them
     * from the Shell's own sources; we derive the same answers from the snapshots we
     * already subscribe to, so Pin/Rename/Fork/Archive render instead of throwing.
     */
    standards: (workspacesSnapshot) => {
      const snapshot = workspacesSnapshot || {}
      const pinned = new Set(snapshot.pinnedSessionIds || [])
      const archived = new Set(snapshot.archivedSessionIds || [])
      const shortcuts = hooks && hooks.shortcuts && typeof hooks.shortcuts.getSnapshot === 'function'
        ? hooks.shortcuts.getSnapshot()
        : []
      return {
        usePinned: selector => (selector ? selector(pinned) : pinned),
        useArchived: selector => (selector ? selector(archived) : archived),
        // Access is the Shell's answer to give; offering the row and letting the
        // call fail is friendlier than hiding a menu that would have worked.
        useSessionAccess: () => true,
        useShortcuts: selector => (selector ? selector(shortcuts) : shortcuts),
      }
    },
    translate: (ns) => {`,
)

// 2) the occupant row receives them
src = src.replace(
  `  const props = Object.assign({}, session, runtime.injected, { useMenuOpenState })`,
  `  const props = Object.assign({}, session, runtime.injected, runtime.standards(runtime.workspacesSnapshot), { useMenuOpenState })`,
)

// 3) RowMenu passes the live snapshot down so the standards stay current
src = src.replace(
  `function ShippedMenuRow({ entry, session, runtime }) {`,
  `function ShippedMenuRow({ entry, session, runtime, workspacesSnapshot }) {`,
)
src = src.replace(
  `  const t = React.useMemo(() => runtime.translate(entry.locale), [runtime, entry.locale])`,
  `  const t = React.useMemo(() => runtime.translate(entry.locale), [runtime, entry.locale])
  runtime.workspacesSnapshot = workspacesSnapshot`,
)
src = src.replace(
  `        React.createElement(ShippedMenuRow, {
          entry,
          runtime,`,
  `        React.createElement(ShippedMenuRow, {
          entry,
          runtime,
          workspacesSnapshot: workspaceState,`,
)
fs.writeFileSync(p, src)
console.log('standards added: ' + src.includes('standards: (workspacesSnapshot) =>'))
console.log('row wired: ' + src.includes('workspacesSnapshot: workspaceState'))
