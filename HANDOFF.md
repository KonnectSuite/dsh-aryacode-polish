# Handoff — AryaCode Polish

You are picking up a new plugin, not extending an existing one. Read this whole
file before writing code, then interview the user for the feature list.

## The ask

AryaAI accumulated a set of GUI, quality-of-life and informative improvements.
They were never backed up to GitHub and they do not follow the current plugin
strategy. The user wants those improvements rebuilt as **one new plugin** —
**AryaCode Polish** — rather than patched into the shell or copied from the old
app.

## Repository state

- Repo: `C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-aryacode-polish`
- Remote: `https://github.com/KonnectSuite/dsh-aryacode-polish` (private)
- Branch: `main`
- Contents: `README.md`, `.gitignore`. **No package scaffold yet.**
- Display name: **AryaCode Polish**
- Package name: not final. Prefer `@aryacode/dsh-polish` (short, matches the
  display name). Use `@aryacode/dsh-aryacode-polish` only if the user wants
  repository parity.

Do not rename the repository or plugin without asking.

## First thing: get the feature list

The user has the features in mind and will describe them. Ask for:

1. The list itself, in the user's words.
2. For each item: what it looks like, where it lives, and what problem it solves.
3. Any screenshots or recordings of old AryaAI showing the behaviour.
4. Which items are must-have for v1 and which can wait.
5. Whether any item changes model/session data rather than only presentation.

The old AryaAI improvements are **not in GitHub**. The source of truth is the
user's memory, screenshots, or an old install. Do not pretend to recover them
from the current `AryaAI` repository unless the user points at a machine where
they exist.

## Ground rules (also in README.md)

- Additive only. Never edit the installed AryaCode payload (`app.asar`,
  `resources`, profile `package.json`).
- Build on documented plugin contracts: host plugin + client face, `plugins.*`
  slots, host routes. No DOM hacks against private class names.
- Every surface is switchable from the row's Configure page and defaults to on.
- Every feature gets a test, a README entry, and a screenshot where visual.
- The plugin must survive a harness update.

## Architecture to copy

Study these before scaffolding:

- `C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-engineering`
  - `package.json` exports (`./l5x`, `./mwi`, `./optix`, …)
  - `entries/*.js` — one row per surface, `Config` schema with `.volatile()`
  - `scripts/build-client.mjs` — bundles browser faces into `lib/client.js`
  - `scripts/faces/settings.js` — hand-written client face that registers
    `plugins.row.config` pages
  - `cordis.patch.yml` — inserts the product rows
  - `test/*.spec.ts` — schema, row config, tool registration, skill parity
- `C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-local-llm`
  - client panel and tabs (`src/client/StrataControlCenter.tsx`)
  - host routes and remote pairing (`src/remote.ts`, `src/remote-wire.ts`)
  - Playwright UI harness (`tests/benchmark-ui.mjs`)
- `dsh-better-sidebar` (third-party, installed profile) for sidebar-slot patterns.

### Plugin contracts that cost time if missed

- Row config keys are `` `${bundleName}#${rowId}` ``. Register with
  `ctx.slots.register({ name: 'plugins.row.config', key, inject: () => ({ spec }) }, Component)`.
- A config field must be `.volatile()` to appear in the settings domain. The
  value arrives as an accessor object (`{ get() }`), **not** the raw value.
  Unwrap it: `flag(config.x)`, `text(config.x)`, `list(config.x)`. Never compare
  `config.x === true`.
- The Plugins page passes a **snapshot** of the config form, not a live store.
  For a live page, resolve the service lazily with `ctx.get('configForms')`,
  subscribe with `useSyncExternalStore`, and do not add `configForms` to the
  face's `inject` list (that fails the whole face).
- A volatile-only config change does not re-run `apply()`. If a feature mounts
  or unmounts work at runtime, listen for `loader/volatile-update` and remount
  the child plugin (pattern in `entries/optix.js`).
- Tool/schema surfaces cost every request. Keep expensive halves behind a
  switch even when the default is on.

## Feature triage

Classify every requested item before designing:

| Kind | Likely home |
|---|---|
| Theme, density, typography | client CSS + a `plugins.*` shell slot |
| Sidebar / panel / file tree | sidebar slot (see `dsh-better-sidebar`) |
| Tabs, status bars, summaries | client face mounted in a shell slot |
| Keyboard shortcuts | client keydown + host command registration |
| Informative panels, diagnostics | host collector + client panel |
| Welcome / empty states, model picker | client face, slot-dependent |
| Session/task list polish | client face, documented session APIs |
| Settings | row Configure page (`plugins.row.config`) |

If a requested item needs a shell region that has no slot, say so and propose
the nearest supported surface. Do not fake it with global CSS.

## Development loop

- Harness checkout: `C:\Users\KNPhu\.arya\github\KonnectSuite\AryaCode`
- Dev home: `%LOCALAPPDATA%\AryaCode-dev\home`
- Dev app: `pnpm run start:web -- --no-open` from the checkout, then install the
  built tarball into the dev profile:
  `node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add <tgz>`
- Browser checks: Playwright core from `C:/AI/AryaBenchRuntime`, Chromium at
  `C:/AI/AryaBenchRuntime/browsers/chromium-1248/chrome-win64/chrome.exe`.
  Reuse `C:\Users\KNPhu\OneDrive\Documents\AryaAI\Fixes\devtest.mjs` as a shape.
- Unit tests: `node --test` (host) + `vitest` (package) as in `dsh-engineering`.
- Typecheck before every pack.

## Release

Source of truth is this repo. Published versions are immutable.

1. `pnpm prepack` (build host + client + assemble)
2. `pnpm pack` → `aryacode-dsh-<name>-<version>.tgz`
3. Commit and push
4. Create the market release in `KonnectSuite/dsh-arya-market`:
   `gh release create plugin-aryacode-dsh-<name>-v<version> <tgz>`
5. Update the catalogue from `C:\Users\KNPhu\OneDrive\Documents\AryaAI\Fixes\aryastrata-tune`:
   `python publish_catalog.py <version> <asset-url> "@aryacode/dsh-polish"`
   Use the bundled Python at
   `C:\Users\KNPhu\.aryacode\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`
   (the WindowsApps stub cannot find `encodings`).
6. Commit/push the catalogue repo, then verify the raw JSON.
7. Tell the user to quit and reopen AryaCode before updating — the market
   registry is cached in the running process.

Never publish from npm as the primary channel for these bundles; the market
release asset is the artefact the catalogue points at.

## Definition of done for v1

- Feature list agreed and written into `README.md`.
- Every feature: on by default, switchable in Configure, documented, tested.
- Verified in Dev AryaCode with screenshots.
- Packaged, market release created, catalogue updated, user installs from the
  Plugins market and confirms.

## Open questions to ask the user

1. The full feature list, and which items are v1.
2. Any screenshots of the old AryaAI improvements.
3. Does any feature need a host-side service, or is it presentation only?
4. Should the plugin be one row with several switches, or several rows?
5. Package name: `@aryacode/dsh-polish` vs `@aryacode/dsh-aryacode-polish`.
