# AryaCode Polish

One install for the small things that make AryaCode feel finished.

AryaCode Polish is a plugin **bundle**: it adds surfaces to the app it is
installed into and patches nothing. It is one package, one Plugins row, and one
switch per feature, so a refinement that turns out to be wrong for a machine can
be turned off without uninstalling anything.

Status: every shipped feature is listed under [Switches](#switches), and each one has
its own off switch. The version is the package's, and the card header already shows it.

## What it is

- **One row.** The bundle inserts a single row, id `polish`, into the profile's
  composition (`cordis.patch.yml`). That row is the install surface: it mounts
  the host half of every enabled feature and names the bare package specifier so
  the Shell can find the browser face.
- **One switch per feature.** Every feature is gated by its own boolean in the
  row's Configure page, on by default. Turning it off disposes that feature only.
- **Additive.** No fork of the shell, no edits to `app.asar`, no patched
  installed app, no DOM hacks against private class names.

## Switches

Row: **AryaCode Polish** (`polish`).

Each entry in `entries/registry.js` becomes one volatile boolean in this
Configure page automatically.

| Switch | Default | What it does |
| --- | --- | --- |
| Better workspace | On | Replaces the sidebar workspace list with our own tree and a right-click menu on each workspace. |
| **Estimated session cost** (`sessionCost`) | On | A `≈$0.39` pill in the composer dock that opens a breakdown card — cache hit, uncached input, cached input, output, requests, and the estimate — priced from the session's recorded usage at the published DeepSeek rates. |
| **Account balance** (`accountBalance`) | On | The account's remaining wallet (`$17.33`) in the sidebar foot, above the account row. Renders nothing when the Host exposes no wallet, so it never shows a number nobody gave it. |
| **Open workspace folder** (`openWorkspaceFolder`) | On | An **Open workspace folder** row in a Session's "…" menu that opens the Session's workspace in Explorer/Finder. Renders nothing when the Session has no workspace or the Host cannot open a path. See [Open a workspace folder](docs/workspace-folder.md) for why the request had to land here instead of on the workspace row itself. |
| **Add a workspace from GitHub** (`githubWorkspace`) | On | Adds the GitHub half of the workspace sources: the dialog lists the repositories your GitHub CLI session can clone, and cloning one creates the workspace. The token never enters the browser — it is read on the Host, used only as git's http auth header, and never stored. The sidebar foot carries the sign-in state (`GitHub · <login>`). See [GitHub workspaces](docs/github-workspaces.md). |
| **Add a workspace from this PC or GitHub** (`workspaceSources`) | On | The Workspaces **+** button gets a source menu: **On this PC** (the Host's OS chooser, or a folder list when the composition has no native chooser) and **GitHub repository…**. Off, the **+** button goes back to the shipped folder picker. |
| **Right-panel screenshot** (`panelScreenshot`) | On | A camera button in the right panel's top-right corner photographs the open tab, copies the picture to the clipboard, and attaches it to the message being written. See [Right-panel screenshot](docs/panel-screenshot.md) for what it can and cannot capture. |

### How the cost is computed

The numbers come from the Host, never from the browser:

- `entries/usage.js` folds model-attributed provider usage out of the durable
  session log, one row per provider, model, and hour, and tags each band as peak
  or off-peak. Peak is Beijing weekdays 09:00–12:00 and 14:00–18:00, billed at 2×,
  and Chinese statutory public holidays are off-peak all day — the 2026 list is
  dated data in that file, sourced from the State Council notice.
- `entries/cost.js` registers the `polishCost` projection and prices that fold:
  cache reads at the cache rate, uncached input and cache writes at the miss
  rate, output at the output rate. The wire view is already money, so no rate
  table reaches the client.
- An unknown provider, model, or rate period keeps its tokens and marks the
  estimate **incomplete** — the pill says so rather than reporting a number it
  cannot stand behind.
- The rate table is dated and lives in one place, and
  `test/cost.spec.mjs` pins all twelve published numbers together with the two
  price pages they came from. When DeepSeek changes prices, append a period; do
  not edit history.

## Better workspace

The tree that replaces the shipped sidebar list is the largest thing in this bundle. What it does,
all of it switchable by turning the **Better workspace** switch off:

- **Structure.** Workspaces with their sessions, `/` in a workspace name to file it under a folder,
  declared empty folders, and folders you can colour, glyph and bold.
- **Order.** Drag a workspace onto another to reorder, drag it onto a folder header to file it, drag
  it to the dashed top zone to lift it out, star one to the top, or hand-keep the folder order.
- **Find.** One filter with operators (`!` running, `#` flagged, `@folder`, `t:today`, `t:week`,
  `t:new`), fuzzy matching (`dcp` finds `dsh-aryacode-polish`), chips for the same operators, and
  counts that say what they excluded.
- **Sort.** Host order, A to Z, most spent first, recent first — applied to workspaces and to the
  sessions inside them.
- **Read state.** A dot on every session that changed since you opened it, the same dot rolled up onto
  its workspace and folder so a folded row still tells you, `Alt+Up/Down` to jump to the next one,
  and **Mark everything as read**.
- **Money.** A cost per session, a running total per workspace and folder, a header total that opens
  **Spend by workspace**, and a breakdown card behind every one of those numbers.
- **Bulk.** Pick with `Space`/`Shift`, then pin, flag, mark read, archive or copy the selection, with
  **Undo** for the two that change durable state. A workspace can also be archived whole.
- **Navigation.** `Ctrl+K` palette, `Alt+Left/Right` history that survives a reload, focus mode for
  the workspace you are in, and a marker on it so you can see where you are.
- **Keyboard and screen readers.** `aria-tree` semantics with real `Left/Right` open-close, `F2` rename,
  `Home/End`, type-ahead, and a `?` sheet listing every key.

The design notes, including the parts the Host makes impossible, live in
[Better workspace](docs/better-workspace.md).

## Declaring a feature

`entries/registry.js` is the single list of features. One entry is one feature:

```js
{
  id: 'spellcheck',              // becomes the config field and the switch
  label: 'Spelling corrections',
  description: 'Right-click a misspelled word to pick a correction.',
  defaultOn: true,
  mount: spellcheck,             // optional host half: a Cordis plugin
}
```

The row's `Config` schema is derived from that list, so a new entry gains its
volatile switch with no second registration. `mount` is plugged in when the
switch is on and disposed when it is off, so a disabled feature stops costing the
app rather than merely hiding. A feature that only draws UI omits `mount` and
contributes a client face instead.

## Parked

**Right-click spelling corrections** — investigated and not shipped. The
candidates you saw in AryaAI came from Chromium's spellchecker through the
Electron main process, which the AryaCode shell no longer reads; a plugin cannot
reach it. The finding, the exact 10-line shell change that would restore it, and
why the plugin alternatives were rejected are in
[`docs/parked-spellcheck.md`](docs/parked-spellcheck.md).

## Install

From the AryaCode Plugins market: open the market, find **AryaCode Polish**,
install, then quit and reopen AryaCode — the market registry is cached in the
running process.

Manual, for development only:

```bash
node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add <path-to-tgz>
```

## Requirements

- AryaCode `^0.2.1-rc.3` (declared as `dsh.engines.dsh`; the revision both
  surfaces were verified against).
- AryaCode with the Cordis plugin API (`@deepseek-ai/cordis ~4.0.4`).
- Node `^22.19.0 || >=24.0.0` to build from source.

## Development

```bash
pnpm install
pnpm test        # patch shape, config accessors, feature seam, docs parity
pnpm pack        # produces aryacode-dsh-aryacode-polish-<version>.tgz
```

Test on **Dev AryaCode** (`%LOCALAPPDATA%\AryaCode-dev\home`), never on the
installed app.

## Layout

```
cordis.patch.yml     one insert, one row
entries/polish.js    the row: Config derived from the registry, apply()
entries/registry.js  the feature list — the one place a feature is declared
entries/usage.js     the fold: model-attributed usage out of the session log
entries/cost.js      the polishCost projection: rates, pricing, host mount
entries/github.js    the GitHub route: gh token, repository list, clone, workspace
entries/config.js    volatile-reference accessors (resolve/flag/list/text)
lib/index.js         mount point re-exporting the row
client/face.js       browser face source: the Configure page and every surface
client/money.js      which wallet is shown, and how the amount is rendered
client/account.js    the granted, timeout-bounded balance read
client/switches.json the browser half of the seam — one entry per switch
scripts/build-client.mjs  wraps client/face.js into lib/client.js
lib/client.js        generated: the bundle the Shell loads
locale/              card title and description (en, zh)
docs/                feature notes and parked investigations
test/                node --test specs
```

The Configure page is generated, not hand-maintained: `lib/client.js` is built
from `client/face.js` and `client/switches.json` by `pnpm build:client` (which
`pnpm pack` runs), and `test/client-face.spec.mjs` fails when `switches.json` and
`entries/registry.js` disagree in either direction.

## Licence

MIT © KonnectSuite
