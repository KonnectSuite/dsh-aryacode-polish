# AryaCode Polish

One install for the small things that make AryaCode feel finished.

AryaCode Polish is a plugin **bundle**: it adds surfaces to the app it is
installed into and patches nothing. It is one package, one Plugins row, and one
switch per feature, so a refinement that turns out to be wrong for a machine can
be turned off without uninstalling anything.

Status: **0.1.0 in development.** The scaffold and the feature seam are in place
and tested; no feature has shipped yet.

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

No switch is registered yet: `entries/registry.js` is empty until the first
feature lands. Each entry in that list becomes one volatile boolean in this
Configure page automatically.

| Switch | Default | What it does |
| --- | --- | --- |
| — | — | No features yet. |

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
entries/features/    one module per feature
entries/config.js    volatile-reference accessors (resolve/flag/list/text)
lib/index.js         mount point re-exporting the row
lib/client.js        browser face: Configure page + per-feature UI
locale/              card title and description (en, zh)
docs/                parked investigations
test/                node --test specs
```

## Licence

MIT © KonnectSuite
