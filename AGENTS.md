# Agent notes — dsh-aryacode-polish

Hard-won rules. Each one has already cost a release or a debugging session in
this repo. `docs/releasing.md` is the full runbook.

1. **Never place files into a profile's `node_modules`.** Hand-copied files work
   until the next `pnpm install` or app start, and they leave `package.json`
   naming a different version than the files. The card, the lockfile and the
   loader then disagree about what is installed. Install from the registry.
2. **Publishing is not installing.** `npm publish` changes nothing on any
   machine. The profile pin (`"0.114.0"`, exact) only moves when something runs
   `pnpm add <pkg>@<version> --save-exact`.
3. **Two loads, not one.** Host code (`mcp/`, `entries/`, `presets/`) needs a
   plugin reload or restart; `lib/client.js` needs a page reload. Doing one and
   not the other produces either `Unknown action "…"` or a missing sidebar row.
4. **The market caches update answers for 30 minutes**, in the host process
   (`UPDATES_TTL_MS` in `@aryacode/dsh-arya-market/lib/updates.js`). "Up to
   date" right after a publish is that cache, not a broken release.
5. **A publish can be staged.** npm answers `202` and the version 404s for one
   to three minutes; a retry answers `409 Cannot publish over previously staged
   version`. Poll until `npm view <pkg>@<ver>` resolves; do not bump again.
6. **Run specs one file per process** (`node test/<file>.spec.mjs`).
   `node --test test/` spawns a runner this environment blocks.
7. **Release with the script**, `node scripts/release.mjs --minor --note …`,
   so the order bump → changelog → build → test → commit → push → publish →
   poll is never partly remembered.
8. **The sidebar foot is shared, so polish stacks it.** `sidebar.footer.action` is
   one flex row owned by the shell; every installed plugin's entry is a sibling in
   it, and a new plugin must not have to guess how much room we left it. Polish
   turns that row into a column while its entries are mounted (`claimFooterRow` in
   `client/face.js`, refcounted, restored when the last one goes), so each entry
   gets a line. A horizontal foot meant a width contest, and our status text
   crushed a remote-access plugin's button to `Rem…`. `test/client-face.spec.mjs`
   pins the stack.
9. **Design before you draw.** Every new or edited surface follows `docs/gui.md`:
   DSH tokens only (never a literal colour), the 8 px spacing grid, the 12/13/14
   type hierarchy, explicit hover/press/disabled/focus-visible states, empty,
   loading and error states for every list, and keyboard reachability. Management
   surfaces (the MCP page, the settings pages) follow AryaInfer's density;
   sidebar chrome copies the Shell's own row metrics — the GitHub row is
   44 px / 24 px picture / 14 px label because `ui-settings-account` is, not
   because it looked nice. Verify with a rendered screenshot before shipping.


## Releasing: the market step is not optional

`node scripts/release.mjs` ends at a polled npm publish, which is three quarters of a
release. The fourth is the market catalogue: a version on npm that the `catalog`
branch does not list is hidden from every user, because the market answers from
`releases[0]`. Finish with

    node ../dsh-arya-market/scripts/release-plugin.mjs --skip-build --skip-tests

which verifies npm, the catalogue entry, the recorded `sha256` and
`check-catalogue-parity.mjs`, and records whatever is missing. Never hand-edit
`data/arya-plugins.json`.
