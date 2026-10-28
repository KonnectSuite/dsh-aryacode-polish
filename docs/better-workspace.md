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
