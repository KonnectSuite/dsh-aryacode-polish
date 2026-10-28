## [0.61.0]

Flagging a session no longer needs the menu.

### Added
- A flag button appears on a hovered (or keyboard-focused) session row, next to the menu: one click
  sets or clears the flag through the same `withMark` store the menu uses, so the `#` filter and the
  Flagged chip see it immediately.

## [0.60.0]

Long session lists read as history.

### Added
- **Group sessions by day** in the header menu buckets each workspace's sessions under Today /
  Yesterday / Previous 7 days / Older (`dayBucket`, `groupByDay`), stored in
  `aryacode-polish:daygroups.v1`. The headings only appear when a workspace actually spans more than
  one bucket, so a young workspace looks exactly as it did.

## [0.59.0]

Star the workspaces you live in; they rise above the folders.

### Added
- **Star this workspace** in the row menu floats a workspace to the top under a Starred heading,
  stored in `aryacode-polish:starred.v1` (`orderStarred`, `toggleStarred`, `readStarred`,
  `writeStarred`). Nothing is duplicated: starring reorders, it does not clone.

## [0.58.0]

Hovering a workspace now explains it.

### Added
- `workspaceRecap(group, snapshot, opts)` renders two lines — how many sessions and how many are
  new, then what it has cost and how long ago it was last touched — shown in the existing hover
  card (a hand-written note still takes precedence).

## [0.57.0]

New work is visible without unfolding anything.

### Added
- A dot on a workspace row and on a folder header while anything inside still wants attention
  (`unreadInside`), so a folded workspace cannot hide a session that changed.
- `Alt+ArrowDown` / `Alt+ArrowUp` jump to the next or previous new session, wrapping once, with
  a notice when there is nothing new that way.

## [0.56.0]

The unread dots got a filter of their own.

### Added
- A **New** chip and a `t:new` token that keep only sessions you have not opened here since they
  changed, wired through a new `unread` option on `filterTree`.
- The header tooltip now reports how many sessions are new (`6 sessions in 2 workspaces · 4 priced
  · 2 new`).

## [0.55.0]

Sessions you have not looked at since they changed say so.

### Added
- An unread dot on any session whose `updatedAt` is newer than the last time you opened it here
  (`isUnread`, `readSeen`, `writeSeen`, `SEEN_KEY` — `aryacode-polish:seen.v1`), cleared when you
  open it from the tree and by **Mark everything as read** in the header menu.
- `unreadIds` for anything that wants to count them.

## [0.54.0]

One-click filters, and a date you can filter by.

### Added
- Chips under the filter — **All**, **Running**, **Flagged**, **Today** — that add or remove the
  matching operator token, so the query and the chips can never disagree.
- `t:today` and `t:week` filter tokens, honoured by `filterTree` against each session's
  `updatedAt` (local midnight for "today").
- `startOfToday`, `queryHasToken`, `withToken`.

## [0.53.0]

The undo reaches the row menus, and folders can stand in the order you keep them.

### Added
- Undo after a single **Unarchive** too (the inverse is archiving it again), so the offer is
  no longer limited to bulk actions.
- `orderFolders`, `applyFolderOrder`, `moveFolder`, `readFolderOrder`, `writeFolderOrder` and
  `FOLDER_ORDER_KEY` (`aryacode-polish:folderorder.v1`): the tree re-groups folders into a
  hand-kept order, appending any new folder alphabetically.
- Folder menu rows **Move this folder up**, **Move this folder down** and **Alphabetical order**.

## [0.52.0]

A bulk action you regret is now a bulk action you can take back.

### Added
- `plural(count, one, many)` so a notice never reads like a template
  ("Archived 1 session." instead of "Archived 1 sessions.").
- The notice after a bulk **Archive** or **Flag** carries an **Undo**, available for
  twelve seconds. Archiving is undone by unarchiving exactly the sessions that were
  archived (not the ones the Host refused), flagging by restoring the marks map that
  was replaced.

## [0.51.0]

Named views, then the tree learned to report itself: the header now says how many
sessions it holds and what they have cost in total.

### Added
- `treeTotals(rows, snapshot)` — sessions, workspaces, priced sessions, and the summed
  cost per currency, taken from the same projection the rows read.
- The header line `<n> · ≈$<total>`, with a tooltip naming how many priced sessions
  are behind the number.

## [0.50.0] - 2026-10-28

- Saved views: the header menu can remember the filter, the sort and the density under a name, apply any of them in one click, and forget them again.

## [0.49.0] - 2026-10-28

- Ctrl-click picks sessions, shift-click picks a span, and one bar acts on all of them: pin, flag, archive, copy ids. Escape clears; a plain click on a picked row clears without opening.

## [0.48.0] - 2026-10-28

- The filter speaks operators: `!` keeps running sessions, `#` keeps flagged ones, `@name` scopes the tree to a workspace or folder. The input advertises the syntax and the match counter follows the filtered rows.

## [0.47.0] - 2026-10-28

