# Better workspace

Our own sidebar browser, mounted into `sidebar.workspaces` at `priority: -1` so it
shadows the shipped one while the switch is on, and steps aside the moment it is off.

## Why a takeover instead of a menu item

A plugin can add a menu to any surface it renders itself, and it can extend a
Shell-rendered surface only through a slot that surface declares. The workspace row
declares none: its "..." menu is a closed two-item array and the row has no
`onContextMenu`. So the only sanctioned route to "right-click a workspace" is to
replace the region that draws it - this feature - and own that region's upkeep.

## The two traps

**No `children` declaration.** A single-occupant seat renders its LOWEST priority
entry, which is why `priority: -1` shadows the shipped browser without touching it.
But declaring children is exclusive: the shipped registration already owns
`sidebar.workspaces.session.menu.item` and its siblings, so a second declaration
throws and the whole seat is dropped. This file reads the occupants off the slots
service (`slots.entries('sidebar.workspaces.session.menu.item')`) and renders them
by hand, reproducing exactly the two props the renderer would have synthesised:

- `t` - the occupant's own namespace bound through the locale face, so the shipped
  labels stay translated;
- `useMenuOpenState` - the row's open-state pair, produced by the owner's declared
  hook factory (`inject.hooks.menuOpenState(standard, hookContext)`).

Everything else on the occupant (Pin, Rename, Fork, Archive, Copy Session ID, and our
own "Open workspace folder") therefore keeps working untouched.

**Presence is the switch.** Because presence is what shadows the shipped browser, the
seat is registered and disposed with the `betterWorkspace` switch rather than
registered once and hidden. `installWorkspaceSeat` subscribes to the row's live
config form and adds/removes the registration each time the switch flips.

## What M1 ships

- Workspace rows: caret, folder, title, session count; click to fold.
- Session rows underneath, newest first, click to open.
- Session "..." menu: the shipped occupant list rendered as above.
- Workspace right-click menu: Open in File Explorer, Copy path, Remove workspace
  (two-click confirm).
- `docs/panel-screenshot.md`-style honesty: a broken third-party menu row is caught
  by a boundary so the tree still renders.

## What is not here yet

Drag and drop, reorder and pinned ordering, the "/" name grouping the reference
plugin offers, appearance options, and the same tree in the New Session picker. Those
are M2/M3; the seat is already the right place for them.

## What M2 added

- **Filter** — one box over workspaces and session titles. Every group it keeps is
  opened, because a match you cannot see is not a match; the footer reports
  "n of m sessions" whenever the filter hides any. `/` focuses it from anywhere,
  Escape clears it.
- **Pinned first, running dot** — a pinned session is hoisted to the top of its
  workspace with a star, and a running session shows a dot, so the row can be read
  without clicking it.
- **Drag and drop** — a workspace dropped on another moves in front of it
  (`workspaces.insertBefore`); a session dropped on a sibling reorders it
  (`workspaces.insertSessionBefore`). A session refuses to leave its workspace: the
  Host stores sessions inside workspaces, and moving one would look like a delete.
- **Keyboard walk** — arrows move a highlighted row, Enter opens a session or folds a
  workspace, Escape closes the menu, then clears the filter, then drops the cursor.
- **Quiet rows** — the "..." action appears on hover or on the keyboard cursor instead
  of on every row at once, and a header control folds or expands every workspace.

Still owed: "/"-in-title grouping, per-row appearance, workspace presets, and the same
tree in the Hero picker.

## Why a session cannot change workspace

Drag reorder works inside a workspace and between workspaces, but a *session* cannot
be dragged into a different workspace, and that is the Host's shape rather than an
omission here:

- `packages/api/workspace-controller/src/index.ts` exposes these remotes:
  `create`, `initializeDefault`, `rename`, `delete`, `insertBefore`,
  `insertSessionBefore`, `archiveSession`, `unarchiveSession`, `pinSession`,
  `unpinSession` — and nothing that attaches or detaches a session.
- `packages/api/workspace-controller/src/commands.ts:132` resolves the target workspace
  and calls its own `insertSessionBefore(sessionId, beforeSessionId)`
  (`packages/workspace/workspace/src/entity.ts:152`), which reorders that workspace's
  `sessionIds`; `packages/workspace/workspace/tests/workspace.spec.ts:715` pins that a
  session the workspace does not hold is rejected.
- The entity does have `attachSession`/`detachSession`
  (`packages/workspace/workspace/src/types.ts:134` region), but no remote surfaces them.

So the tree refuses with "A session stays in its workspace; drag it within that
workspace to reorder." rather than attempting a call that throws. If the Host ever
exposes attach/detach, the gesture becomes a one-line change here — the drag payload
already carries `{ kind: 'session', id, workspaceId }`.

## Colour and weight

Right-click a workspace → **Colour and weight…** opens a six-tone palette (slate, blue,
green, amber, rose, violet) plus "none", and toggles a bold label. The choice is kept in
the app's own storage under `aryacode-polish:workspace-appearance.v1` as
`{ [workspaceId]: { tone, strong } }`, so it survives a restart without asking the Host
to remember anything. `readAppearance`/`writeAppearance` swallow every failure
(missing storage, quota, a locked-down webview), so a broken store costs the colours
and nothing else. `appearanceOf` ignores a tone it does not know, which keeps an old
entry from breaking the row if the palette ever changes.

## The Hero picker

The blank-session Hero's workspace chip is the same list, not a second implementation:
`conversation.hero.workspace` is a `single` slot at the root, so this bundle shadows it
at `priority: -1` beside `sidebar.workspaces` and both seats come and go with the one
switch. The slot hands over `{ open, anchorRef, selectedId, onPick, onClose }`: the card
is portalled to the anchor's bottom-left only while `open` is true (an unconditional
list floated over the Hero copy), it shows the same tone dots and bold labels as the
sidebar, and picking a row calls `onPick(workspaceId)` then `onClose()`.
