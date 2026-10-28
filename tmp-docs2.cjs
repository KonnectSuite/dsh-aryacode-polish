const fs = require('node:fs')
let changelog = fs.readFileSync('CHANGELOG.md', 'utf8')
if (!changelog.includes('## [0.44.0]')) {
  changelog = changelog.replace('## [0.43.0]', `## [0.44.0] - 2026-10-28

### Added

- \`Recent first\` sort mode for the workspace tree: ranks each workspace by the newest
  \`updatedAt\` any of its sessions carries, sinking a workspace nothing has touched below one
  that has been used, and falling back to names when no stamp is usable.

## [0.43.0]`)
  fs.writeFileSync('CHANGELOG.md', changelog)
}
let doc = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!doc.includes('Recent first')) {
  doc = doc.replace('## Sort by spend', `## Recent first

Session rows carry \`updatedAt\` (epoch ms, \`packages/api/session-controller/src/client/sessions/service.ts:51\`,
kept fresh by \`Math.max(summary.updatedAt, metadata?.lastPromptAt ?? 0)\` at \`manager.ts:793\`), so the tree
can rank a workspace by the newest stamp any of its sessions holds. A workspace with no usable stamp is
declared unpriced rather than treated as ancient — it sinks below dated ones, and ties fall back to names.

## Sort by spend`)
  fs.writeFileSync('docs/better-workspace.md', doc)
}
console.log('changelog + docs updated')
