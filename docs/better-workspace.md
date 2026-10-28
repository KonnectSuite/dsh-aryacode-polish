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

## Folders from titles

A workspace whose label carries a path files itself under the prefix: rename
`Alpha` to `Work/Alpha` (workspace menu → **Rename workspace…**) and a collapsible
`WORK` row appears, carrying the session count of everything filed inside it. The
group is derived on every render from `folderKey(workspace)` — nothing is written to the
Host, nothing is cached, and renaming the workspace out of the prefix puts it back in
the flat list. `folderKey` refuses a leading slash, a trailing slash and a bare label, so
ordinary names never grow a folder.

## Order presets

**Remember this order** stores the current workspace ids under
`aryacode-polish:workspace-order.v1`; **Restore saved order** replays them. The Host
offers exactly one reorder verb (`insertBefore(movingId, beforeId)`), so restoring is
`planReorder(current, wanted)` — a pure function that walks the wanted order and emits
one move per workspace that sits in the wrong slot. Ids the Host no longer has are
filtered out first, so a preset that names a deleted workspace cannot shuffle the
survivors into the wrong places.

## Quick switcher

Ctrl/⌘-K opens a palette over every session in every workspace: the list is
`rankMatches(allSessions, query)`, which scores a title that *starts* with the query
above one that merely mentions it and keeps arrival order inside a rank (so "gre" puts
Greeting above later mentions). Arrows walk, Enter opens the session through
`uiWorkspace.openSession`, Escape or a backdrop click dismisses. It is portalled to
`document.body` with its own backdrop, so neither the sidebar's scroll container nor a
panel's stacking context can clip it.

## Folded state

`expanded` (workspaces) and `folders` (title folders) are seeded from
`aryacode-polish:folded.v1` and written back whenever either changes, so a restart looks
like the way out. Verified across a real restart: folding `WORK` left
`{"workspaces":{},"folders":{"Work":true}}` in storage and the folder still read `› WORK 2`
with its workspace hidden.

## Density

The header carries a density control that flips between comfortable (28 px rows) and
compact (22 px rows), remembered under `aryacode-polish:density.v1`. Density changes row
height only: the text keeps its size, so a compact tree is still readable on a laptop.
The row height travels through the CSS variable `--polish-ws-row`, which the tree element
sets from `DENSITY_METRICS`; nothing else in the row styling depends on the mode.

## Archived sessions

Archiving a session removes it from its workspace — that is what the Host means by
archived, and the shipped browser simply stops rendering it. Here those sessions keep a
collapsed **Archived** section at the bottom of the tree instead, dimmed and italic, with
their count on the header. Clicking one opens it; right-clicking offers **Unarchive
session**, which goes through `workspaces.unarchiveSession`. This also fixed a real gap:
before this, `workspaceRows` never consulted `archivedSessionIds`, so archived sessions
were being rendered inline in their workspace as if they were live.

## Folding everything

The header's fold control expands when anything is folded (folders included) and folds
only when nothing is. An earlier version only looked at workspace rows, so a folded
folder left the button saying "Expand all" while its workspaces stayed hidden.

## Glyphs and notes

A workspace can wear an emoji badge instead of the folder icon (**Glyph…** in its menu, ten
badges plus a clear button) and carry a short note (**Note…**, Enter saves, Escape cancels).
Both live in the same appearance record as the colour — one localStorage key, one shape —
and the note surfaces as the row's tooltip, so it costs no vertical space in the tree.

Glyph validation is deliberately narrow (one to four characters): the field is a badge in a
16 px slot, not a place to paste a sentence.

## Filing by drag

Dropping a workspace on a folder header files it there: the title is rewritten to
`Folder/Name` through the Host's own rename, so the move is durable and the shipped
browser (when this switch is off) sees exactly the same structure. `fileUnder(label, folder)`
replaces any previous prefix instead of stacking it — dragging `A/B/Gamma` onto `C` gives
`C/Gamma`, not `C/A/B/Gamma` — and a workspace already inside the target folder is not a
drop target, so the gesture cannot rename something onto itself.