- Bulk actions in the tree: right-click a folder for "Collapse/Expand workspaces here", and right-click the Archived header to restore the whole shelf at once.

## [0.46.0] - 2026-10-28

### Added

- A running session shows how long it has been running (`12s`, `3m`), ticking every five seconds while
  work is in flight and easing back to thirty when nothing is. The status store publishes no start time,
  so the clock counts from the moment this window saw the run, and the tooltip says exactly that.

## [0.45.0] - 2026-10-28

### Added

- Every session row says how long ago it was touched (`now`, `5m`, `3h`, `2d`, `1w`), refreshed on a
  half-minute tick, with the exact moment in the tooltip. Rows without a usable stamp show nothing.

## [0.44.0] - 2026-10-28

### Added

- `Recent first` sort mode for the workspace tree: ranks each workspace by the newest
  `updatedAt` any of its sessions carries, sinking a workspace nothing has touched below one
  that has been used, and falling back to names when no stamp is usable.

## [0.43.0] - 2026-10-28

- The running dot reads the slot's live status store (`useSessionStatus`) instead of the session
  summaries, whose `running` flag stays false even while the Shell shows Stop — the 0.30 folder dot had
  never lit.
- A session's own cost opens the same breakdown card as the workspace total.
- The header carries `● n` while n sessions run, including one the tree has not listed yet; clicking it
  unfolds to the session or opens it.

## [0.40.0] - 2026-10-28

- A workspace's cost total is now a door: clicking it opens the breakdown behind the number — cache hit
  share, uncached, cached and written tokens, output, requests, how many sessions were priced, and the
  same "your provider's bill is authoritative" line the composer card carries.
- The card reads the same projection the total was summed from, so the two can never disagree.

## [0.39.0] - 2026-10-28

- Sort workspaces by what they have spent: "Most spent first" ranks the tree by the cost totals already
  shown on every workspace row, and a workspace nobody has spent in sinks to the bottom instead of
  jumping to the top on a zero.
- Every sort mode now gets its label from one table (SORT_TITLES), so the menu can never name a mode
  that does not exist.

## [0.38.0] - 2026-10-28

### Added

- Right-click the WORKS PACES header for a menu that names the whole surface: copy the tree, fold or
  expand everything, pick a density, pick a sort order, reset the view, or open the shortcut sheet —
  the icons are no longer the only way in.

## [0.37.0] - 2026-10-28

### Added

- Ctrl-K is a palette, not only a jumper: every workspace contributes a "New session in <workspace>"
  action, so the same box that finds work can start it. Actions are marked with a caret and their
  hint reads `action`.

## [0.36.0] - 2026-10-28

### Added

- The filter now says how many rows survived it, and marks the part of the title that matched, so a
  filtered tree explains itself instead of just getting shorter.
- Home and End jump to the first and last row of the keyboard walk.

## [0.35.0] - 2026-10-28

Added: drop a dragged session on the Pinned header to pin it, and drag a pinned row onto a workspace to
release it — the pinned section now takes sessions in and gives them back without a menu.

Added: type-ahead. Typing a letter in the tree jumps the keyboard cursor to the first workspace or
session whose title starts with what you typed, with a 700 ms window so a word refines the match.

## [0.34.0] - 2026-10-28

Added: a folder carries its own colour, glyph and weight, set from its own menu (right-click a folder
header). A folder is only a title prefix, so its look lives under a reserved `folder:` key in the same
store the workspace looks use — which also means a renamed folder keeps its look instead of losing it.

Added: that menu also renames the folder and removes a declared empty one, so every folder action now
hangs off the folder rather than a pencil button.

## [0.33.0] - 2026-10-28

Changed: a pinned row now shows what that session has cost and carries its own hover unpin star, so
the pinned section is a working surface rather than a shortcut list.

Added: the running indicator is named (`data-polish-session-running`) and mirrored onto pinned rows,
so a busy session reads the same wherever it appears.

## [0.32.0] - 2026-10-28

