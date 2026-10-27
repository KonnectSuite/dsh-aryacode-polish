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

## What cannot ship, and why

The requested surface was **right-click on the workspace row itself**, with a menu
like the one AryaAI has (`Open in Explorer`, `Rename`, `Manage folders`, `Delete
workspace`). That is not reachable from a plugin, for three independent reasons:

1. The workspace row is drawn by `packages/client/ui-workspace/src/client/rows/Rows.tsx`.
   The row element carries `data-row-key`, `role="treeitem"` and `onClick`, and has
   no `onContextMenu`. Its "…" button opens a menu whose entries are hardcoded
   (`rename`, `delete.workspace`).
2. No slot exists for per-workspace menu entries. The only workspace-related list
   slots are `sidebar.workspaces.session.menu.item` and
   `sidebar.workspaces.session.row.action`, both scoped to a **Session** row. The
   single `sidebar.workspaces` slot replaces the whole browser
   (`replaceRisk: 'shadows-shipped-ui'`), which would mean rebuilding the shipped
   sidebar.
3. Native menus are closed to plugins: `apps/desktop/src/main.ts` allows only the
   `application` and `edit` roles from the main window's main frame, and the
   desktop IPC surface (`apps/desktop/src/ipc.ts`, `DshDesktopProductApi`) exposes
   no open/reveal call.

Attaching an `onContextMenu` to the row's DOM by selector would be a hack against
private markup — the thing this bundle's ground rules forbid, and the first thing
to break when the sidebar changes. The honest options were:

- **Ship on the Session row menu** (chosen): documented slot, supported API,
  survives harness updates.
- Change the shell to declare `sidebar.workspaces.menu.item` and render it from the
  workspace row, then release a harness patch. Declined: the owner wants to keep
  taking harness updates from public releases.
- Park the feature. Declined: the underlying capability (open a workspace folder)
  is worth shipping now.

If the harness ever declares a workspace-scoped menu slot, this feature should move
there: the Host call and the path resolution stay exactly as they are, and only the
registration line changes.

## Evidence for the next reader

- Slot contract: `packages/client/ui-workspace/src/client/contract/slots.ts:152-205`.
- Shipped row to copy: `packages/client/ui-workspace/src/client/session-actions/SessionId.tsx`.
- Remote methods: `packages/api/session-controller/src/index.ts:336-339`
  (`canOpenWorkspacePath`) and `:357-367` (`openWorkspacePath`).
- Windows reveal path: `packages/util/native-command/src/path-opener.ts:307`
  (`runExplorer(['/select,', …])`); `open-in-app` is mounted in the web bundle at
  `packages/bundle/web-app/cordis.patch.yml:73-81`, so this works under `start:web`.
- Workspace view: `packages/api/workspace-controller/src/types.ts:18-30`.
