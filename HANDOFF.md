# Handoff — AryaCode Polish

AryaCode Polish is **shipped and installable**, not a plan. This file is the
briefing for whoever picks it up next: what exists, which contracts cost time,
and how to release. Read `README.md` for the user-facing story.

## State

- Repo: `C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-aryacode-polish` —
  **public**, `main`.
- Package: `@aryacode/dsh-aryacode-polish`. Current version **0.3.4**.
- Distribution: on npm (`latest` resolves) **and** in the Arya Plugin Market
  (`KonnectSuite/dsh-arya-market`, branch `catalog`). Installing from the market
  card in Dev AryaCode was verified end to end: it lands as a digest-named tarball
  under `<profile>/.dsh-market/releases/`, adds itself to `dsh.profile.bundles`,
  and the surfaces mount after a restart.
- Shipped features, each its own switch in the row's Configure page:
  1. **Estimated session cost** — `polishCost` host projection priced from the
     recorded session log, `≈$…` pill in the composer dock, breakdown card.
  2. **Account balance** — remaining wallet in `sidebar.footer.action`, directly
     above the account row.
- Parked, by the user's decision: right-click spelling corrections. See
  `docs/parked-spellcheck.md` — it needs a shell change, no plugin can reach it.

Nothing was ever written to the installed AryaCode (`%LOCALAPPDATA%\Programs\AryaCode`)
or to the installed data home. All verification used Dev AryaCode.

## Shape of the package

```
cordis.patch.yml      one `- insert:` with one row, id `polish`, bare package name
entries/registry.js   THE feature list — one entry per feature, nothing else
entries/polish.js     the row: Config derived from the registry, apply(), mount/unmount
entries/usage.js      fold: model-attributed usage out of the session event log
entries/cost.js       polishCost projection + dated rate table + pricing
entries/config.js     accessors: resolve / flag / list / text
client/face.js        browser face source (configure page, cost pill, balance line)
client/money.js       wallet choice + amount rendering (inlined into the bundle)
client/account.js     granted, timeout-bounded balance read (inlined)
client/switches.json  browser half of the seam: one entry per switch
scripts/build-client.mjs  wraps face.js + money.js + account.js into lib/client.js
lib/client.js         generated — never hand-edit, `pnpm build:client` rewrites it
lib/index.js          mount point, re-exports the row
locale/en.json, zh.json  card title + description (keys must match)
```

### Adding a feature

1. One entry in `entries/registry.js`
   (`{ id, label, description, defaultOn, mount? }`) — that entry *is* the
   volatile switch, because the row's `Config` schema is derived from the list.
2. One matching entry in `client/switches.json`, or
   `test/client-face.spec.mjs` fails the parity check in either direction.
3. Put anything testable in a plain ESM module under `client/` and let
   `scripts/build-client.mjs` inline it (`export ` is stripped); keep
   `client/face.js` to hooks and markup.
4. Test: host logic in `test/*.spec.mjs`, then `pnpm test`, `pnpm pack`, install
   in Dev AryaCode, verify in the browser, commit, release.

## Contracts that cost real time

- **A row's config namespace is the ROW ID, not the slot key.**
  `ctx.get('configForms').get('polish')` is the live form. Registering the slot
  still uses the key `` `@aryacode/dsh-aryacode-polish#polish` ``. Mixing them up
  yields `state.status === 'unavailable'` and the page silently shows
  "This row has no configuration to change."
- A config field must be `.volatile()` to reach the settings domain, and its value
  arrives as an accessor `{ get() }` — unwrap with `flag()`/`text()`/`list()`,
  never `=== true`.
- A volatile-only change does **not** re-run `apply()`. `entries/polish.js` mounts
  and disposes features from `loader/volatile-update`.
- Declaring `dsh.client` obliges `exports['./client']`, and the `id` inside
  `window.__ModuleLoader__.load({ id })` must equal the package name.
- There is **no bundler** for the face: the build is a text wrapper. Anything you
  `require` must come from the Shell's frozen module table — in practice only
  `require('react')`; everything else has to be inlined from source.
- The client session contract exposes **no events** (`ISession`,
  `SessionSnapshot`). Anything derived from the log must be a host projection via
  `ctx.sessionProjections.register(...)`, which is a ctx effect: disposal follows
  the fiber.
- **Slot geography matters.** `SidebarRoot` renders `footerActions`
  (`sidebar.footer.action`) *above* `settingsArea` (`sidebar.settings` →
  `settings.launcher` → the account row). Nothing documented renders below the
  login; the only way is shadowing `settings.launcher`
  (`replaceRisk: 'shadows-shipped-ui'`), which means reimplementing the account
  row and its menu. The user chose the footer action.