## The note card

A workspace note shows as a small card under the row on hover rather than as a browser
tooltip: tooltips are slow to appear, unstyleable, and vanish when the pointer leaves. The
card is portalled, `pointer-events: none`, and only exists while a note does.

## Folders without content

A folder can be declared before anything lives in it (**New folder…** in a workspace menu).
It draws its own header with the word `empty` where the count would be, accepts a workspace
drop like any other folder header, and carries a `×` that removes the declaration. Declared
names live in `aryacode-polish:folders.v1`; the tree draws the names its workspaces imply
first and the declared ones after, so an empty folder never jumps ahead of real content and
disappears on its own the moment the first workspace is filed into it.

## Renaming a folder

A folder is not an object in the Host — it is the prefix of the titles inside it. So renaming
a folder means refiling every member: the header's `✎` asks for a new name, and each
workspace inside is renamed to `NewName/` + its own name through `workspaces.rename`. The
declared/empty list follows the old name to the new one, and the fold state moves with it, so
a renamed folder does not suddenly spring open.

## Filing is reversible

**Move to top level** appears in a workspace's menu only when it actually lives under a folder,
and does the inverse: `unfiled('Work/Alpha')` is `Alpha`, renamed through the Host like any
other title change. A folder left with nothing in it simply stops being drawn, unless it was
declared empty on purpose.

## Flags and notes on sessions

A session can carry a flag (`⚑`, shown before its title) and a note (shown on hover, in the same
card the workspace notes use). Both live in `aryacode-polish:session-marks.v1`, keyed by session
id, and both are set from the session's own menu: **Flag this session** / **Remove flag** and
**Session note…** (Enter saves, Escape cancels). The tree never invents a session, so a mark for a
session that no longer exists is simply never drawn.

## Copy the tree

The header's `⧉` copies the whole tree as indented text — folders, workspaces, sessions, with
`⚑` before a flagged session — through `navigator.clipboard.writeText`. It is meant for pasting
into a prompt or an issue: "here is what I am looking at", without screenshots.

## Folders only

The density button walks three states, not two: comfortable, compact, and **folders only**. The
last one keeps every folder and workspace row (with its real session count) and drops the session
rows entirely — useful when you are navigating the shape of your work rather than a specific
session. Nothing is lost: one more click returns to comfortable, and the mode is remembered in
`aryacode-polish:density.v1`.

One trap it exposed: the workspace count must come from the unfiltered session list. Reading the
list the tree was about to draw made every workspace read `0` in this mode, which looked like the
feature had eaten the sessions.

## Hopping between workspaces

With the tree focused, `[` and `]` move the keyboard cursor to the previous / next workspace head
and wrap at the ends. It is a second gear next to ArrowUp/ArrowDown: arrows walk rows, brackets
walk groups, so a long flat list of sessions stops being a scroll-and-squint exercise.

## Starting a session from a row

Every workspace row carries a hover `+` that calls `uiWorkspace.startSession(workspaceId)` — a new
session is created *in that workspace* and the app switches to it, which is the difference between
"new session" and "new session here". The composer's workspace chip changes accordingly.

Two things this cost, both worth keeping:

- The injected scope a seat receives is **not** a ctx: `seated.ctx.get(…)` throws
  `cannot get property "ctx" without inject`. Read extra services from the plugin's own `ctx`
  captured in `installWorkspaceSeat`.
- A row action that can fail must say so. The first version did nothing visible; the notice
  ("Started a session." / the thrown reason) is what identified the ctx mistake in one run.

## Pinning from a row

The hover star calls `workspaces.pinSession` / `unpinSession` — the shipped `★` marker and the
shipped ordering both follow, because it is the same Host verb the menu uses, not a local flag.

## Look presets

