const fs = require('node:fs')
let d = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!d.includes('## Folders from titles')) {
  d += `
## Folders from titles

A workspace whose label carries a path files itself under the prefix: rename
\`Alpha\` to \`Work/Alpha\` (workspace menu → **Rename workspace…**) and a collapsible
\`WORK\` row appears, carrying the session count of everything filed inside it. The
group is derived on every render from \`folderKey(workspace)\` — nothing is written to the
Host, nothing is cached, and renaming the workspace out of the prefix puts it back in
the flat list. \`folderKey\` refuses a leading slash, a trailing slash and a bare label, so
ordinary names never grow a folder.

## Order presets

**Remember this order** stores the current workspace ids under
\`aryacode-polish:workspace-order.v1\`; **Restore saved order** replays them. The Host
offers exactly one reorder verb (\`insertBefore(movingId, beforeId)\`), so restoring is
\`planReorder(current, wanted)\` — a pure function that walks the wanted order and emits
one move per workspace that sits in the wrong slot. Ids the Host no longer has are
filtered out first, so a preset that names a deleted workspace cannot shuffle the
survivors into the wrong places.
`
  fs.writeFileSync('docs/better-workspace.md', d)
}
console.log('docs updated')