- An account read must be **granted and bounded**:
  `remoteAccess.whenAccess('account/watch', …)`. If the grant never arrives and
  nothing times the read out, the promise never settles — the line stays empty
  for the life of the page. `client/account.js` uses a 10 s ceiling and starts the
  call before the effect's yielded disposer.
- The market badge still reads **"Host requirement unknown"** even with
  `dsh.engines.dsh` declared and the package on npm. That is market-side; the same
  declaration does feed the compatibility filter
  ("Hid 0 plugins incompatible with DSH 0.2.1-rc.3").

## Editing these files

Never round-trip them through PowerShell string operations. `Set-Content
-Encoding utf8` writes a BOM that kills the specs (`SyntaxError: Unexpected token
''`), and a `-replace` round-trip once stored cp1252 bytes (`—`, `…`,
`≈`) that shipped to the UI. Bump versions with `npm pkg set version=…`
(`pnpm pkg` is not implemented in pnpm 11.0.9), and rewrite JSON through node.

## Development loop

```powershell
cd C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-aryacode-polish
pnpm test                 # 66 specs, node --test
pnpm pack                 # runs build:client first

cd C:\Users\KNPhu\.arya\github\KonnectSuite\AryaCode
$env:DSH_HOME = "C:\Users\KNPhu\AppData\Local\AryaCode-dev\home"
node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add <tgz>
pnpm run start:web -- --no-open      # print the token URL from the output
```

- The `file:` pin means a repack at the **same version is never refetched** — bump
  the version for every install, or remove then add.
- Kill the old server before starting a new one: a second `start:web` while port
  3080 is held exits silently with code 1 (`Get-NetTCPConnection -LocalPort 3080
  -State Listen` names the owner).
- `plugin --profile desktop` is refused: *"profile 'desktop' is managed
  exclusively by the Electron application"*. Desktop installs are the user's
  action in the app.
- Browser checks: Playwright core required from
  `C:/Users/KNPhu/.arya/github/KonnectSuite/dsh-engineering/`, Chromium at
  `C:/AI/AryaBenchRuntime/browsers/chromium-1248/chrome-win64/chrome.exe`. Useful
  patterns in `C:\Users\KNPhu\OneDrive\Documents\AryaAI\Fixes\devpolish*.mjs`:
  the package name text is the clickable thing (there is no "View …" link), the
  market search box is `input` index 1, and installing needs the confirm dialog's
  **Confirm install** button, not just `Install`.
- `Invoke-WebRequest` on the token URL proves nothing about a plugin: the SPA
  never names a row. Trust the boot payload and a rendered page.

## Release

Both channels work; npm is no longer blocked (a staged publish cleared itself and
`npm publish` now publishes directly).

```powershell
cd C:\Users\KNPhu\.arya\github\KonnectSuite\dsh-market
node scripts/publish-arya-catalog.mjs --pull          # FIRST — otherwise the record is lost
node scripts/publish-arya-release.mjs --npm <version> `
  --source KonnectSuite/dsh-aryacode-polish `
  --description "<en>" --description-zh "<zh>" --publish
node scripts/publish-arya-catalog.mjs --push
```

- `--tarball <tgz>` also works (publishes a GitHub release asset instead of
  pointing at the registry). The scripts refuse any archive whose manifest lacks
  `dsh.bundle.patch`.
- Order matters: `--pull` after a release record **overwrites it** and `--push`
  then reports "nothing to publish". Pull, release, push.
- Verify afterwards from the remote, not from the working copy:
  `gh api repos/KonnectSuite/dsh-arya-market/contents/data/arya-plugins.json?ref=catalog -H "Accept: application/vnd.github.raw"`.
  `raw.githubusercontent.com` caches for a few minutes.
- The old `publish_catalog.py` in `AryaAI\Fixes\aryastrata-tune` cannot create a
  first-time entry (`StopIteration`) and is superseded by the scripts above.
- Tell the user to quit and reopen AryaCode after a release; the market registry is
  cached in the running process.

## Open items

1. **The balance line's populated state has never been seen.** This workstation
   refuses the account platform calls (403 on the profile read), so no wallet
   exists to display; only the mounted-empty state and the unit-tested read are
   proven. Verify on a signed-in machine before trusting the number.
2. **Spellcheck stays parked** unless the user asks for it; reviving it means the
   ~10-line change in `apps/desktop/src/main.ts` described in
   `docs/parked-spellcheck.md`, shipped as a patch release of the harness.
3. The **"Host requirement unknown"** badge is a market-side gap, not a manifest
   gap.
4. The next features are whatever the user names — the seam is ready, and one
   feature is one registry entry plus one switch entry plus its surface.