A look is tone + weight + glyph. **Save this look as a preset** stores that trio under the
workspace's name in `aryacode-polish:workspace-presets.v1`, and every preset then appears in every
workspace menu as `Apply: <name>` with a small `×` to forget it. Notes are deliberately not part of
a preset: a note is about one workspace, a look is about a kind of work.

Saving is refused when the workspace has no look yet ("Give this workspace a look first."), which is
the honest answer rather than storing an empty preset nothing would visibly change.

## Sorting

The header's `↕` / `A→Z` control switches between the Host's own order and an alphabetical
one, remembered in `aryacode-polish:sort.v1`. Alphabetical sorting is folder-aware: unfiled
workspaces come first, then each folder's workspaces sorted by name, so a folder never splits in two.
Sorting is a view concern only — it never renames or reorders anything on the Host.

## Jumping to a workspace

Ctrl/⌘-K lists workspaces as well as sessions: a workspace row carries `⌂` and the hint
`workspace`, and choosing it unfolds its folder, opens the workspace and highlights the row
("Jumped to <name>.") instead of opening a session. Sessions keep their existing behaviour: Enter
opens the session.

## Pinned sessions

Pins are the Host's own `pinnedSessionIds`, so nothing is stored locally. A pinned session is lifted
out of its workspace into a **Pinned** section at the top of the tree, with its workspace name beside
it, because a pin that only draws a star on a row you must first find is not doing much. The section is
collapsible, keeps the Host's order, and right-clicking a pinned row opens the ordinary session menu —
where **Unpin session** puts the session back where it belongs.

Archived still wins: an archived session never appears in Pinned.

## What a session has cost

A session row shows the priced total for that session (`≈$0.00016`) when the cost feature has
something to show. The number comes from the `polishCost` projection the Host half already writes:
`costOf(snapshot, sessionId)` reads `snapshot.projectionsBySession[sessionId].values.polishCost`, so
the tree never prices anything itself and never disagrees with the composer pill.

Two honest cases are covered by tests rather than by hope:

- **Nothing priced** — a session with no recorded usage, or a Shell where the cost feature is switched
  off, renders no cost at all. It does not render `≈$0`, because that would be a lie about a session
  that simply has not spent anything yet.
- **Partially priced** — the projection marks usage it could not price; the label then leads with `~`
  instead of `≈`, the same convention the composer uses.

## Renaming a session

Double-clicking a session title opens an inline editor in the tree, pre-filled with the current title;
Enter commits, Escape abandons. The write goes through the Host verb `session.rename` — the workspace
navigation service (`uiWorkspace`) exposes no rename entry point, which is why an earlier attempt
failed with "no rename dialog here". A refusal is reported as a notice rather than swallowed.

## Dragging a workspace out of a folder

While a filed workspace is being dragged, a dashed **Drop here to leave the folder** zone appears at
the foot of the tree; dropping on it renames the workspace back to its bare name, which is the same
thing the **Move to top level** menu row does — now reachable without opening a menu.

## Totals

A session row shows what that session has cost (`costOf`/`costLabel`), a workspace row shows the sum
of its sessions (`sumCostLabel`), and a folder header shows the sum of everything filed under it
(`folderCostNode`). All three read the same host-side `polishCost` projection the composer pill uses,
so no price maths happens twice. A group with nothing priced renders nothing at all — never a
misleading ≈$0 — and a group priced only in CNY shows ¥.

## Adding into a folder

Every folder header carries its own `+`. It opens the same add-workspace flow as the header button,
and when the flow returns a folder the newly created workspace is renamed into that folder
(`fileUnder`), so a folder can grow without a follow-up rename.

## Menus from the keyboard

