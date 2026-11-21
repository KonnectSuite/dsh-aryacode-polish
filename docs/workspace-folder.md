# Open a workspace folder in the file browser

## What ships

A row in a Session's "…" menu: **Open workspace folder**. It resolves the workspace
that owns the Session and asks the Host to open that directory in the platform file
manager (Explorer on Windows, Finder on macOS, the desktop's file manager elsewhere).

- Switch: `openWorkspaceFolder` (on by default).
- Seat: `sidebar.workspaces.session.menu.item`, registered as `polish-open-folder`
  at `order: 460`, after the shipped `session-id` row at `450`.
- Host call: `ctx.remote.session.openWorkspacePath({ path })`, gated by
  `ctx.remote.session.canOpenWorkspacePath()`.
- Path source: the Workspace snapshot (`ctx.workspaces.list`), matched through
  `WorkspaceView.sessionIds`.

The row renders nothing when the switch is off, when the Session belongs to no
workspace, or when the Host reports it cannot open a path. A menu row that cannot
act is worse than no row.

## What was thought impossible, and what changed

When this row shipped (2026-10), the same request was answered on the Session row
because the workspace row looked unreachable from a plugin: the row element carried
no `onContextMenu`, the only workspace-adjacent slots were Session-scoped
(`sidebar.workspaces.session.menu.item`, `sidebar.workspaces.session.row.action`),
the single `sidebar.workspaces` slot replaces the whole browser
(`replaceRisk: 'shadows-shipped-ui'`), and native Electron menus were closed to
plugins. That reading was right about the slots and wrong about the menu.

The harness has since grown a shared context-menu service. The shipped workspace
row now declares a menu target (`kind: "workspace"`, value `{ workspaceId, path,
displayTitle }`), and the Shell itself registers Rename, Reveal and Delete for it.
A plugin adds rows to that same menu without touching the row, the list or the
harness: `ctx.contextMenus.register({ id, target: 'workspace', order, resolve })`.
`client/face.js` uses it to add **Copy path** (`polish.workspace`, order 250,
between Reveal at 200 and the separator before Delete at 300).

So this row still earns its place: it opens the folder from inside a Session, which
no Session-row menu does, and its Host call and path resolution are unchanged. What
is no longer true is the claim this file used to make — that a workspace row could
not carry a menu at all.

**Owner's decision (2026-10-27):** asked again, after the Session row menu shipped,
whether to add a workspace-scoped menu slot to the harness and release a harness
patch, the owner declined — "then forget it". That decision stands: no harness patch
was ever made. What changed is that the workspace-row menu arrived from DeepSeek as
a normal harness update, which is exactly the future the decision was protecting.

## Evidence for the next reader

- Slot contract: `packages/client/ui-workspace/src/client/contract/slots.ts:152-205`.
- Shipped row to copy: `packages/client/ui-workspace/src/client/session-actions/SessionId.tsx`.
- Remote methods: `packages/api/session-controller/src/index.ts:336-339`
  (`canOpenWorkspacePath`) and `:357-367` (`openWorkspacePath`).
- Windows reveal path: `packages/util/native-command/src/path-opener.ts:307`
  (`runExplorer(['/select,', …])`); `open-in-app` is mounted in the web bundle at
  `packages/bundle/web-app/cordis.patch.yml:73-81`, so this works under `start:web`.
- Workspace view: `packages/api/workspace-controller/src/types.ts:18-30`.
