const fs = require('node:fs')
let c = fs.readFileSync('CHANGELOG.md', 'utf8')
const head = c.indexOf('## [0.11.2] - 2026-10-28')
const keepFrom = c.indexOf('## [0.10.0] - 2026-10-28')
if (head === -1 || keepFrom === -1) throw new Error('changelog anchors missing')
c = c.slice(0, head) + `## [0.11.2] - 2026-10-28

### Verified

- Drag reorder now has live proof, not just unit tests: with two workspaces in the
  Dev AryaCode desktop, dropping the second workspace on the first reordered them
  (\`workspaces.insertBefore\`), and the new order survived a full app restart.

### Fixed

- A session is never promised a move the Host cannot make. The remote workspace
  namespace exposes \`create\`, \`rename\`, \`delete\`, \`insertBefore\`,
  \`insertSessionBefore\`, \`archiveSession\`, \`unarchiveSession\`, \`pinSession\` and
  \`unpinSession\` — and no \`attachSession\` or \`detachSession\` — while a workspace's own
  \`insertSessionBefore\` only reorders the sessions already inside it (it rejects a
  session it does not hold). So dropping a session on another workspace is refused
  with a plain explanation instead of firing a call that fails, and the session menu
  no longer offers "Move to <workspace>".

` + c.slice(keepFrom)
fs.writeFileSync('CHANGELOG.md', c)

let doc = fs.readFileSync('docs/better-workspace.md', 'utf8')
if (!doc.includes('## Why a session cannot change workspace')) {
  doc += `
## Why a session cannot change workspace

Drag reorder works inside a workspace and between workspaces, but a *session* cannot
be dragged into a different workspace, and that is the Host's shape rather than an
omission here:

- \`packages/api/workspace-controller/src/index.ts\` exposes these remotes:
  \`create\`, \`initializeDefault\`, \`rename\`, \`delete\`, \`insertBefore\`,
  \`insertSessionBefore\`, \`archiveSession\`, \`unarchiveSession\`, \`pinSession\`,
  \`unpinSession\` — and nothing that attaches or detaches a session.
- \`packages/api/workspace-controller/src/commands.ts:132\` resolves the target workspace
  and calls its own \`insertSessionBefore(sessionId, beforeSessionId)\`
  (\`packages/workspace/workspace/src/entity.ts:152\`), which reorders that workspace's
  \`sessionIds\`; \`packages/workspace/workspace/tests/workspace.spec.ts:715\` pins that a
  session the workspace does not hold is rejected.
- The entity does have \`attachSession\`/\`detachSession\`
  (\`packages/workspace/workspace/src/types.ts:134\` region), but no remote surfaces them.

So the tree refuses with "A session stays in its workspace; drag it within that
workspace to reorder." rather than attempting a call that throws. If the Host ever
exposes attach/detach, the gesture becomes a one-line change here — the drag payload
already carries \`{ kind: 'session', id, workspaceId }\`.
`
  fs.writeFileSync('docs/better-workspace.md', doc)
}
console.log('docs + changelog updated')