Shift+F10 (or the keyboard's menu key) on a focused row opens exactly the menu a right-click opens —
the workspace menu for a workspace row, the shipped session menu for a session row. The anchor is the
row's own rectangle, so the menu lands where the row is, not at the tree's corner.

## Folding the others

Alt+click a folder header to fold (or unfold) every other folder in one gesture — the "show me just
this folder" move. The same header carries a success dot while any session filed under it is running,
so a busy folder is visible without expanding it.

## Moving a workspace onto another one

Dropping a workspace onto another workspace row does both halves of the move: it re-files the moving
workspace into the target's folder (or out to the top level when the target is unfiled) and then
repositions it immediately before the target. Two Host calls, one gesture — `rename` then
`insertBefore`. A drop on a folder header still only files.

## Teaching itself

`?` (or the header's `?`) opens a sheet listing every gesture: Enter, `[`/`]`, `/`, Ctrl+K,
Shift+F10, Alt+click, double-click, drag. Until that sheet has been opened once, one dim line under
the filter says so; opening it stores `aryacode-polish:help.v1` and the hint stops. A storage that
refuses to remember only means the hint stays.

## The pinned section is a surface

A pinned row carries the same information as a session row in its workspace: title, running dot, what
it has cost, and a hover star that unpins it in place. Its context menu is the shipped session menu,
so Pin/Rename/Fork/Archive/Copy ID/Open workspace folder all work there too — including duplication.

## A folder has a look too

Right-clicking a folder header opens a panel with a colour, a glyph and a bold/weight toggle, plus
rename and (for a declared but still empty folder) remove. Folders are title prefixes, not Host
objects, so the look is stored under `folder:<name>` in `aryacode-polish:workspace-appearance.v1`:
one store, and a folder rename moves its entry with the members it renames.

## Pinning by drag, and type-ahead

Dragging a session onto the **Pinned** header pins it; dragging a pinned row onto a workspace releases
it again. Both go through the same Host verbs the menus use, so nothing here can drift from them.

Typing a printable key while the tree has focus jumps the cursor to the first title with that prefix —
transient, 700 ms, so "bu" then "i" narrows to "Build the thing" instead of restarting.

## Filtering shows its work

Typing in the filter hides rows, which on its own is ambiguous: a shorter tree can mean "nothing
else matched" or "the tree is empty now". So the tree says what happened — `n matches`, and the
matched slice of each title is wrapped in a `mark` — and Escape clears the filter back to
everything. Home and End jump to the ends of the keyboard walk, because arrowing past thirty
sessions to reach the last one is not a feature.

## The palette can act

Ctrl-K started as a jumper: type a title, press Enter, you are there. It carries one more kind of hit
now — `New session in <workspace>` for every workspace — so the same box that finds work can start
it. The rule is deliberate: jumping hits come first (that is what the muscle memory expects), actions
follow, and every row says which it is in the hint on the right.

## The header menu

The header carries five small glyphs, and small glyphs are a poor inventory of what a panel can do.
Right-clicking the header opens the same actions spelled out — copy the tree, fold or expand
everything, the three densities, the two sort orders, "Reset the tree" (which returns to
`treeDefaults()`: no filter, nothing folded, comfortable rows, host order) and the shortcut sheet.
The menu is generated from the same lists the icons use (`DENSITIES`, `SORTS`), so a new density
appears in both places at once.

## Running sessions

The session rows the sidebar store hands a plugin never carry `running`; they carry
`id, displayTitle, retainedBy, blank, updatedAt, formatStatus, projectionValues, title, cwd` and a
`running` flag that stays `false` even while the Shell shows its Stop control. Measured on a 250-line
turn: every row reported `running=false`.

The live truth is the slot's `useSessionStatus` store, the same one the shipped browser reads
(`packages/client/ui-workspace/src/client/tree.ts:401 running: status?.running ?? s.running`). This
component reads it and falls back to the row flag, so:

- a session's running dot lights while a turn runs,
- a folder shows a dot when any session inside it is busy,
- the header shows `● n` only while n sessions are running, and clicking it clears the filter, unfolds
  the folder and expands the workspace holding the first busy session.