Added: a shortcut sheet (? or the header's ? button) listing every gesture the tree answers to, and a
one-line hint under the filter that disappears once the sheet has been opened
(`aryacode-polish:help.v1`).

## [0.31.0] - 2026-10-28

Changed: dropping a workspace onto another workspace row now re-files it into that row's folder and
repositions it in one gesture (rename first, then `insertBefore`), instead of only reordering.

Added: an archived session's menu can open it or copy its id, so an archived row is not a dead end.

## [0.30.0] - 2026-10-28

Added: a folder header shows a small success dot when any session filed under it is running
(`folderHasRunning`), and Alt+click on a folder folds or unfolds every other folder at once.

Fixed: the flagged-session glyph had been mojibaked again by a PowerShell patch; it is \u2691.

## [0.29.0] - 2026-10-28

Added: every folder header has its own `+` that opens the add-workspace flow and files the newly
created workspace inside that folder (`fileUnder`), so a folder can grow without a rename afterwards.
Shift+F10 (or the keyboard's menu key) on a focused row now opens the same menu the right-click
opens, for workspaces and sessions alike.

## [0.28.0] - 2026-10-28

Added: a workspace row and a folder header now show the running total their sessions have cost, from
the same `polishCost` projection the composer pill uses (`sumCost`, `sumCostLabel`,
`folderCostNode`). Nothing priced renders nothing, and a group priced only in CNY shows ¥.

Fixed: the folder rename glyph had been mojibaked (`âœŽ`) by an earlier PowerShell patch; it is
✎ again.

## [0.27.1] - 2026-10-28

Fixed: 0.27.0 double-clicked straight into a rename with the unchanged title. It now opens an inline editor (the workspace navigation service has no rename entry point, so the Host verb `session.rename` does the write).

## [0.27.0] - 2026-10-28

Added: double-clicking a session in the tree raises the Host's own rename dialog, and dragging a filed
workspace onto the top-level drop zone lifts it out of its folder — the gesture had a menu entry but no
drag equivalent.

## [0.26.0] - 2026-10-28

Added: a session row shows what that session has cost so far, read from the `polishCost` projection the
cost feature already writes. The number is hidden when nothing is priced, so a Shell without the cost
feature shows no cost rather than a fake zero.

Fixed: the "flagged" glyph on a session row had been written as mojibake by an earlier PowerShell
patch and never rendered as a flag.

## [0.25.0] - 2026-10-28

Added: pinned sessions are lifted into a Pinned section at the top of the tree, with their workspace
name beside them and the usual session menu on right-click — a pin used to be a star on a row you had
to find. Unpinning puts the session back where it belongs.

## [0.24.0] - 2026-10-28

Added: a sort control in the tree header (host order or A to Z, folders kept together), and workspace
entries in the Ctrl-K switcher that reveal the workspace in the tree instead of opening a session.

# Changelog

## [0.23.1] - 2026-10-28

Fixed: 0.23.0 shipped the preset menu without its face spec, so nothing in the tests kept it in the bundle.

## [0.23.0] - 2026-10-28

Added: save a workspace look as a named preset and apply it to another workspace from its menu.

## [0.22.4] - 2026-10-28

Fixed: the workspace navigation service is read from the plugin context, because the injected scope refuses property reads it did not name.

## [0.22.3] - 2026-10-28

Fixed: starting a session from a workspace row resolved the navigation service at click time and reports what happened instead of failing silently.

## [0.22.1] - 2026-10-28

Fixed: the hover actions shipped in 0.22.0 without their face spec, so the guard that keeps them in the bundle was missing.

## [0.22.0] - 2026-10-28

Added: a hover + on each workspace row starts a session in that workspace, and a hover star pins or unpins a session in one click.

## [0.21.2] - 2026-10-28

Fixed: the folders-only density showed a zero count because it read the hidden session list instead of the real one.

 - 2026-10-28

Added: a folders-only density that hides session rows, and [ / ] to hop between workspaces.

## [0.20.0] - 2026-10-28

Added: session flags and notes, shown on the row and on hover; the whole tree can be copied as indented text from the header.

## [0.19.0] - 2026-10-28

### Added
- **Move to top level** in a workspace menu drops the folder prefix, so filing is reversible.
- **Rename a folder** from its header: every workspace inside is refiled under the new
  prefix through the Host rename, and the declared/empty list follows the folder.


## [0.18.0] - 2026-10-28

### Added
- **Folders that exist before their content.** The workspace menu can declare a folder, an
  empty folder draws its own header with an empty count, accepts a workspace drop, and
  can be removed again. Declared folders are remembered (ryacode-polish:folders.v1).


## [0.17.0] - 2026-10-28

### Added
- **Drop a workspace on a folder header to file it there.** The title is rewritten to
  Folder/Name (any previous prefix is replaced, not stacked) through the Host rename.
- **A workspace note shows as a card on hover**, not just as a tooltip title.


## [0.16.0] - 2026-10-28

### Added
- **A glyph per workspace.** The workspace menu can put an emoji badge in front of a
  workspace instead of the folder icon, and the choice is remembered with the colour.
- **A note per workspace.** The note shows as the row tooltip and is edited from the same
  menu; Enter saves, Escape cancels.


## [0.15.2] - 2026-10-28

### Added
- **Density modes.** A control in the tree header switches between comfortable and
  compact rows, and the choice is remembered (`aryacode-polish:density.v1`). Density
  changes row height only — the text size stays readable.

### Fixed
- **Expand all now expands folders too.** The header button only flipped workspace rows, so a
  folded folder kept its workspaces hidden while the button claimed everything was open.
- **Archived sessions no longer sit in their workspace.** The tree now reads
  `archivedSessionIds` (it never did) and shows those sessions in a collapsed
  **Archived** section at the bottom, each one restorable from its own menu.

## [0.14.0] - 2026-10-28

### Added

- **Quick switcher.** Ctrl/⌘-K (or Cmd-K) opens a palette over everything: every session
  in every workspace, ranked so a prefix beats a mention, arrows to walk, Enter to open,
  Escape to dismiss. Rows show the session title and the workspace it lives in.
- **Folded state persists.** Which workspaces and which folders are collapsed is kept
  under `aryacode-polish:folded.v1`, so reopening the app looks like it did on the way
  out. A storage that refuses costs the memory and nothing else.

## [0.13.1] - 2026-10-28

### Added

- **Rename a workspace in place.** The workspace menu opens an input under the search
  box; Enter (or blurring) sends `workspaces.rename`, Escape abandons it. Renaming to
  `Work/Client A` is also how a workspace joins a folder.

### Fixed

- `planReorder` ignores ids the Host no longer has, so a saved order that names a
  deleted workspace cannot shuffle the survivors into the wrong slots.

## [0.13.0] - 2026-10-28

### Added

- **Folders from titles.** A workspace named `Work/Client A` files itself under a
  collapsible `Work` row, with the folder's session count on the right. The grouping is
  derived from the label and written nowhere, so renaming the workspace moves it.
- **Order presets.** The workspace menu can "Remember this order" and later "Restore
  saved order", which replays the Host's only reorder verb — `insertBefore` — through a
  pure `planReorder(current, wanted)` plan, stored under
  `aryacode-polish:workspace-order.v1`.

## [0.12.1] - 2026-10-28

### Fixed

- The Hero list now only appears when the workspace chip is open, and it paints a
  card of its own instead of an unstyled list floating over the Hero copy.

## [0.12.0] - 2026-10-28

### Added

- **Colour and weight per workspace.** Right-click a workspace → "Colour and
  weight…" paints it one of six tones (slate, blue, green, amber, rose, violet) or
  none, and can make its label bold. The choice is stored under
  `aryacode-polish:workspace-appearance` in the app's own storage, so it survives a
  restart, and a broken or missing store degrades to the plain tree instead of
  throwing.
- **The same workspaces in the Hero picker.** The blank-session Hero now offers this
  bundle's workspace list (tone dots, bold labels, session counts) instead of the
  stock picker, through `conversation.hero.workspace` at priority -1 — same data,
  same colours, one switch.

## [0.11.2] - 2026-10-28

### Verified

- Drag reorder now has live proof, not just unit tests: with two workspaces in the
  Dev AryaCode desktop, dropping the second workspace on the first reordered them
  (`workspaces.insertBefore`), and the new order survived a full app restart.

### Fixed

- A session is never promised a move the Host cannot make. The remote workspace
  namespace exposes `create`, `rename`, `delete`, `insertBefore`,
  `insertSessionBefore`, `archiveSession`, `unarchiveSession`, `pinSession` and
  `unpinSession` — and no `attachSession` or `detachSession` — while a workspace's own
  `insertSessionBefore` only reorders the sessions already inside it (it rejects a
  session it does not hold). So dropping a session on another workspace is refused
  with a plain explanation instead of firing a call that fails, and the session menu
  no longer offers "Move to <workspace>".

## [0.10.0] - 2026-10-28

### Added

- A filter box in the workspaces header: it narrows workspaces and sessions, opens
  every group it keeps so a match is never hidden, and reports "n of m sessions".
  `/` focuses it from anywhere in the app and Escape clears it.
- Pinned sessions are hoisted to the top of their workspace with a marker, and a
  running session shows a dot, so the row reads before you click it.
- Drag and drop: a workspace row dropped on another moves in front of it
  (`workspaces.insertBefore`), a session row dropped on a sibling reorders it
  (`workspaces.insertSessionBefore`); a session refuses to leave its workspace.
- Keyboard walking: arrow keys move a highlighted row, Enter opens a session or
  folds a workspace, Escape closes the menu, clears the filter, then drops the cursor.
- Row actions appear on hover or on the keyboard cursor instead of always, and a
  header control folds or expands every workspace at once.

### Fixed

- The tree no longer renders every "..." button permanently, which was what made a
  three-row sidebar look like a nine-row one.

## [0.9.6] - 2026-10-28

### Fixed

- A workspace whose Host title merely repeats its id is humanised, because that is
  what the default workspace's title is.

## [0.9.5] - 2026-10-28

### Added

- Better workspace carries the add control the stock browser had: a header with a
  "+" that opens this bundle's own source menu (On this PC or a GitHub repository)
  and adds the chosen folder as a workspace.
- The default workspace no longer shows its raw id: an empty Host `title` is
  humanised ("default-workspace" reads "Default workspace").

## [0.9.4] - 2026-10-28

### Fixed

- The seat's `inject()` is called with the standard props the runtime captured, so the
  menu renders again after 0.9.3 referenced a name that only lived in the factory.

## [0.9.3] - 2026-10-28

### Fixed

- Each menu seat's own `inject()` runs before its occupant renders, so this bundle's
  "Open workspace folder" row is back beside the shipped rows instead of silently
  rendering nothing for want of the services it declared.

## [0.9.2] - 2026-10-28

### Fixed

- The shipped session menu rows (Pin, Rename, Fork, Archive) now receive the standard
  hooks they call -- `usePinned`, `useArchived`, `useSessionAccess` and `useShortcuts` --
  derived from the snapshots this seat already subscribes to, instead of throwing
  `TypeError: usePinned is not a function` inside `usePinState`.

## [0.9.1] - 2026-10-28

### Fixed

- Better workspace reads the session list as `{ ids, byId }` and keeps the Host order;
  it no longer re-sorts on a timestamp `SessionSummary` does not carry.

## [0.9.0] - 2026-10-28

### Added

- Better workspace (`betterWorkspace`): our own sidebar browser registered into
  `sidebar.workspaces` at `priority: -1`, with the shipped session menu rendered
  inside it and a right-click menu on every workspace row (open, copy path, remove).
  See `docs/better-workspace.md` for why this is a takeover rather than a menu item.


## [0.8.2] - 2026-10-28

### Fixed

- The camera floated over the panel with metrics of its own, so it read as a
  foreign control. It now mounts into the docking kit's chrome seat beside the
  Shell's own presentation and collapse buttons, wearing that cluster's 28px box,
  15px glyph, hover state and tooltip, and it follows the strip through docked,
  split and fullscreen layouts.

## [0.8.1] - 2026-10-28

### Changed

- The camera moved out of the composer row and next to the right panel's own
  controls. The composer dock entry stays, invisibly, to publish the session
  context the button needs.

## [0.8.0] - 2026-10-28

### Added

- **Right-panel screenshot.** A camera button in the composer row photographs the
  right panel's open tab, copies the PNG to the clipboard, and attaches it to the
  message being written — one click in place of a snip tool, for the panel rather
  than the whole screen. The capture is a DOM rasterisation inside the page,
  because the Shell exposes no capture bridge and no display-media source; the
  browser tab and the HTML preview live in iframes and are the two surfaces it
  cannot see. `docs/panel-screenshot.md` records the limits.

### Changed

- `html2canvas` 1.4.1 is vendored at `vendor/html2canvas.min.js` and inlined into
  `lib/client.js` by `pnpm build:client`: the Shell's module table answers `react`
  and `react-dom` only, so a rasteriser has to travel inside the bundle.

## [0.7.3] - 2026-10-28

### Fixed

- **A sign-out that only looked like one.** gh auth logout --user removes the
  account it names, and a machine with a second account in the CLI keyring makes
  that one active, so the dialog quietly carried on as somebody else while the
  sidebar still named the old account. Signing out now reports the account the
  CLI fell back to, offers **Sign out all** when more than one account exists,
  and the footer line follows the dialog immediately instead of waiting for the
  next window focus.

## [0.7.0] - 2026-10-28

### Added

- **Sign in and sign out of GitHub from the dialog.** Sign-in is still the GitHub
  CLI's own session — this bundle stores no token — but it no longer sends the
  owner to a terminal: the dialog runs `gh auth login --web`, shows the one-time
  code it prints with a copy button and the device page, and refreshes the
  repository list as soon as the CLI reports success. A signed-in machine gets a
  two-step **Sign out** (`gh auth logout --hostname github.com --user <login>`),
  and a pending sign-in can be cancelled. The footer row shows which state the
  machine is in, so the answer to "am I signed in?" is visible without opening
  anything.

## [0.6.2] - 2026-10-28

### Fixed

- **The "+" menu and the GitHub dialog are opaque again in the desktop app.**
  Both are portaled to `document.body`, which puts them outside the themed tree,
  and they painted themselves with the harness menu fill `--dsw-specific-menu`
  (`#f8f9fa94`, 58% alpha) relying on `backdrop-filter` to make that read solid.
  The AryaCode desktop build does not composite that blur, so the page showed
  through the panel. Every portaled surface now lays that fill over an opaque
  `Canvas` base and keeps the blur only where the platform honours it.

## [0.6.1] - 2026-10-28

### Fixed

- **"On this PC" opens the real Windows folder dialog in the desktop app again.**
  The desktop preload exposes the OS chooser as `__DSH_DIRECTORY_PICKER__.pick()`
  — the same bridge the shipped native picker uses — and the flow now calls it
  directly, so picking a folder behaves exactly like the picker it stands in for.
  The in-app folder list is now only the browser fallback, where no such bridge
  exists and the composed picker's `pick` would wait on a dialog that cannot open.

## [0.6.0] - 2026-10-28

### Changed

- **Adding a workspace moved into the Workspaces "+" menu.** A new switch
  (`workspaceSources`) occupies `sidebar.workspaces.directoryFlow`, which is what
  makes the Shell's **Add workspace…** row appear at all, and stands in for the
  folder picker with the source menu the owner asked for: **On this PC** (a folder
  browser driven by this bundle's own `api/polish.folders` route) and **GitHub
  repository…** (the existing dialog). A finished clone hands its path to the
  flow's `onPicked`, so the Shell creates the workspace exactly as it does for a
  picked folder.

### Added

- The sidebar foot now carries the GitHub sign-in state next to the balance
  (`GitHub · <login>` / `GitHub · signed out`); clicking it opens the repository
  dialog. It replaced the foot's add-workspace row, which the "+" menu supersedes.

### Fixed

- "On this PC" lists folders instead of waiting on a chooser that cannot open. A
  composed directory picker serves one capability, `browse` or `native`, and the
  browser build composes the one with no chooser to show, so the previous
  `directoryPicker.pick()` call simply never settled. The flow now walks folders
  through its own route: roots, a `..` row for going back, directories only, and
  hidden or system entries filtered out.

## [0.5.0] - 2026-10-27

### Added

- **Add a workspace from GitHub.** A new switch (`githubWorkspace`) adds an
  **Add workspace from GitHub** entry to the sidebar foot. It lists the
  repositories the GitHub CLI session can clone, clones the chosen one into
  `<home>\AryaCode\<owner>\<repo>`, and registers that folder as a workspace
  through the same controller call the "+" menu uses. The token never reaches the
  browser: the Host reads it with `gh auth token` and hands it to git as an
  `http.extraHeader` in git's environment, so it stays out of the URL, the
  command line, and any stored remote. See
  [`docs/github-workspaces.md`](docs/github-workspaces.md).

### Fixed

- **A clone would have failed on a real machine.** `cloneRepo` spawned the
  argument list without the `git` command name and passed the token as an option
  the runner never read, so the clone carried no authentication at all. It now
  spawns `git` with the token in `GIT_CONFIG_*`, which is what GitHub's git
  server accepts, and `test/github.spec.mjs` pins the spawn shape.
- **The signed-out reason told you nothing you could act on.** It now names the
  command that fixes it (`gh auth login`).

### Changed

- `pnpm test` also runs `test/github.spec.mjs`; the suite is 87 tests.

## [0.4.4] - 2026-10-27

### Fixed

- **The row reported "this Host cannot open a folder" on a Host that can.** A Remote
  method answers an envelope — `{ ok, value }` — not the bare return value, so
  `canOpenWorkspacePath()` never looked like `true`. The row now reads
  `ok === true && value === true`, tolerates a plain boolean, and checks the
  `ok` flag of the open call itself instead of trusting that no throw means opened.

## [0.4.3] - 2026-10-27

### Fixed

- **The row still could not open anything.** 0.4.2 declared `remote.session` but the
  guard checks each namespace on its own: reading `ctx.remote.session` needs both
  `remote` and `remote.session` on the inject list, so the call failed one level
  earlier. The registration now declares `['workspaces', 'remote', 'remote.session']`.

## [0.4.2] - 2026-10-27

### Fixed

- **The row did nothing when clicked.** The Shell refuses `ctx.get('remote.session')`
  — a Remote namespace may only be read through a declared injection — so the open
  call failed before it reached the Host. The registration now declares
  `ctx.inject(['workspaces', 'remote.session'], …)` and calls the namespace the
  injected context hands it. Found by the row reporting its own failure (0.4.1).

## [0.4.1] - 2026-10-27

### Changed

- The **Open workspace folder** row reports a failed open instead of doing nothing.
  A menu row that silently ignores the click is impossible to diagnose in the
  field; the bundle now writes one console.warn naming the failing step (no
  Session Remote, a Host that cannot open a path, or the Remote error itself).

## [0.4.0] - 2026-10-27

### Added

- **Open workspace folder.** A Session's "…" menu gains an **Open workspace folder**
  row that opens the Session's workspace directory in Explorer/Finder through the
  Session Remote (`openWorkspacePath`), gated by `canOpenWorkspacePath` and resolved
  from the Workspace snapshot. New switch `openWorkspaceFolder`, on by default, and
  the row hides itself when the Session has no workspace or the Host cannot open a
  path.
- `docs/workspace-folder.md` records why the requested surface — right-clicking the
  workspace row itself — is not reachable from a plugin: that row has no context
  menu, the workspace-scoped menu list slot does not exist, and native menus and
  desktop IPC are closed to plugins. The bundle ships on the documented Session-row
  slot rather than hijacking private markup, and the note says where the feature
  should move if a workspace-scoped slot ever lands.

## [0.3.9] - 2026-10-27

### Changed

- **The cost pill now looks like it belongs in the composer.** It was a foreign
  widget next to the harness pills: two lines of text ("≈$0.538 partially
  priced") in the row's flow. It now wears the same skin as the statistics pills
  — the same 13 px-minus-one scale, 20 px line height, `1px 8px` padding, tertiary
  label colour, tabular digits, a 14 px glyph, and `white-space: nowrap`, so it
  reads as one line at the same size as its neighbours.
- The "partially priced" caveat moved out of the pill and into the card, where it
  can be read. The pill keeps a single `*` marker for the same fact.
- The breakdown card is now the harness's own stat-dialog: same panel width
  clamp, 16 px padding, `--dsw-radius-lg` corners, menu backdrop, prominent
  elevation, 12/18 type, a two-column definition list with tabular figures, and
  a portaled `position: fixed` panel measured from the pill so it cannot be
  clipped by the composer scroller. It closes on outside click and on Escape.

## [0.3.8] - 2026-10-27

### Fixed

- **The balance line never showed a number.** It waited for the host account
  bundle's own access grant before reading, on the theory that the grant proves
  the call is allowed. That grant belongs to the bundle that owns the account
  stream, so for a plugin it can simply never arrive — the read hit its timeout,
  resolved to nothing, and the sidebar looked empty with no error anywhere. The
  line now reads the account Remote directly inside
  `ctx.inject(['remote', 'remote.account'], …)`, and the Host still decides: an
  unauthorised call comes back refused and the line stays hidden.
- The read retries on its own (1.5 s, 5 s, 15 s, 30 s, and again whenever the
  window regains focus), so a Shell that is still signing in at first paint no
  longer leaves a permanently blank line.

## [0.3.7] - 2026-10-27

### Fixed

- **A weekday holiday was priced at peak.** DeepSeek's rule is "Beijing time,
  Monday to Friday **excluding Chinese statutory public holidays**, 09:00–12:00
  and 14:00–18:00", and the fold only knew about weekdays: every weekday inside
  those windows was billed at 2×, so a public holiday overstated the estimate by
  double. `entries/usage.js` now carries the 2026 holiday dates as dated data,
  sourced from the State Council notice (Guo Ban Fa Ming Dian [2025] No. 7), and
  `test/cost.spec.mjs` proves a holiday Thursday is off-peak while an ordinary one
  is not.

### Changed

- **The rate table is verified against both price pages and pinned by a test.**
  Re-checked 2026-10-27 against the English and Chinese pricing pages: all twelve
  off-peak numbers match (Flash `0.003/0.15/0.6` USD and `0.02/1/4` CNY, Pro
  `0.022/0.66/1.98` USD and `0.15/4.5/13.5` CNY), and the legacy Flash model names
  still bill at the Flash price. A new spec fails if any of those numbers drift.

## [0.3.6] - 2026-10-27

### Fixed

- **The README's status line no longer carries a version.** The packaged README is
  the card's page body, so any version written into its prose is stale as soon as
  the next release ships — 0.3.5 was published with a page still describing
  "0.3.4". The status now says what shipped; the version comes from the manifest
  and the page header. `test/docs.spec.mjs` fails if a version returns.

## [0.3.5] - 2026-10-27

### Fixed

- **The card's own page described an older plugin.** The README that ships in the
  tarball *is* the page body in the Plugins market, and it still said "0.2.0, one
  feature shipped" and listed a layout directory that does not exist. Status,
  layout, and requirements now match the package.

### Changed

- `HANDOFF.md` was rewritten for the shipped bundle: the contracts that cost time
  (a row's config namespace is the row id, not the slot key; no bundler for the
  face; the client session contract exposes no events), the slot geography around
  the account row, the development loop, and the release order that keeps the
  catalogue record. `test/docs.spec.mjs` now fails if the briefing drifts back to
  the stale claims it once made.

## [0.3.4] - 2026-10-27

### Added

- **The bundle says which Harness it runs on.** `dsh.engines.dsh` is now declared
  (`^0.2.1-rc.3`, the revision the two surfaces were verified against), so the
  market can read the requirement instead of labelling the card "Host requirement
  unknown", and an install onto an older Host can be refused rather than failing
  at mount time. `test/manifests.spec.mjs` keeps the field present and semver.

## [0.3.3] - 2026-10-27

### Fixed

- **The balance read could wait forever.** When the Host withheld the
  `account/watch` grant, the read's promise never settled: the callback never
  ran, so nothing resolved and the line silently stayed empty for the life of the
  page. The read now carries a timeout and also starts its call before the
  effect's yielded disposer, so an effect runner that stops at the first yield
  still performs it. `test/account.spec.mjs` pins all seven refusal paths.

### Changed

- The read itself moved into `client/account.js`, beside `client/money.js`, for
  the same reason: the build inlines it into the browser bundle and the spec
  imports the same source.

## [0.3.2] - 2026-10-27

### Changed

- **The balance decisions are testable.** Which wallet a line shows, and how the
  amount is rendered (currency symbol, two decimals, unparseable values shown
  verbatim), moved into `client/money.js`. The build inlines that file into
  `lib/client.js`, so `test/money.spec.mjs` covers the exact source the browser
  runs instead of a copy.

## [0.3.1] - 2026-10-27

### Fixed

- **The balance line had no observable mount point.** When the account exposed no
  wallet it rendered `null`, which is correct for the user but indistinguishable
  from "the surface was never registered" for anyone verifying the build. The
  component now always renders its wrapper (`data-polish-balance="empty"`, hidden)
  and fills it with the amount only when the Host returns one.

## [0.3.0] - 2026-10-27

### Added

- **Remaining account balance in the sidebar foot.** A line above the account row
  shows the account's own wallet (`$17.33`), read once through a
  `remoteAccess.whenAccess('account/watch', …)` grant so the call is allowed and
  the grant is released as soon as the read settles. It renders nothing at all
  when the switch is off, when the Host exposes no wallet, or when the read is
  refused — an empty line beats a number the Host did not give us.
- **A second switch, `accountBalance`.** It is declared once in
  `entries/registry.js` and once in `client/switches.json`, exactly like the cost
  switch, so the Configure page grows it automatically.

### Notes

- The line sits in `sidebar.footer.action`, the one documented seat in the
  sidebar foot. It renders *above* the account row, because
  `SidebarRoot.tsx:405-411` puts `footerActions` before `settingsArea`; the only
  seat below the login would be `settings.launcher`, which means shadowing the
  account row and its whole menu.

## [0.2.4] - 2026-10-27

### Changed

- **The card leads with the number it is about.** It now opens with the
  "Estimated session cost" heading and the live `≈$…` amount, then a stacked bar
  showing how the session's tokens split between cached input, uncached input,
  cache writes and output, then the rows: cache hit, tokens, model, provider,
  requests, and the estimate again above the footnote. Model and provider are
  always named (they were only listed when a session had more than one), so a
  first look says which route the money was spent on.

## [0.2.3] - 2026-10-27

### Fixed

- **A sub-cent turn no longer reads `≈$0`.** `formatMoney` rounded to three
  decimals, so a real 22.1K-token turn whose actual cost was about $0.000095
  showed as zero. Amounts under a cent now keep two significant digits
  (`≈$0.000095`), cents keep three decimals, and dollars keep two.

## [0.2.2] - 2026-10-27

### Fixed

- The pill's `≈` was stored as cp1252 mojibake (`≈`), so a real turn rendered
  `≈$0.003` instead of `≈$0.003`. Same cause as the two strings repaired in
  0.2.1 — a PowerShell round-trip over the face source — and the last of that
  damage. Verified against a real turn in Dev AryaCode.

## [0.2.1] - 2026-10-27

### Fixed

- **The Configure page found no form.** The page body asked
  `configForms.get('<package>#<row>')`, but the Plugins page builds a row's form
  from the **row id** alone (`PluginManagerPage.tsx:1735` passes
  `form={formFor(openRow.rowId)}`, and `formFor` matches `view.ns === id`). The
  lookup now asks for `polish`, so the row's page reads the live form instead of
  saying the row has no configuration to change. The `plugins.row.config`
  registration key is unchanged: that one is still `<package>#<row>`.
- Two strings that a PowerShell round-trip had written as cp1252 mojibake
  (`Loading configuration…`, `Saving…`, and an em dash) are back to UTF-8.

## [0.2.0] - 2026-10-27

### Added

- **Estimated session cost.** A composer-dock pill (`≈$0.39`) that opens a
  breakdown card: cache hit, uncached input, cached input, output, requests, and
  the estimate itself, with the same "your provider's bill is authoritative"
  footnote. The money is computed **host-side**: `entries/usage.js` folds
  model-attributed usage out of the durable session log, and `entries/cost.js`
  registers a `polishCost` projection whose wire view is already priced at the
  published DeepSeek rates (off-peak table, peak at 2×, cache writes billed as
  misses). The browser half only formats numbers, so no rate table ships to the
  client and an unknown model or provider leaves the estimate marked incomplete
  instead of quietly reporting a wrong number.
- **`test/cost.spec.mjs`.** Fold and pricing coverage: peak/off-peak, cache
  rates, cache writes as misses, unknown route handling, retry accounting, and
  the empty-session wire view.

## [0.1.1] - 2026-10-27

### Added

- **The row's Configure page.** `lib/client.js` is the bundle's browser face: it
  registers the `polish` row's configuration page, so the row now has a page of
  its own that reads the row's live config form and writes it back with the
  Host's revision. With no feature landed yet the page states that plainly
  instead of showing a switch that toggles nothing.
- **`client/switches.json`.** The browser half of the feature seam: one entry per
  switch, and `test/client-face.spec.mjs` fails when it and `entries/registry.js`
  disagree in either direction.

## [0.1.0] - 2026-10-27

### Added

- **AryaCode Polish bundle.** One package, one row (`polish`), one switch per
  quality-of-life feature, so each refinement can be turned off from its
  Configure page without uninstalling the bundle.
- **Feature seam.** `entries/registry.js` is the single list of features, and the
  row's config schema is derived from it: a new entry gains its volatile switch
  with no second registration, and switching a feature off disposes its host
  half instead of merely hiding it.
- **`docs/parked-spellcheck.md`.** Records why right-click spelling corrections
  cannot be a plugin, and the exact shell change that would restore them.

### Not shipped

- Right-click spelling corrections. The candidates came from Chromium's
  spellchecker through the Electron main process; the shell no longer reads
  them, and no plugin contract can reach that menu. Parked with evidence.
